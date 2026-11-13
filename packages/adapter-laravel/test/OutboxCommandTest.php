<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/Support/OutboxRelay.php';
require_once __DIR__ . '/../src/Support/OutboxRelayRunner.php';
require_once __DIR__ . '/../src/Support/OutboxHandlerRegistry.php';

use Kylat\Laravel\Support\OutboxHandlerRegistry;
use Kylat\Laravel\Support\OutboxRelayRunner;

function ocCheck(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('GAGAL OUTBOX COMMAND: ' . $message);
    }
}

function ocNow(int $offset = 0): string
{
    return date('Y-m-d H:i:s', time() + $offset);
}

function ocInsert(PDO $pdo, string $eventId, string $type, array $payload): void
{
    $now = ocNow();
    $pdo->prepare(
        'INSERT INTO kylat_outbox
         (event_id, event_type, payload, status, attempts, available_at, locked_until, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, NULL, ?, ?)'
    )->execute([$eventId, $type, json_encode($payload, JSON_THROW_ON_ERROR), 'pending', ocNow(-1), $now, $now]);
}

$pdo = new PDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
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

$registry = new OutboxHandlerRegistry();
$received = [];
$registry->register('order.created', function (array $payload, array $event) use (&$received): void {
    $received[] = ['payload' => $payload, 'event_id' => $event['event_id']];
});

ocInsert($pdo, 'evt-1', 'order.created', ['orderId' => 10]);
ocInsert($pdo, 'evt-2', 'order.created', ['orderId' => 11]);

$runner = new OutboxRelayRunner($pdo, $registry, 3, 60);
$processed = $runner->run(10);

ocCheck($processed === 2, 'dua event harus diproses, dapat: ' . $processed);
ocCheck(count($received) === 2, 'handler harus dipanggil dua kali');
ocCheck($received[0]['payload']['orderId'] === 10, 'payload pertama harus diteruskan');
ocCheck($received[0]['event_id'] === 'evt-1', 'event_id harus diteruskan untuk deduplikasi');

$completed = (int) $pdo->query("SELECT COUNT(*) FROM kylat_outbox WHERE status = 'completed'")->fetchColumn();
ocCheck($completed === 2, 'semua event harus completed');

// Handler tidak terdaftar -> failure + retry -> failed setelah maxAttempts=1.
ocInsert($pdo, 'evt-unknown', 'unknown.event', ['x' => 1]);
$failing = new OutboxRelayRunner($pdo, $registry, 1, 60);
ocCheck($failing->run(10) === 1, 'event unknown harus diproses sebagai kegagalan');

$row = $pdo->query("SELECT status, last_error FROM kylat_outbox WHERE event_id = 'evt-unknown'")->fetch();
ocCheck($row['status'] === 'failed', 'event unknown harus failed, dapat: ' . $row['status']);
ocCheck(str_contains((string) $row['last_error'], 'belum terdaftar'), 'last_error harus menyebut handler belum terdaftar');

// Batas maxEvents dihormati.
for ($i = 0; $i < 3; $i++) {
    ocInsert($pdo, 'evt-limit-' . $i, 'order.created', ['orderId' => 100 + $i]);
}
$limited = new OutboxRelayRunner($pdo, $registry, 3, 60);
$count = $limited->run(2);
ocCheck($count === 2, 'maxEvents harus membatasi ke 2, dapat: ' . $count);
$pending = (int) $pdo->query("SELECT COUNT(*) FROM kylat_outbox WHERE event_id LIKE 'evt-limit-%' AND status = 'pending'")->fetchColumn();
ocCheck($pending === 1, 'satu event harus tersisa pending, dapat: ' . $pending);

echo "Outbox command/runner tests: OK\n";
