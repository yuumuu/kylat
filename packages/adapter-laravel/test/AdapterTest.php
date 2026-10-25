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

// Mock kelas aksi untuk pengujian
final class MockCartActions
{
    public function add(string $itemId, int $qty): array
    {
        return [
            'status' => 'added',
            'itemId' => $itemId,
            'qty' => $qty,
            'total' => $qty * 15000,
        ];
    }

    public function remove(string $itemId): bool
    {
        return true;
    }
}

function runTests(): void
{
    echo "=== PENGUJIAN ADAPTER LARAVEL KYLAT ===\n\n";

    // 1. Uji KylatDirective::renderIsland
    echo "1. Menguji KylatDirective::renderIsland...\n";
    $markup = KylatDirective::renderIsland('Counter', ['initialCount' => 5]);
    assert(str_contains($markup, 'data-island="Counter"'), "Markup harus memuat data-island='Counter'");
    assert(str_contains($markup, 'data-props="{&quot;initialCount&quot;:5}"'), "Markup harus memuat JSON hex/quote escaped data-props");
    assert(str_contains($markup, '<!-- kylat:Counter -->'), "Markup harus memuat anchor comment");
    echo "   ✅ Render island valid berhasil.\n";

    // 2. Uji batasan data-props 16 KB (KIL-212)
    echo "2. Menguji batasan data-props > 16 KB...\n";
    $largeString = str_repeat('A', 17 * 1024); // 17 KB
    try {
        KylatDirective::renderIsland('LargeComponent', ['payload' => $largeString]);
        assert(false, "Harus melempar exception untuk props > 16 KB");
    } catch (RuntimeException $e) {
        assert(str_contains($e->getMessage(), 'KIL-212'), "Pesan error harus memuat KIL-212");
        echo "   ✅ Pelanggaran KIL-212 berhasil dicegah: " . $e->getMessage() . "\n";
    }

    // 3. Uji Batch Call Controller & ActionRegistry
    echo "3. Menguji KylatBatchCallController & ActionRegistry...\n";
    ActionRegistry::register('MockCartActions', new MockCartActions());

    $controller = new KylatBatchCallController();

    $payload = [
        'calls' => [
            [
                'id' => 'c1',
                'action' => 'MockCartActions::add',
                'args' => ['itemId' => 'book_01', 'qty' => 3],
            ],
            [
                'id' => 'c2',
                'action' => 'MockCartActions::remove',
                'args' => ['itemId' => 'book_01'],
            ],
            [
                'id' => 'c3',
                'action' => 'MockCartActions::nonExistent',
                'args' => [],
            ],
            [
                'id' => 'c4',
                'action' => 'UnknownContract::doSomething',
                'args' => [],
            ],
        ],
    ];

    $response = $controller->handle($payload);
    assert(isset($response['results']) && count($response['results']) === 4, "Response harus memiliki 4 results");

    $res1 = $response['results'][0];
    assert($res1['id'] === 'c1' && $res1['ok'] === true, "c1 harus sukses");
    assert($res1['data']['total'] === 45000, "c1 kalkulasi total harus benar (45000)");

    $res2 = $response['results'][1];
    assert($res2['id'] === 'c2' && $res2['ok'] === true && $res2['data'] === true, "c2 harus sukses true");

    $res3 = $response['results'][2];
    assert($res3['id'] === 'c3' && $res3['ok'] === false, "c3 method tidak ada harus gagal");
    assert($res3['error']['type'] === 'kylat:not_found', "c3 type error harus kylat:not_found");

    $res4 = $response['results'][3];
    assert($res4['id'] === 'c4' && $res4['ok'] === false, "c4 kontrak tidak ada harus gagal");
    assert($res4['error']['type'] === 'kylat:not_found', "c4 type error harus kylat:not_found");

    echo "   ✅ Batch dispatch 4 calls (sukses & failure handling) lulus 100%.\n";

    echo "\n🎉 SEMUA PENGUJIAN ADAPTER LARAVEL SUKSES 100%!\n";
}

runTests();
