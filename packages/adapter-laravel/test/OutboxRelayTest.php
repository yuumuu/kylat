<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/Support/DatabaseIdempotencyStore.php';
require_once __DIR__ . '/../src/Support/OutboxRelay.php';

use Kylat\Laravel\Support\DatabaseIdempotencyStore;
use Kylat\Laravel\Support\OutboxRelay;

/**
 * Uji OutboxRelay:
 * - logika klaim/complete/fail/backoff/invalid payload dengan SQLite;
 * - klaim paralel FOR UPDATE SKIP LOCKED pada MySQL/PostgreSQL nyata
 *   (aktif bila env KYLAT_TEST_*_DSN diatur).
 */

function obCheck(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('GAGAL OUTBOX: ' . $message);
    }
}

function obNow(int $offset = 0): string
{
    return date('Y-m-d H:i:s', time() + $offset);
}

function obSchemaSqlite(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE kylat_idempotency_keys (
        user_id TEXT NOT NULL,
        "key" TEXT NOT NULL,
        action TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        response TEXT NULL,
        attempts INTEGER NOT NULL DEFAULT 1,
        locked_until TEXT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, "key")
    )');
    $pdo->exec('CREATE TABLE kylat_outbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT "pending",
        attempts INTEGER NOT NULL DEFAULT 0,
        available_at TEXT NOT NULL,
        locked_until TEXT NULL,
        last_error TEXT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )');
}

function obSchemaReal(PDO $pdo, string $driver): void
{
    $pdo->exec('DROP TABLE IF EXISTS kylat_test_executions');
    $pdo->exec('DROP TABLE IF EXISTS kylat_outbox');

    if ($driver === 'mysql') {
        $pdo->exec(
            "CREATE TABLE kylat_outbox (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                event_id CHAR(36) NOT NULL UNIQUE,
                event_type VARCHAR(128) NOT NULL,
                payload MEDIUMTEXT NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                attempts INT NOT NULL DEFAULT 0,
                available_at DATETIME NOT NULL,
                locked_until DATETIME NULL,
                last_error TEXT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                INDEX idx_outbox_status_available (status, available_at)
            ) ENGINE=InnoDB"
        );
        $pdo->exec(
            'CREATE TABLE kylat_test_executions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                note VARCHAR(64) NOT NULL UNIQUE
            ) ENGINE=InnoDB'
        );

        return;
    }

    $pdo->exec(
        "CREATE TABLE kylat_outbox (
            id BIGSERIAL PRIMARY KEY,
            event_id CHAR(36) NOT NULL UNIQUE,
            event_type VARCHAR(128) NOT NULL,
            payload TEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            attempts INT NOT NULL DEFAULT 0,
            available_at TIMESTAMP NOT NULL,
            locked_until TIMESTAMP NULL,
            last_error TEXT NULL,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
        )"
    );
    $pdo->exec('CREATE INDEX idx_outbox_status_available ON kylat_outbox (status, available_at)');
    $pdo->exec(
        'CREATE TABLE kylat_test_executions (
            id SERIAL PRIMARY KEY,
            note VARCHAR(64) NOT NULL UNIQUE
        )'
    );
}

function obInsertEvent(PDO $pdo, string $eventId, string $type, string $payload, string $availableAt): void
{
    $now = obNow();
    $statement = $pdo->prepare(
        'INSERT INTO kylat_outbox
         (event_id, event_type, payload, status, attempts, available_at, locked_until, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, NULL, ?, ?)'
    );
    $statement->execute([$eventId, $type, $payload, 'pending', $availableAt, $now, $now]);
}

/** @return array{0: resource, 1: array<int, resource>} */
function obStartWorker(string $dsn, string $user, string $password, int $maxEvents = 1000): array
{
    $process = proc_open(
        [PHP_BINARY, __DIR__ . '/OutboxWorker.php', $dsn, $user, $password, (string) $maxEvents],
        [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes
    );

    if (!is_resource($process)) {
        throw new RuntimeException('Gagal menjalankan outbox worker.');
    }

    return [$process, $pipes];
}

/** @param array{0: resource, 1: array<int, resource>} $handle */
function obFinishWorker(array $handle): array
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
            sprintf('Output outbox worker bukan JSON (exit %d): %s %s', $exitCode, trim((string) $stdout), trim((string) $stderr))
        );
    }

    return $decoded;
}

