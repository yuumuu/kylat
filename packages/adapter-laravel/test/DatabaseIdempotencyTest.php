<?php

declare(strict_types=1);

namespace Kylat\Laravel\Tests;

require_once __DIR__ . '/../src/Support/DatabaseIdempotencyStore.php';

use Kylat\Laravel\Support\DatabaseIdempotencyStore;
use PDO;
use RuntimeException;

function dbCheck(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('GAGAL DB: ' . $message);
    }
}

$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
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
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)');

DatabaseIdempotencyStore::useConnection($pdo);

$calls = 0;
$first = DatabaseIdempotencyStore::execute(
    'user:1',
    'idem-key-0001',
    'CounterActions::save',
    str_repeat('a', 64),
    function () use (&$calls): array {
        $calls++;
        DatabaseIdempotencyStore::enqueueOutbox('counter.saved', ['count' => 1]);
        return ['ok' => true, 'value' => 1];
    }
);
dbCheck($first['status'] === 'completed' && $calls === 1, 'eksekusi pertama harus completed');

$second = DatabaseIdempotencyStore::execute(
    'user:1',
    'idem-key-0001',
    'CounterActions::save',
    str_repeat('a', 64),
    function () use (&$calls): array {
        $calls++;
        return ['ok' => true, 'value' => 999];
    }
);
dbCheck($second['status'] === 'replay' && $calls === 1, 'replay tidak boleh mengeksekusi handler');
dbCheck(($second['response']['value'] ?? null) === 1, 'replay harus mengembalikan respons pertama');

$conflict = DatabaseIdempotencyStore::execute(
    'user:1',
    'idem-key-0001',
    'CounterActions::save',
    str_repeat('b', 64),
    fn (): array => ['ok' => true]
);
dbCheck($conflict['status'] === 'conflict', 'hash berbeda harus conflict');

$otherUser = DatabaseIdempotencyStore::execute(
    'user:2',
    'idem-key-0001',
    'CounterActions::save',
    str_repeat('a', 64),
    fn (): array => ['ok' => true, 'value' => 2]
);
dbCheck($otherUser['status'] === 'completed', 'pemanggil lain dengan key sama harus independen');

$failedResult = DatabaseIdempotencyStore::execute(
    'user:1',
    'idem-key-0003',
    'CounterActions::save',
    str_repeat('d', 64),
    fn (): array => ['ok' => false, 'error' => ['type' => 'kylat:unauthorized', 'message' => 'nope']]
);
dbCheck($failedResult['status'] === 'failed', 'handler ok=false harus mengembalikan status failed (rollback)');

$retryResult = DatabaseIdempotencyStore::execute(
    'user:1',
    'idem-key-0003',
    'CounterActions::save',
    str_repeat('d', 64),
    fn (): array => ['ok' => true, 'value' => 7]
);
dbCheck($retryResult['status'] === 'completed', 'retry setelah handler gagal harus berhasil');

$rolledBack = false;
try {
    DatabaseIdempotencyStore::execute(
        'user:1',
        'idem-key-0002',
        'CounterActions::save',
        str_repeat('c', 64),
        function (): array {
            DatabaseIdempotencyStore::enqueueOutbox('counter.saved', ['count' => 2]);
            throw new RuntimeException('boom');
        }
    );
} catch (RuntimeException $exception) {
    $rolledBack = $exception->getMessage() === 'boom';
}
dbCheck($rolledBack, 'exception handler harus diteruskan');
$rowCount = (int) $pdo->query("SELECT COUNT(*) FROM kylat_idempotency_keys WHERE \"key\" = 'idem-key-0002'")->fetchColumn();
$outboxCount = (int) $pdo->query("SELECT COUNT(*) FROM kylat_outbox")->fetchColumn();
dbCheck($rowCount === 0, 'baris idempotensi harus rollback');
dbCheck($outboxCount === 1, 'outbox dari transaksi yang berhasil tetap ada, yang rollback hilang');

echo "Database idempotency tests: OK\n";
