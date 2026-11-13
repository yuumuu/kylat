<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/Support/RateLimitExceeded.php';
require_once __DIR__ . '/../src/Support/RedisRateLimiter.php';
require_once __DIR__ . '/../src/Support/RedisConnection.php';
require_once __DIR__ . '/../src/Support/KylatRateLimiter.php';

use Kylat\Laravel\Support\KylatRateLimiter;
use Kylat\Laravel\Support\RateLimitExceeded;

$attempts = (int) ($argv[1] ?? 0);
$ip = $argv[2] ?? '10.0.0.1';

$allowed = 0;
$rejected = 0;

for ($i = 0; $i < $attempts; $i++) {
    try {
        KylatRateLimiter::assertAllowed(null, $ip, 1);
        $allowed++;
    } catch (RateLimitExceeded) {
        $rejected++;
    }
}

echo json_encode(['ok' => true, 'allowed' => $allowed, 'rejected' => $rejected]), "\n";
