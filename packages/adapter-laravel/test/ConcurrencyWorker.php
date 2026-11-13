<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/Support/DatabaseIdempotencyStore.php';

use Kylat\Laravel\Support\DatabaseIdempotencyStore;

/**
 * Worker proses terpisah untuk uji konkurensi idempotensi database.
 *
 * Argumen:
 *   1. DSN PDO
 *   2. user (opsional)
 *   3. password (opsional)
 *   4. identity
 *   5. key
 *   6. payload hash
 *   7. mode: ok | throw
 *   8. sleep milliseconds (memperlebar jendela race)
 *
 * Output: satu baris JSON.
 */

$dsn = $argv[1] ?? '';
$user = $argv[2] ?? '';
$password = $argv[3] ?? '';
$identity = $argv[4] ?? '';
$key = $argv[5] ?? '';
$hash = $argv[6] ?? '';
$mode = $argv[7] ?? 'ok';
$sleepMs = (int) ($argv[8] ?? 0);

try {
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    DatabaseIdempotencyStore::useConnection($pdo);

    $result = DatabaseIdempotencyStore::execute(
        $identity,
        $key,
        'ConcurrencyTest::mutate',
        $hash,
        function () use ($pdo, $mode, $sleepMs): array {
            if ($sleepMs > 0) {
                usleep($sleepMs * 1000);
            }

            if ($mode === 'throw') {
                throw new RuntimeException('simulated handler crash');
            }

            $pdo->prepare('INSERT INTO kylat_test_executions (note) VALUES (?)')->execute([$mode]);

            return ['ok' => true, 'worker' => getmypid()];
        }
    );

    echo json_encode([
        'ok' => true,
        'status' => $result['status'],
        'response' => $result['response'] ?? null,
    ]), "\n";
} catch (Throwable $exception) {
    echo json_encode([
        'ok' => false,
        'error' => $exception->getMessage(),
    ]), "\n";
}