function obSqliteSuite(): void
{
    echo "1. SQLite: logika relay...\n";

    $pdo = new PDO('sqlite::memory:', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    obSchemaSqlite($pdo);

    DatabaseIdempotencyStore::useConnection($pdo);
    DatabaseIdempotencyStore::execute(
        'user:1',
        'outbox-key-1',
        'OutboxTest::mutate',
        str_repeat('a', 64),
        function (): array {
            DatabaseIdempotencyStore::enqueueOutbox('test.created', ['n' => 1]);
            DatabaseIdempotencyStore::enqueueOutbox('test.created', ['n' => 2]);

            return ['ok' => true];
        }
    );
    DatabaseIdempotencyStore::reset();

    $relay = new OutboxRelay($pdo, 3, 60);
    $seen = [];
    $processed = $relay->run(function (array $event) use (&$seen): void {
        $seen[] = $event['payload']['n'];
    });

    obCheck($processed === 2, 'dua event harus diproses, dapat: ' . $processed);
    obCheck($seen === [1, 2], 'event harus diproses berurutan id, dapat: ' . json_encode($seen));

    $statuses = $pdo->query("SELECT status FROM kylat_outbox ORDER BY id")->fetchAll(PDO::FETCH_COLUMN);
    obCheck($statuses === ['completed', 'completed'], 'semua event harus completed, dapat: ' . json_encode($statuses));
    echo "   - enqueue -> claim -> complete: 2 event, handler 2x.\n";

    // Backoff setelah kegagalan.
    obInsertEvent($pdo, 'evt-fail-1', 'test.failed', '{"n":3}', obNow(-1));
    $failingRelay = new OutboxRelay($pdo, 3, 60);
    $attempts = 0;
    $failingRelay->run(function () use (&$attempts): void {
        $attempts++;
        throw new RuntimeException('boom');
    });

    $row = $pdo->query("SELECT status, attempts, last_error, available_at FROM kylat_outbox WHERE event_id = 'evt-fail-1'")->fetch();
    obCheck($row['status'] === 'pending', 'kegagalan belum final harus pending, dapat: ' . $row['status']);
    obCheck((int) $row['attempts'] === 1, 'attempts harus 1, dapat: ' . $row['attempts']);
    obCheck($row['last_error'] === 'boom', 'last_error harus menyimpan pesan, dapat: ' . $row['last_error']);
    obCheck(strtotime($row['available_at']) > time(), 'available_at harus di masa depan (backoff)');
    obCheck($attempts === 1, 'handler gagal dipanggil sekali');

    $immediate = $failingRelay->run(fn (): null => null);
    obCheck($immediate === 0, 'backoff harus menunda klaim berikutnya, dapat: ' . $immediate);

    $pdo->exec("UPDATE kylat_outbox SET available_at = '" . obNow(-1) . "' WHERE event_id = 'evt-fail-1'");
    $retried = $failingRelay->run(fn (): null => null);
    obCheck($retried === 1, 'retry setelah backoff harus memproses 1 event');

    $row = $pdo->query("SELECT status, attempts FROM kylat_outbox WHERE event_id = 'evt-fail-1'")->fetch();
    obCheck($row['status'] === 'completed', 'retry harus completed');
    obCheck((int) $row['attempts'] === 2, 'attempts harus 2 setelah retry, dapat: ' . $row['attempts']);
    echo "   - gagal -> pending + backoff -> retry completed (attempts=2).\n";

    // Batas percobaan.
    obInsertEvent($pdo, 'evt-fail-max', 'test.failed', '{"n":4}', obNow(-1));
    $maxRelay = new OutboxRelay($pdo, 1, 60);
    $maxRelay->run(function (): void {
        throw new RuntimeException('permanent');
    });

    $row = $pdo->query("SELECT status, last_error FROM kylat_outbox WHERE event_id = 'evt-fail-max'")->fetch();
    obCheck($row['status'] === 'failed', 'max attempts harus failed, dapat: ' . $row['status']);
    obCheck($row['last_error'] === 'permanent', 'last_error final harus tersimpan');
    echo "   - max attempts -> failed + last_error.\n";

    // Payload rusak tidak boleh sampai ke handler.
    obInsertEvent($pdo, 'evt-bad-json', 'test.bad', '{not-json', obNow(-1));
    $badCalls = 0;
    $badProcessed = $relay->run(function () use (&$badCalls): void {
        $badCalls++;
    });

    $row = $pdo->query("SELECT status, last_error FROM kylat_outbox WHERE event_id = 'evt-bad-json'")->fetch();
    obCheck($badProcessed === 0, 'payload rusak tidak boleh dihitung diproses, dapat: ' . $badProcessed);
    obCheck($badCalls === 0, 'handler tidak boleh dipanggil untuk payload rusak');
    obCheck($row['status'] === 'failed', 'payload rusak harus failed, dapat: ' . $row['status']);
    obCheck($row['last_error'] !== null, 'payload rusak harus menyimpan last_error');
    echo "   - payload rusak -> failed, handler tidak dipanggil.\n";

    echo "   ✅ SQLite relay lulus.\n";
}

function obRealSuite(string $label, string $dsn, string $user, string $password): void
{
    echo "2. {$label}: klaim paralel SKIP LOCKED...\n";

    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $driver = (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    obSchemaReal($pdo, $driver);

    $total = 20;
    for ($i = 0; $i < $total; $i++) {
        obInsertEvent(
            $pdo,
            'evt-' . $label . '-' . $i,
            'test.parallel',
            json_encode(['i' => $i], JSON_THROW_ON_ERROR),
            obNow(-1)
        );
    }

    $first = obStartWorker($dsn, $user, $password);
    $second = obStartWorker($dsn, $user, $password);
    $resultA = obFinishWorker($first);
    $resultB = obFinishWorker($second);

    obCheck(($resultA['ok'] ?? false) === true, 'worker A gagal: ' . json_encode($resultA));
    obCheck(($resultB['ok'] ?? false) === true, 'worker B gagal: ' . json_encode($resultB));

    $executions = (int) $pdo->query('SELECT COUNT(*) FROM kylat_test_executions')->fetchColumn();
    $distinct = (int) $pdo->query('SELECT COUNT(DISTINCT note) FROM kylat_test_executions')->fetchColumn();
    $completed = (int) $pdo->query("SELECT COUNT(*) FROM kylat_outbox WHERE status = 'completed'")->fetchColumn();
    $failed = (int) $pdo->query("SELECT COUNT(*) FROM kylat_outbox WHERE status IN ('failed', 'pending', 'processing')")->fetchColumn();

    obCheck($executions === $total, "eksekusi harus {$total}, dapat: {$executions}");
    obCheck($distinct === $total, "eksekusi harus unik {$total}, dapat: {$distinct}");
    obCheck($completed === $total, "completed harus {$total}, dapat: {$completed}");
    obCheck($failed === 0, "tidak boleh ada event tertinggal, dapat: {$failed}");

    $sum = (int) ($resultA['processed'] ?? 0) + (int) ($resultB['processed'] ?? 0);
    obCheck($sum === $total, "jumlah processed worker harus {$total}, dapat: {$sum}");

    echo "   - {$total} event, 2 worker, eksekusi unik={$distinct}, split={$resultA['processed']}+{$resultB['processed']}.\n";
    echo "   ✅ {$label} relay paralel lulus.\n";
}

echo "=== UJI OUTBOX RELAY ===\n\n";
obSqliteSuite();

$targets = [
    ['MySQL', 'KYLAT_TEST_MYSQL_DSN', 'KYLAT_TEST_MYSQL_USER', 'KYLAT_TEST_MYSQL_PASSWORD'],
    ['PostgreSQL', 'KYLAT_TEST_PG_DSN', 'KYLAT_TEST_PG_USER', 'KYLAT_TEST_PG_PASSWORD'],
];

$ran = 0;
foreach ($targets as [$label, $dsnEnv, $userEnv, $passwordEnv]) {
    $dsn = getenv($dsnEnv);
    if (!is_string($dsn) || $dsn === '') {
        echo "  SKIP {$label}: {$dsnEnv} tidak diatur.\n";
        continue;
    }

    obRealSuite($label, $dsn, (string) (getenv($userEnv) ?: ''), (string) (getenv($passwordEnv) ?: ''));
    $ran++;
}

if ($ran === 0) {
    echo "\n⚠️  SKIP relay paralel MySQL/PostgreSQL: env DSN tidak diatur.\n";
}

echo "\n🎉 UJI OUTBOX RELAY SELESAI.\n";
