<?php

declare(strict_types=1);

namespace Kylat\Laravel\Tests;

require_once __DIR__ . '/../src/Support/DatabaseIdempotencyStore.php';

use PDO;
use RuntimeException;

/**
 * Uji konkurensi idempotensi database dengan MySQL/PostgreSQL nyata.
 *
 * Tes ini memakai dua proses PHP terpisah (proc_open) agar tidak bergantung
 * pada pcntl. Set env berikut untuk mengaktifkan:
 *
 *   KYLAT_TEST_MYSQL_DSN, KYLAT_TEST_MYSQL_USER, KYLAT_TEST_MYSQL_PASSWORD
 *   KYLAT_TEST_PG_DSN,    KYLAT_TEST_PG_USER,    KYLAT_TEST_PG_PASSWORD
 *
 * Tanpa env, tes akan menampilkan SKIP dan keluar 0. Uji logika SQLite
 * ditangani DatabaseIdempotencyTest; SQLite tidak dipakai untuk membuktikan
 * row-level lock.
 */

function ccCheck(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('GAGAL CONCURRENCY: ' . $message);
    }
}

function ccKeyColumn(string $driver): string
{
    return $driver === 'mysql' ? '`key`' : '"key"';
}

function ccSchema(PDO $pdo, string $driver): void
{
    $pdo->exec('DROP TABLE IF EXISTS kylat_test_executions');
    $pdo->exec('DROP TABLE IF EXISTS kylat_idempotency_keys');

    $key = ccKeyColumn($driver);

    if ($driver === 'mysql') {
        $pdo->exec(
            "CREATE TABLE kylat_idempotency_keys (
                user_id VARCHAR(255) NOT NULL,
                {$key} VARCHAR(128) NOT NULL,
                action VARCHAR(255) NOT NULL,
                payload_hash CHAR(64) NOT NULL,
                status VARCHAR(20) NOT NULL,
                response MEDIUMTEXT NULL,
                attempts INT NOT NULL DEFAULT 1,
                locked_until DATETIME NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY (user_id, {$key})
            ) ENGINE=InnoDB"
        );
        $pdo->exec(
            'CREATE TABLE kylat_test_executions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                note VARCHAR(64) NOT NULL
            ) ENGINE=InnoDB'
        );

        return;
    }

    $pdo->exec(
        "CREATE TABLE kylat_idempotency_keys (
            user_id VARCHAR(255) NOT NULL,
            {$key} VARCHAR(128) NOT NULL,
            action VARCHAR(255) NOT NULL,
            payload_hash CHAR(64) NOT NULL,
            status VARCHAR(20) NOT NULL,
            response TEXT NULL,
            attempts INT NOT NULL DEFAULT 1,
            locked_until TIMESTAMP NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL,
            PRIMARY KEY (user_id, {$key})
        )"
    );
    $pdo->exec(
        'CREATE TABLE kylat_test_executions (
            id SERIAL PRIMARY KEY,
            note VARCHAR(64) NOT NULL
        )'
    );
}

function ccCountExecutions(PDO $pdo): int
{
    return (int) $pdo->query('SELECT COUNT(*) FROM kylat_test_executions')->fetchColumn();
}

function ccCountKeyRows(PDO $pdo, string $driver, string $identity, string $key): int
{
    $column = ccKeyColumn($driver);
    $statement = $pdo->prepare(
        "SELECT COUNT(*) FROM kylat_idempotency_keys WHERE user_id = ? AND {$column} = ?"
    );
    $statement->execute([$identity, $key]);

    return (int) $statement->fetchColumn();
}

