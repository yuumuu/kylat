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
use RuntimeException;

function conformanceCheck(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('GAGAL KONFORMANSI: ' . $message);
    }
}

interface ConformanceActions
{
    public function authorize(): bool;

    #[Server(read: true, public: true)]
    public function list(): array;

    #[Server]
    public function save(): bool;
}

final class ConformanceActionsImpl implements ConformanceActions
{
    public function authorize(): bool
    {
        return true;
    }

    public function list(): array
    {
        return ['ok' => true];
    }

    public function save(): bool
    {
        return true;
    }
}

ActionRegistry::flush();
ActionRegistry::register('Kylat\Laravel\Tests\ConformanceActions', new ConformanceActionsImpl());
$controller = new KylatBatchCallController();

$batch = $controller->handle(['calls' => [[
    'id' => 'c1',
    'action' => 'Kylat\Laravel\Tests\ConformanceActions::save',
    'args' => [],
    'idempotencyKey' => 'conformance-key-0001',
]]], [], 0, '198.51.100.7');
conformanceCheck(array_keys($batch) === ['results'], 'BatchResponse hanya boleh memiliki results');
conformanceCheck(array_keys($batch['results'][0]) === ['id', 'ok', 'data'], 'CallResult sukses memiliki id/ok/data');

$read = $controller->handleRead('Kylat\Laravel\Tests\ConformanceActions::list');
conformanceCheck($read['status'] === 200, 'ReadResponse sukses harus 200');
conformanceCheck(array_keys($read['body']) === ['data'], 'ReadResponse hanya boleh memiliki data');
conformanceCheck(str_starts_with($read['cache'], 'public'), 'public read harus cache public');

$schema = $controller->handleSchema();
conformanceCheck($schema['status'] === 200, 'SchemaResponse harus 200');
conformanceCheck(array_keys($schema['body']) === ['protocol', 'actions'], 'SchemaResponse memiliki protocol/actions');
conformanceCheck($schema['body']['protocol'] === '0.1', 'protocol schema harus 0.1');
foreach ($schema['body']['actions'] as $action) {
    conformanceCheck(
        array_keys($action) === ['name', 'read', 'public', 'params', 'returnType'],
        'SchemaAction memiliki field yang diwajibkan'
    );
}

$missing = $controller->handleRead('Kylat\Laravel\Tests\ConformanceActions::missing');
conformanceCheck($missing['status'] === 404, 'read tidak ditemukan harus 404');
conformanceCheck(
    array_keys($missing['body']) === ['type', 'title', 'status', 'detail'],
    'Problem Details memiliki type/title/status/detail'
);
conformanceCheck($missing['body']['type'] === 'urn:kylat:not_found', 'tipe not_found harus stabil');

$stale = $controller->handleRead(
    'Kylat\Laravel\Tests\ConformanceActions::list',
    [],
    ['X-Kylat-Build' => 'old'],
    'new'
);
conformanceCheck($stale['status'] === 409, 'stale build harus 409');
conformanceCheck($stale['body']['type'] === 'urn:kylat:stale_build', 'tipe stale build harus stabil');

echo "Conformance tests: OK\n";
