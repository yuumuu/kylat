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
require_once __DIR__ . '/../src/Support/IdempotencyStore.php';
require_once __DIR__ . '/../src/Http/Controllers/KylatBatchCallController.php';
require_once __DIR__ . '/../src/Blade/KylatDirective.php';
require_once __DIR__ . '/../../../examples/counter-app/CounterActions.php';

use App\Actions\CounterActions;
use Kylat\Laravel\Actions\ActionRegistry;
use Kylat\Laravel\Blade\KylatDirective;
use Kylat\Laravel\Http\Controllers\KylatBatchCallController;
use Kylat\Laravel\Support\IdempotencyStore;
use RuntimeException;

/**
 * Helper assertion independen dari konfigurasi zend.assertions php.ini.
 * Selalu melempar RuntimeException saat kondisi bernilai false.
 */
function assertTrue(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException("GAGAL PENGUJIAN: {$message}");
    }
}

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
    assertTrue(str_contains($markup, 'data-island="Counter"'), "Markup harus memuat data-island='Counter'");
    assertTrue(str_contains($markup, 'data-props="{&quot;initialCount&quot;:5}"'), "Markup harus memuat JSON hex/quote escaped data-props");
    echo "   ✅ Render island valid berhasil.\n";

    // 2. Uji batasan data-props 16 KB (KIL-213)
    echo "2. Menguji batasan data-props > 16 KB (KIL-213)...\n";
    $largeString = str_repeat('A', 17 * 1024); // 17 KB
    try {
        KylatDirective::renderIsland('LargeComponent', ['payload' => $largeString]);
        assertTrue(false, "Harus melempar exception untuk props > 16 KB");
    } catch (RuntimeException $e) {
        assertTrue(str_contains($e->getMessage(), 'KIL-213') || str_contains($e->getMessage(), '16 KB'), "Pesan error harus memuat batasan 16 KB");
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
                'idempotencyKey' => 'idemp_auth_guard',
            ],
        ],
    ]);
    assertTrue($authRes['results'][0]['ok'] === false, "Default deny harus menolak aksi tanpa izin");
    assertTrue($authRes['results'][0]['error']['type'] === 'kylat:unauthorized', "Error type harus kylat:unauthorized");
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
                'idempotencyKey' => 'idemp_coerce_guard',
            ],
        ],
    ]);
    assertTrue($coerceRes['results'][0]['ok'] === false, "String '5' harus ditolak untuk parameter int");
    assertTrue($coerceRes['results'][0]['error']['type'] === 'kylat:validation', "Error type harus kylat:validation");
    echo "   ✅ Parameter string '5' untuk int berhasil ditolak dengan kylat:validation.\n";

    // 3c. Method tidak ada di kontrak
    $missingRes = $controller->handle([
        'calls' => [
            [
                'id' => 'c_missing',
                'action' => 'CounterActions::unknownMethod',
                'args' => [],
                'idempotencyKey' => 'idemp_missing_guard',
            ],
        ],
    ]);
    assertTrue($missingRes['results'][0]['ok'] === false, "Method tidak ada harus ditolak");
    assertTrue($missingRes['results'][0]['error']['type'] === 'kylat:not_found', "Error type harus kylat:not_found");
    echo "   ✅ Method di luar kontrak berhasil ditolak dengan kylat:not_found.\n";

    // 3d. Magic Method ditolak keras
    $magicRes = $controller->handle([
        'calls' => [
            [
                'id' => 'c_magic',
                'action' => 'CounterActions::__destruct',
                'args' => [],
                'idempotencyKey' => 'idemp_magic_guard',
            ],
        ],
    ]);
    assertTrue($magicRes['results'][0]['ok'] === false, "Magic method wajib ditolak");
    assertTrue($magicRes['results'][0]['error']['type'] === 'kylat:forbidden', "Error type harus kylat:forbidden");
    echo "   ✅ Magic method berhasil dicegah dengan kylat:forbidden.\n";

    // 3e. Invarian Dokumen 3 §4: Mutasi tanpa Idempotency-Key WAJIB DITOLAK
    $noKeyRes = $controller->handle([
        'calls' => [
            [
                'id' => 'c_no_key',
                'action' => 'CounterActions::saveCount',
                'args' => ['count' => 10],
                // TIDAK ADA idempotencyKey!
            ],
        ],
    ]);
    assertTrue($noKeyRes['results'][0]['ok'] === false, "Mutasi tanpa idempotency key wajib ditolak");
    assertTrue($noKeyRes['results'][0]['error']['type'] === 'kylat:validation', "Error type harus kylat:validation");
    assertTrue(str_contains($noKeyRes['results'][0]['error']['message'], 'wajib menyertakan Idempotency-Key'), "Pesan error harus mewajibkan Idempotency-Key");
    echo "   ✅ Invarian Dokumen 3 §4 terkonfirmasi: mutasi tanpa Idempotency-Key ditolak server.\n";

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

    assertTrue($call1['results'][0]['ok'] === true, "Panggilan pertama harus berhasil");
    assertTrue($counterActions->executionCount === 1, "Handler fisik harus dieksekusi 1 kali");
    assertTrue($counterActions->lastSavedCount === 7, "Nilai count tersimpan harus 7");

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

    assertTrue($call2['results'][0]['ok'] === true, "Panggilan kedua harus mengembalikan response sukses identik");
    assertTrue($call2['results'][0]['id'] === 'click_2', "ID panggilan disesuaikan");
    assertTrue(
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
    assertTrue($conflictCall['results'][0]['ok'] === false, "Key sama dengan payload berbeda harus ditolak");
    assertTrue(
        $conflictCall['results'][0]['error']['type'] === 'kylat:idempotency_conflict',
        "Error type harus 'kylat:idempotency_conflict'"
    );
    assertTrue(
        str_contains($conflictCall['results'][0]['error']['message'], 'payload yang berbeda'),
        "Pesan error harus menjelaskan konflik payload"
    );
    assertTrue($counterActions->lastSavedCount === 7, "Nilai di server tidak boleh berubah saat konflik");
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
    assertTrue($failedCall1['results'][0]['ok'] === false, "Panggilan pertama harus gagal validasi");
    assertTrue($failedCall1['results'][0]['error']['type'] === 'kylat:validation', "Error type harus kylat:validation");

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
    assertTrue($conflictCall2['results'][0]['ok'] === false, "Key sama dengan payload baru harus ditolak");
    assertTrue(
        $conflictCall2['results'][0]['error']['type'] === 'kylat:idempotency_conflict',
        "Error type harus 'kylat:idempotency_conflict' meskipun request pertama gagal"
    );
    echo "   ✅ Key yang sama setelah panggilan gagal tetap menolak payload baru dengan kylat:idempotency_conflict.\n";

    // 7. Uji Kanonikalisasi JSON: Urutan key berbeda tetap dianggap payload identik
    echo "7. Menguji Kanonikalisasi JSON Payload Hashing (Kekebalan Urutan Key)...\n";
    $canonKey = "idemp_canon_" . uniqid();
    
    // Hash langsung dengan urutan berbeda
    $hash1 = IdempotencyStore::computeCanonicalHash('CartActions::add', ['productId' => 'P1', 'qty' => 3]);
    $hash2 = IdempotencyStore::computeCanonicalHash('CartActions::add', ['qty' => 3, 'productId' => 'P1']);
    assertTrue($hash1 === $hash2, "Hash kanonik harus identik meski urutan key berbeda!");

    // Eksekusi via controller
    $canonCall1 = $controller->handle([
        'calls' => [
            [
                'id' => 'canon_1',
                'action' => 'CounterActions::saveCount',
                'args' => ['count' => 42],
                'idempotencyKey' => $canonKey,
            ],
        ],
    ]);
    assertTrue($canonCall1['results'][0]['ok'] === true, "Panggilan pertama harus sukses");

    // Panggilan kedua dengan payload berurutan sama
    $canonCall2 = $controller->handle([
        'calls' => [
            [
                'id' => 'canon_2',
                'action' => 'CounterActions::saveCount',
                'args' => ['count' => 42],
                'idempotencyKey' => $canonKey,
            ],
        ],
    ]);
    assertTrue($canonCall2['results'][0]['ok'] === true, "Panggilan kedua harus mengembalikan respons yang sama");
    assertTrue($canonCall2['results'][0]['id'] === 'canon_2', "ID panggilan disesuaikan");
    echo "   ✅ Kanonikalisasi JSON terbukti: hash payload konsisten dan kebal terhadap variasi urutan key.\n";

    // 8. Uji Race Condition: Permintaan kedua saat status in_progress ditolak dengan kylat:in_progress
    echo "8. Menguji Anti Race-Condition (Permintaan saat in_progress ditolak kylat:in_progress)...\n";
    $raceKey = "idemp_race_" . uniqid();
    $raceHash = IdempotencyStore::computeCanonicalHash('CounterActions::saveCount', ['count' => 100]);
    
    // Kunci manual sebagai in_progress seolah sedang dieksekusi proses paralel
    $lockRes = IdempotencyStore::acquire($raceKey, $raceHash);
    assertTrue($lockRes['status'] === 'acquired', "Kunci pertama berhasil diperoleh");

    // Request masuk saat masih in_progress
    $raceCall = $controller->handle([
        'calls' => [
            [
                'id' => 'race_click_2',
                'action' => 'CounterActions::saveCount',
                'args' => ['count' => 100],
                'idempotencyKey' => $raceKey,
            ],
        ],
    ]);
    assertTrue($raceCall['results'][0]['ok'] === false, "Panggilan paralel harus ditolak");
    assertTrue(
        $raceCall['results'][0]['error']['type'] === 'kylat:in_progress',
        "Error type harus 'kylat:in_progress'"
    );
    echo "   ✅ Race condition klik ganda berhasil dicegah dengan penolakan kylat:in_progress.\n";

    // 9. Verifikasi TTL 24 Jam
    echo "9. Menguji Batas TTL Idempotensi 24 Jam (Threat Model §3 A4)...\n";
    assertTrue(IdempotencyStore::DEFAULT_TTL_SECONDS === 86400, "TTL default wajib 86.400 detik (24 jam)");
    echo "   ✅ TTL idempotensi terkonfirmasi 24 jam (86.400 detik).\n";

    echo "\n🎉 SEMUA PENGUJIAN ADAPTER LARAVEL SUKSES 100% DENGAN STRICT ASSERTIONS!\n";
}

runTests();