/** @return array{0: resource, 1: array<int, resource>} */
function ccStartWorker(
    string $dsn,
    string $user,
    string $password,
    string $identity,
    string $key,
    string $hash,
    string $mode = 'ok',
    int $sleepMs = 0
): array {
    $command = [
        PHP_BINARY,
        __DIR__ . '/ConcurrencyWorker.php',
        $dsn,
        $user,
        $password,
        $identity,
        $key,
        $hash,
        $mode,
        (string) $sleepMs,
    ];

    $descriptors = [
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    $process = proc_open($command, $descriptors, $pipes);
    if (!is_resource($process)) {
        throw new RuntimeException('Gagal menjalankan worker konkurensi.');
    }

    return [$process, $pipes];
}

/** @param array{0: resource, 1: array<int, resource>} $handle */
function ccFinishWorker(array $handle): array
{
    [$process, $pipes] = $handle;

    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exitCode = proc_close($process);

    $decoded = json_decode(trim((string) $stdout), true);
    if (!is_array($decoded)) {
        throw new RuntimeException(
            sprintf(
                'Output worker bukan JSON (exit %d). stdout: %s stderr: %s',
                $exitCode,
                trim((string) $stdout),
                trim((string) $stderr)
            )
        );
    }

    return $decoded;
}

function ccRunWorker(
    string $dsn,
    string $user,
    string $password,
    string $identity,
    string $key,
    string $hash,
    string $mode = 'ok',
    int $sleepMs = 0
): array {
    return ccFinishWorker(
        ccStartWorker($dsn, $user, $password, $identity, $key, $hash, $mode, $sleepMs)
    );
}

function ccRunSuite(string $label, PDO $pdo, string $driver, string $dsn, string $user, string $password): void
{
    echo "  {$label} ({$driver})...\n";

    ccSchema($pdo, $driver);

    $identity = 'user:1';
    $key = 'cc_' . bin2hex(random_bytes(6));
    $hash = str_repeat('a', 64);

    // 1. Dua worker paralel dengan identity/key/hash sama.
    $first = ccStartWorker($dsn, $user, $password, $identity, $key, $hash, 'ok', 400);
    $second = ccStartWorker($dsn, $user, $password, $identity, $key, $hash, 'ok', 400);
    $resultA = ccFinishWorker($first);
    $resultB = ccFinishWorker($second);

    $statuses = [$resultA['status'] ?? 'error', $resultB['status'] ?? 'error'];
    sort($statuses);

    ccCheck(in_array('completed', $statuses, true), 'satu worker paralel harus completed, dapat: ' . implode(',', $statuses));
    $other = $statuses[0] === 'completed' ? $statuses[1] : $statuses[0];
    ccCheck(
        in_array($other, ['replay', 'in_progress'], true),
        'worker paralel kedua harus replay/in_progress, dapat: ' . $other
        . ' | worker A: ' . json_encode($resultA)
        . ' | worker B: ' . json_encode($resultB)
    );
    ccCheck(ccCountExecutions($pdo) === 1, 'handler paralel harus dieksekusi tepat 1 kali, dapat: ' . ccCountExecutions($pdo));
    echo "    - 2 worker paralel: 1 completed + 1 {$other}, eksekusi=1.\n";

    // 2. Replay setelah completed.
    $replay = ccRunWorker($dsn, $user, $password, $identity, $key, $hash);
    ccCheck($replay['status'] === 'replay', 'panggilan ketiga harus replay, dapat: ' . ($replay['status'] ?? 'error'));
    ccCheck(ccCountExecutions($pdo) === 1, 'replay tidak boleh mengeksekusi handler lagi');
    echo "    - replay setelah completed: eksekusi tetap 1.\n";

    // 3. Konflik hash.
    $conflict = ccRunWorker($dsn, $user, $password, $identity, $key, str_repeat('b', 64));
    ccCheck($conflict['status'] === 'conflict', 'hash berbeda harus conflict, dapat: ' . ($conflict['status'] ?? 'error'));
    ccCheck(ccCountExecutions($pdo) === 1, 'konflik tidak boleh mengeksekusi handler');
    echo "    - hash berbeda: conflict, eksekusi tetap 1.\n";

    // 4. Identity berbeda dengan key sama harus independen.
    $independent = ccRunWorker($dsn, $user, $password, 'user:2', $key, $hash);
    ccCheck($independent['status'] === 'completed', 'identity berbeda harus completed, dapat: ' . ($independent['status'] ?? 'error'));
    ccCheck(ccCountExecutions($pdo) === 2, 'identity berbeda harus mengeksekusi handler sekali lagi');
    echo "    - identity berbeda, key sama: completed independen, eksekusi=2.\n";

    // 5. Exception handler harus rollback penuh, lalu retry berhasil.
    $rollbackKey = 'cc_rollback_' . bin2hex(random_bytes(6));
    $crashed = ccRunWorker($dsn, $user, $password, $identity, $rollbackKey, $hash, 'throw');
    ccCheck(($crashed['ok'] ?? true) === false, 'worker mode throw harus melaporkan kegagalan');
    ccCheck(
        ccCountKeyRows($pdo, $driver, $identity, $rollbackKey) === 0,
        'baris idempotensi harus rollback setelah exception'
    );
    ccCheck(ccCountExecutions($pdo) === 2, 'exception tidak boleh menambah eksekusi');

    $retry = ccRunWorker($dsn, $user, $password, $identity, $rollbackKey, $hash);
    ccCheck($retry['status'] === 'completed', 'retry setelah rollback harus completed, dapat: ' . ($retry['status'] ?? 'error'));
    ccCheck(ccCountExecutions($pdo) === 3, 'retry harus mengeksekusi handler tepat 1 kali');
    echo "    - crash rollback: baris hilang, retry sukses, eksekusi=3.\n";

    echo "  ✅ {$label} lulus.\n";
}

echo "=== UJI KONKURENSI IDEMPOTENSI DATABASE (MySQL/PostgreSQL) ===\n\n";

$suites = [
    ['MySQL', 'KYLAT_TEST_MYSQL_DSN', 'KYLAT_TEST_MYSQL_USER', 'KYLAT_TEST_MYSQL_PASSWORD'],
    ['PostgreSQL', 'KYLAT_TEST_PG_DSN', 'KYLAT_TEST_PG_USER', 'KYLAT_TEST_PG_PASSWORD'],
];

$ran = 0;

foreach ($suites as [$label, $dsnEnv, $userEnv, $passwordEnv]) {
    $dsn = getenv($dsnEnv);
    if (!is_string($dsn) || $dsn === '') {
        echo "  SKIP {$label}: {$dsnEnv} tidak diatur.\n";
        continue;
    }

    $user = (string) (getenv($userEnv) ?: '');
    $password = (string) (getenv($passwordEnv) ?: '');

    try {
        $pdo = new PDO($dsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (Throwable $exception) {
        throw new RuntimeException("Tidak dapat terhubung ke {$label}: " . $exception->getMessage(), 0, $exception);
    }

    ccRunSuite($label, $pdo, (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME), $dsn, $user, $password);
    $ran++;
}

if ($ran === 0) {
    echo "\n⚠️  SKIP: tidak ada database nyata yang dikonfigurasi.\n";
    echo "   Uji konkurensi MySQL/PostgreSQL TIDAK dijalankan. Set env KYLAT_TEST_*_DSN untuk menjalankan.\n";
    echo "\n✅ Selesai (tanpa klaim konkurensi).\n";
    exit(0);
}

echo "\n🎉 Uji konkurensi database nyata lulus ({$ran} target).\n";
