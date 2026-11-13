<?php

declare(strict_types=1);

namespace Kylat\Laravel\Tests;

require_once __DIR__ . '/../src/Attributes/Server.php';
require_once __DIR__ . '/../src/Actions/ActionRegistry.php';
require_once __DIR__ . '/../src/Support/IdempotencyStore.php';
require_once __DIR__ . '/../src/Http/Controllers/KylatBatchCallController.php';

use Kylat\Attributes\Server;
use Kylat\Laravel\Actions\ActionRegistry;
use Kylat\Laravel\Http\Controllers\KylatBatchCallController;
use RuntimeException;

function check(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException('GAGAL: ' . $message);
    }
}

interface ReadActions
{
    public function authorize(): bool;

    #[Server(read: true, public: true)]
    public function list(int $page = 1): array;

    #[Server]
    public function save(int $page = 1): bool;
}

final class ReadActionsImpl implements ReadActions
{
    public bool $allowed = true;

    public function authorize(): bool
    {
        return $this->allowed;
    }

    /** @return array<string,int> */
    public function list(int $page = 1): array
    {
        return ['page' => $page];
    }

    public function save(int $page = 1): bool
    {
        return true;
    }
}

ActionRegistry::flush();
$impl = new ReadActionsImpl();
ActionRegistry::register('Kylat\Laravel\Tests\ReadActions', $impl);
$controller = new KylatBatchCallController();

$read = $controller->handleRead('Kylat\Laravel\Tests\ReadActions::list', ['args' => '{"page":2}']);
check($read['status'] === 200, 'read success harus 200');
check(($read['body']['data']['page'] ?? null) === 2, 'argumen page harus diteruskan');
check(str_starts_with($read['cache'], 'public'), 'aksi public harus cache public');

$mutating = $controller->handleRead('Kylat\Laravel\Tests\ReadActions::save');
check($mutating['status'] === 400, 'aksi mutasi lewat GET harus ditolak');

$invalidArgs = $controller->handleRead('Kylat\Laravel\Tests\ReadActions::list', ['args' => '[]']);
check($invalidArgs['status'] === 400, 'args list harus ditolak');

$stale = $controller->handleRead(
    'Kylat\Laravel\Tests\ReadActions::list',
    ['args' => '{}'],
    ['X-Kylat-Build' => 'client-lama'],
    'server-baru'
);
check($stale['status'] === 409, 'build mismatch harus 409');
check($stale['body']['type'] === 'urn:kylat:stale_build', 'tipe stale build harus stabil');

$notFound = $controller->handleRead('Kylat\Laravel\Tests\ReadActions::missing');
check($notFound['status'] === 404, 'aksi tidak ada harus 404');

$impl->allowed = false;
$unauthorized = $controller->handleRead('Kylat\Laravel\Tests\ReadActions::list');
check($unauthorized['status'] === 401, 'authorize default-deny harus 401');
$impl->allowed = true;

$schema = $controller->handleSchema([], 'server-baru');
check($schema['status'] === 200, 'schema harus 200');
$names = array_column($schema['body']['actions'], 'name');
check(in_array('Kylat\Laravel\Tests\ReadActions::list', $names, true), 'schema harus memuat aksi read');
check(in_array('Kylat\Laravel\Tests\ReadActions::save', $names, true), 'schema harus memuat aksi server lain');
$listAction = null;
foreach ($schema['body']['actions'] as $action) {
    if ($action['name'] === 'Kylat\Laravel\Tests\ReadActions::list') {
        $listAction = $action;
        break;
    }
}
check(is_array($listAction), 'detail aksi read harus ada');
check($listAction['read'] === true, 'read flag harus true');
check($listAction['public'] === true, 'public flag harus true');
check($listAction['params'][0]['name'] === 'page', 'parameter schema harus page');
check($schema['body']['build'] === 'server-baru', 'build schema harus terisi');

echo "Read endpoint tests: OK\n";
