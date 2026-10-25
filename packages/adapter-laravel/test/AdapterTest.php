<?php

declare(strict_types=1);

namespace Kylat\Laravel\Tests;

require_once __DIR__ . '/../src/Attributes/Prop.php';
require_once __DIR__ . '/../src/Attributes/Client.php';
require_once __DIR__ . '/../src/Attributes/Server.php';
require_once __DIR__ . '/../src/Attributes/Uses.php';
require_once __DIR__ . '/../src/Attributes/Child.php';
require_once __DIR__ . '/../src/Component.php';
require_once __DIR__ . '/../src/Actions/ActionRegistry.php';
require_once __DIR__ . '/../src/Http/Controllers/KylatBatchCallController.php';
require_once __DIR__ . '/../src/Blade/KylatDirective.php';

use Kylat\Laravel\Actions\ActionRegistry;
use Kylat\Laravel\Blade\KylatDirective;
use Kylat\Laravel\Http\Controllers\KylatBatchCallController;
use RuntimeException;

// Mock kelas aksi aman untuk pengujian
final class SecureCartActions
{
    public bool $allowAccess = true;

    public function authorize(): bool
    {
        return $this->allowAccess;
    }

    public function add(string $itemId, int $qty): array
    {
        return [
            'status' => 'added',
            'itemId' => $itemId,
            'qty' => $qty,
            'total' => $qty * 15000,
        ];
    }
}

function runTests(): void
{
    echo "=== PENGUJIAN ADAPTER LARAVEL KYLAT (DENGAN SECURITY AUDIT) ===\n\n";

    // 1. Uji KylatDirective::renderIsland
    echo "1. Menguji KylatDirective::renderIsland...\n";
    $markup = KylatDirective::renderIsland('Counter', ['initialCount' => 5]);
    assert(str_contains($markup, 'data-island="Counter"'), "Markup harus memuat data-island='Counter'");
    assert(str_contains($markup, 'data-props="{&quot;initialCount&quot;:5}"'), "Markup harus memuat JSON hex/quote escaped data-props");
    echo "   ✅ Render island valid berhasil.\n";

    // 2. Uji batasan data-props 16 KB (KIL-213)
    echo "2. Menguji batasan data-props > 16 KB (KIL-213)...\n";
    $largeString = str_repeat('A', 17 * 1024); // 17 KB
    try {
        KylatDirective::renderIsland('LargeComponent', ['payload' => $largeString]);
        assert(false, "Harus melempar exception untuk props > 16 KB");
    } catch (RuntimeException $e) {
        assert(str_contains($e->getMessage(), 'KIL-213') || str_contains($e->getMessage(), '16 KB'), "Pesan error harus memuat batasan 16 KB");
        echo "   ✅ Pelanggaran KIL-213 berhasil dicegah: " . $e->getMessage() . "\n";
    }

    // 3. Uji Batch Call Controller & ActionRegistry dengan Otorisasi & Anti-Koersi
    echo "3. Menguji Keamanan Batch Call (Otorisasi & Strict Types Anti-Koersi)...\n";
    $cartActions = new SecureCartActions();
    ActionRegistry::register('SecureCartActions', $cartActions);

    $controller = new KylatBatchCallController();

    // Call 1: Valid
    // Call 2: Gagal koersi (qty diberi string "3" padahal int)
    // Call 3: Ditolak otorisasi (allowAccess = false)
    $payload = [
        'calls' => [
            [
                'id' => 'c1',
                'action' => 'SecureCartActions::add',
                'args' => ['itemId' => 'book_01', 'qty' => 3],
            ],
            [
                'id' => 'c2_coercion',
                'action' => 'SecureCartActions::add',
                'args' => ['itemId' => 'book_01', 'qty' => "3"], // String bukan int!
            ],
        ],
    ];

    $response = $controller->handle($payload);
    $res1 = $response['results'][0];
    assert($res1['id'] === 'c1' && $res1['ok'] === true, "c1 harus sukses");
    assert($res1['data']['total'] === 45000, "c1 total harus 45000");

    $res2 = $response['results'][1];
    assert($res2['id'] === 'c2_coercion' && $res2['ok'] === false, "c2 harus ditolak karena string '3' ke int");
    assert($res2['error']['type'] === 'kylat:validation', "c2 error type harus kylat:validation");
    echo "   ✅ Strict types tanpa koersi berhasil menolak string ke integer.\n";

    // Uji Otorisasi Deny
    $cartActions->allowAccess = false;
    $authDenyResponse = $controller->handle([
        'calls' => [
            [
                'id' => 'c3_unauthorized',
                'action' => 'SecureCartActions::add',
                'args' => ['itemId' => 'book_01', 'qty' => 1],
            ],
        ],
    ]);
    $res3 = $authDenyResponse['results'][0];
    assert($res3['ok'] === false && $res3['error']['type'] === 'kylat:unauthorized', "Harus ditolak dengan kylat:unauthorized");
    echo "   ✅ Default-deny otorisasi berhasil menolak aksi tanpa izin.\n";

    echo "\n🎉 SEMUA PENGUJIAN ADAPTER LARAVEL SUKSES 100%!\n";
}

runTests();
