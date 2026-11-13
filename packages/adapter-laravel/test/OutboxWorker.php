<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/Support/OutboxRelay.php';

use Kylat\Laravel\Support\OutboxRelay;

/**
 * Worker relay outbox untuk uji konkurensi MySQL/PostgreSQL.
 *
 * Argumen: dsn, user, password, maxEvents.
 * Handler menulis event_id ke kylat_test_executions (UNIQUE) agar eksekusi
 * ganda langsung terdeteksi sebagai pelanggaran unique.
 */

$dsn = $argv[1] ?? '';
$user = $argv[2] ?? '';
$password = $argv[3] ?? '';
$maxEvents = (int) ($argv[4] ?? 1000);

try {
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $relay = new OutboxRelay($pdo);
    $processed = 0;

    $relay->run(
        function (array $event) use ($pdo, &$processed): void {
            $pdo->prepare('INSERT INTO kylat_test_executions (note) VALUES (?)')
                ->execute([$event['event_id']]);
            $processed++;
        },
        $maxEvents
    );

    echo json_encode(['ok' => true, 'processed' => $processed]), "\n";
} catch (Throwable $exception) {
    echo json_encode(['ok' => false, 'error' => $exception->getMessage()]), "\n";
}
