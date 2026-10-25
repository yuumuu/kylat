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
require_once __DIR__ . '/../../../examples/counter-app/CounterActions.php';

use App\Actions\CounterActions;
use Kylat\Laravel\Actions\ActionRegistry;
use Kylat\Laravel\Blade\KylatDirective;
use Kylat\Laravel\Http\Controllers\KylatBatchCallController;
use RuntimeException;

// Implementasi CounterActions dengan Default-Deny Otorisasi
final class CounterActionsImpl implements CounterActions
{
    public bool $authorized = false; // Default deny!
    public int $executionCount = 0;
    public int $lastSavedCount = 0;

    public function authorize(): bool
    {
        return $this->authorized;
    }

    public function saveCount(int $count): bool
    {
        $this->executionCount++;
        $this->lastSavedCount = $count;
        return true;
    }
}

function runTests(): void
{
    echo "=== PENGUJIAN ADAPTER LARAVEL KYLAT (DENGAN SECURITY AUDIT & IDEMPOTENCY) ===\n\n";

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

    // 3. Uji CounterActions (Default-Deny, Anti-Koersi, Non-Existent, Magic Methods)
    echo "3. Menguji CounterActions Sisi Server (Security Contracts)...\n";
    $counterActions = new CounterActionsImpl();
    ActionRegistry::register('CounterActions', $counterActions);

    $controller = new KylatBatchCallController();

    // 3a. Default-Deny Otorisasi (authorized = false)
    $authRes = $controller->handle([
        'calls' => [
            [
                'id' => 'c_auth',
                'action' => 'CounterActions::saveCount',
                'args' => ['count' => 10],
            ],
        ],
    ]);
    assert($authRes['results'][0]['ok'] === false, "Default deny harus menolak aksi tanpa izin");
    assert($authRes['results'][0]['error']['type'] === 'kylat:unauthorized', "Error type harus kylat:unauthorized");
    echo "   ✅ CounterActions default-deny otorisasi berhasil diverifikasi.\n";

    // Izinkan untuk pengujian fungsional berikutnya
    $counterActions->authorized = true;

    // 3b. Anti-Koersi Strict Types (String "5" untuk parameter int $count)
    $coerceRes = $controller->handle([
        'calls' => [
            [
                'id' => 'c_coerce',
                'action' => 'CounterActions::saveCount',
                'args' => ['count' => '5'], // String bukan integer!
            ],
        ],
    ]);
    assert($coerceRes['results'][0]['ok'] === false, "String '5' harus ditolak untuk parameter int");
    assert($coerceRes['results'][0]['error']['type'] === 'kylat:validation', "Error type harus kylat:validation");
    echo "   ✅ Parameter string '5' untuk int berhasil ditolak dengan kylat:validation.\n";

    // 3c. Method tidak ada di kontrak
    $missingRes = $controller->handle([
        'calls' => [
            [
                'id' => 'c_missing',
                'action' => 'CounterActions::unknownMethod',
                'args' => [],
            ],
        ],
    ]);
    assert($missingRes['results'][0]['ok'] === false, "Method tidak ada harus ditolak");
    assert($missingRes['results'][0]['error']['type'] === 'kylat:not_found', "Error type harus kylat:not_found");
    echo "   ✅ Method di luar kontrak berhasil ditolak dengan kylat:not_found.\n";

    // 3d. Magic Method ditolak keras
    $magicRes = $controller->handle([
        'calls' => [
            [
                'id' => 'c_magic',
                'action' => 'CounterActions::__destruct',
                'args' => [],
            ],
        ],
    ]);
    assert($magicRes['results'][0]['ok'] === false, "Magic method wajib ditolak");
    assert($magicRes['results'][0]['error']['type'] === 'kylat:forbidden', "Error type harus kylat:forbidden");
    echo "   ✅ Magic method berhasil dicegah dengan kylat:forbidden.\n";

    // 4. Uji Idempotency-Key untuk Mutasi saveCount
    echo "4. Menguji Idempotency-Key untuk Mutasi (Dua Klik Cegah Duplikasi)...\n";
    $idempKey = "idemp_test_" . uniqid();
    $counterActions->executionCount = 0;

    // Klik 1: Panggilan pertama dengan Idempotency-Key
    $call1 = $controller->handle([
        'calls' => [
            [
                'id' => 'click_1',
                'action' => 'CounterActions::saveCount',
                'args' => ['count' => 7],
                'idempotencyKey' => $idempKey,
            ],
        ],
    ]);

    assert($call1['results'][0]['ok'] === true, "Panggilan pertama harus berhasil");
    assert($counterActions->executionCount === 1, "Handler fisik harus dieksekusi 1 kali");
    assert($counterActions->lastSavedCount === 7, "Nilai count tersimpan harus 7");

    // Klik 2: Panggilan ganda dengan Idempotency-Key yang SAMA
    $call2 = $controller->handle([
        'calls' => [
            [
                'id' => 'click_2',
                'action' => 'CounterActions::saveCount',
                'args' => ['count' => 7],
                'idempotencyKey' => $idempKey,
            ],
        ],
    ]);

    assert($call2['results'][0]['ok'] === true, "Panggilan kedua harus mengembalikan response sukses identik");
    assert($call2['results'][0]['id'] === 'click_2', "ID panggilan disesuaikan");
    assert(
        $counterActions->executionCount === 1,
        "MUTASI DICEGAH: Handler fisik TIDAK BOLEH dieksekusi 2 kali untuk key yang sama!"
    );
    echo "   ✅ Idempotency-Key terverifikasi: 2 panggilan dengan key sama hanya mengeksekusi handler 1 kali di server.\n";

    // 5. Uji Konflik Idempotency: Key yang sama dipakai ulang dengan payload berbeda (KIL-A4)
    echo "5. Menguji Konflik Idempotency-Key dengan Payload Berbeda (kylat:idempotency_conflict)...\n";
    $conflictCall = $controller->handle([
        'calls' => [
            [
                'id' => 'click_conflict',
                'action' => 'CounterActions::saveCount',
                'args' => ['count' => 999], // Nilai berbeda dari panggilan sebelumnya (7)
                'idempotencyKey' => $idempKey,
            ],
        ],
    ]);
    assert($conflictCall['results'][0]['ok'] === false, "Key sama dengan payload berbeda harus ditolak");
    assert(
        $conflictCall['results'][0]['error']['type'] === 'kylat:idempotency_conflict',
        "Error type harus 'kylat:idempotency_conflict'"
    );
    assert(
        str_contains($conflictCall['results'][0]['error']['message'], 'payload yang berbeda'),
        "Pesan error harus menjelaskan konflik payload"
    );
    assert($counterActions->lastSavedCount === 7, "Nilai di server tidak boleh berubah saat konflik");
    echo "   ✅ kylat:idempotency_conflict berhasil dicegah saat payload berbeda dikirim dengan key yang sama.\n";

    // 6. Uji Kasus Claude: Panggilan pertama gagal, lalu user ubah angka dengan key yang sama
    echo "6. Menguji Kasus Gagal Pertama lalu Retry Payload Berbeda...\n";
    $failedKey = "idemp_fail_" . uniqid();
    
    // Panggilan pertama sengaja dibuat gagal (string bukan integer -> kylat:validation)
    $failedCall1 = $controller->handle([
        'calls' => [
            [
                'id' => 'call_fail_1',
                'action' => 'CounterActions::saveCount',
                'args' => ['count' => 'bukan_angka'],
                'idempotencyKey' => $failedKey,
            ],
        ],
    ]);
    assert($failedCall1['results'][0]['ok'] === false, "Panggilan pertama harus gagal validasi");
    assert($failedCall1['results'][0]['error']['type'] === 'kylat:validation');

    // Pengguna mengubah angka dan klik lagi memakai key yang sama
    $conflictCall2 = $controller->handle([
        'calls' => [
            [
                'id' => 'call_fail_2',
                'action' => 'CounterActions::saveCount',
                'args' => ['count' => 15],
                'idempotencyKey' => $failedKey,
            ],
        ],
    ]);
    assert($conflictCall2['results'][0]['ok'] === false, "Key sama dengan payload baru harus ditolak");
    assert(
        $conflictCall2['results'][0]['error']['type'] === 'kylat:idempotency_conflict',
        "Error type harus 'kylat:idempotency_conflict' meskipun request pertama gagal"
    );
    echo "   ✅ Key yang sama setelah panggilan gagal tetap menolak payload baru dengan kylat:idempotency_conflict.\n";

    echo "\n🎉 SEMUA PENGUJIAN ADAPTER LARAVEL SUKSES 100%!\n";
}

runTests();
