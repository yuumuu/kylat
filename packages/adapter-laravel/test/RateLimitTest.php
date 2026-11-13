<?php

declare(strict_types=1);

namespace Kylat\Laravel\Tests;

require_once __DIR__ . '/../src/Attributes/Server.php';
require_once __DIR__ . '/../src/Actions/ActionRegistry.php';
require_once __DIR__ . '/../src/Support/IdempotencyStore.php';
require_once __DIR__ . '/../src/Support/KylatRateLimiter.php';
require_once __DIR__ . '/../src/Support/RedisRateLimiter.php';
require_once __DIR__ . '/../src/Support/RedisConnection.php';
require_once __DIR__ . '/../src/Support/RateLimitExceeded.php';
require_once __DIR__ . '/../src/Http/Controllers/KylatBatchCallController.php';

use Kylat\Attributes\Server;
use Kylat\Laravel\Actions\ActionRegistry;
use Kylat\Laravel\Http\Controllers\KylatBatchCallController;
use Kylat\Laravel\Support\KylatRateLimiter;
use Kylat\Laravel\Support\RateLimitExceeded;
use RuntimeException;

function rateCheck(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('GAGAL: ' . $message);
    }
}

interface RateLimitActions
{
    public function authorize(): bool;

    #[Server]
    public function save(int $value): bool;
}

final class RateLimitActionsImpl implements RateLimitActions
{
    public function authorize(): bool
    {
        return true;
    }

    public function save(int $value): bool
    {
        return true;
    }
}

KylatRateLimiter::reset();
$controller = new KylatBatchCallController();
ActionRegistry::flush();
ActionRegistry::register('Kylat\Laravel\Tests\RateLimitActions', new RateLimitActionsImpl());

for ($i = 0; $i < 20; $i++) {
    $result = $controller->handle(
        ['calls' => [[
            'id' => 'c' . $i,
            'action' => 'Kylat\Laravel\Tests\RateLimitActions::save',
            'args' => ['value' => $i],
            'idempotencyKey' => 'rate-limit-key-' . str_pad((string) $i, 4, '0', STR_PAD_LEFT),
        ]]],
        [],
        0,
        '203.0.113.10'
    );
    rateCheck(($result['results'][0]['ok'] ?? false) === true, '20 mutasi pertama harus lolos');
}

$threw = false;
try {
    $controller->handle(
        ['calls' => [[
            'id' => 'c20',
            'action' => 'Kylat\Laravel\Tests\RateLimitActions::save',
            'args' => ['value' => 20],
            'idempotencyKey' => 'rate-limit-key-0020',
        ]]],
        [],
        0,
        '203.0.113.10'
    );
} catch (RateLimitExceeded $exception) {
    $threw = true;
    rateCheck($exception->retryAfterSeconds > 0, 'retry-after harus positif');
}

rateCheck($threw, 'mutasi ke-21 harus kena rate limit');
echo "Rate limit tests: OK\n";
