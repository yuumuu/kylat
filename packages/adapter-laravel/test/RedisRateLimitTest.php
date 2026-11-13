<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/Support/RateLimitExceeded.php';
require_once __DIR__ . '/../src/Support/RedisRateLimiter.php';
require_once __DIR__ . '/../src/Support/RedisConnection.php';
require_once __DIR__ . '/../src/Support/KylatRateLimiter.php';

use Kylat\Laravel\Support\RedisConnection;
use Kylat\Laravel\Support\RedisRateLimiter;

/**
 * Uji rate limit Redis multi-worker.
 *
 * Aktif bila KYLAT_TEST_REDIS_HOST diatur. Dua proses paralel masing-masing
 * melakukan 40 percobaan; limit 50 -> total allowed harus tepat 50.
 */

function rrCheck(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('GAGAL REDIS RATE LIMIT: ' . $message);
    }
}

function rrStartWorker(int $attempts, string $ip): array
{
    $process = proc_open(
        [PHP_BINARY, __DIR__ . '/RedisRateWorker.php', (string) $attempts, $ip],
        [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes
    );

    if (!is_resource($process)) {
        throw new RuntimeException('Gagal menjalankan worker rate limit Redis.');
    }

    return [$process, $pipes];
}

function rrFinishWorker(array $handle): array
{
    [$process, $pipes] = $handle;
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    proc_close($process);

    $decoded = json_decode(trim((string) $stdout), true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Output worker Redis bukan JSON: ' . trim((string) $stdout . ' ' . (string) $stderr));
    }

    return $decoded;
}

$host = getenv('KYLAT_TEST_REDIS_HOST');
if (!is_string($host) || $host === '') {
    echo "SKIP Redis rate limit: KYLAT_TEST_REDIS_HOST tidak diatur.\n";
    exit(0);
}

putenv('KYLAT_REDIS_HOST=' . $host);
putenv('KYLAT_REDIS_PORT=' . (getenv('KYLAT_TEST_REDIS_PORT') ?: '6379'));
putenv('KYLAT_RATE_LIMIT_ANONYMOUS=50');
putenv('KYLAT_RATE_LIMIT_STORE=redis');

$redis = RedisConnection::resolve();
rrCheck($redis !== null, 'koneksi Redis harus tersedia');

$ip = '10.10.10.10';
$key = 'kylat:mutation:ip:' . $ip;
$redis->del($key);

$first = rrStartWorker(40, $ip);
$second = rrStartWorker(40, $ip);
$resultA = rrFinishWorker($first);
$resultB = rrFinishWorker($second);

$allowed = (int) ($resultA['allowed'] ?? 0) + (int) ($resultB['allowed'] ?? 0);
$rejected = (int) ($resultA['rejected'] ?? 0) + (int) ($resultB['rejected'] ?? 0);

rrCheck($allowed === 50, "total allowed harus 50, dapat: {$allowed}");
rrCheck($rejected === 30, "total rejected harus 30, dapat: {$rejected}");

$stored = (int) $redis->get($key);
rrCheck($stored === 50, "counter Redis harus 50, dapat: {$stored}");

$ttl = (int) $redis->ttl($key);
rrCheck($ttl > 0 && $ttl <= 60, "TTL harus 1..60 detik, dapat: {$ttl}");

// Idempoten: percobaan berikutnya tetap ditolak.
try {
    RedisRateLimiter::assertAllowed($redis, $key, 50, 1, 60);
    rrCheck(false, 'percobaan ke-51 harus ditolak');
} catch (\Kylat\Laravel\Support\RateLimitExceeded) {
    // expected
}

$redis->del($key);

echo "Redis rate limit multi-worker tests: OK (allowed={$allowed}, rejected={$rejected})\n";
