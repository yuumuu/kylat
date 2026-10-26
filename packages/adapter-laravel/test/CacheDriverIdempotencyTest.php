<?php

declare(strict_types=1);

namespace Illuminate\Support\Facades {
    /**
     * Mock Cache Facade untuk mensimulasikan behaviour Cache Laravel (Redis/Memcached/Database).
     */
    class Cache
    {
        /** @var array<string, mixed> */
        public static array $storage = [];
        /** @var list<string> */
        public static array $operations = [];

        public static function reset(): void
        {
            self::$storage = [];
            self::$operations = [];
        }

        public static function add(string $key, mixed $value, int $ttl): bool
        {
            self::$operations[] = "add:{$key}";
            if (isset(self::$storage[$key])) {
                return false;
            }
            self::$storage[$key] = $value;
            return true;
        }

        public static function put(string $key, mixed $value, int $ttl): void
        {
            self::$operations[] = "put:{$key}";
            self::$storage[$key] = $value;
        }

        public static function get(string $key): mixed
        {
            self::$operations[] = "get:{$key}";
            return self::$storage[$key] ?? null;
        }

        public static function forget(string $key): bool
        {
            self::$operations[] = "forget:{$key}";
            unset(self::$storage[$key]);
            return true;
        }
    }
}

namespace Kylat\Laravel\Tests {
    require_once __DIR__ . '/../src/Support/IdempotencyStore.php';
    require_once __DIR__ . '/../src/Http/Controllers/KylatBatchCallController.php';
    require_once __DIR__ . '/../src/Actions/ActionRegistry.php';
    require_once __DIR__ . '/../../../examples/counter-app/CounterActions.php';

    use App\Actions\CounterActions;
    use Illuminate\Support\Facades\Cache;
    use Kylat\Laravel\Actions\ActionRegistry;
    use Kylat\Laravel\Http\Controllers\KylatBatchCallController;
    use Kylat\Laravel\Support\IdempotencyStore;
    use RuntimeException;

    final class CacheTestActions implements CounterActions
    {
        public bool $authorized = false;
        public int $execCount = 0;

        public function authorize(): bool
        {
            return $this->authorized;
        }

        public function saveCount(int $count): bool
        {
            $this->execCount++;
            return true;
        }
    }

    echo "=== PENGUJIAN INTEGRASI CACHE FACADE IDEMPOTENCYSTORE (ATTEMPT & RETRY) ===\n\n";

    Cache::reset();
    $actions = new CacheTestActions();
    ActionRegistry::register('CounterActions', $actions);
    $controller = new KylatBatchCallController();

    $key = "cache_retry_" . uniqid();
    $payload = [
        'calls' => [
            [
                'id' => 'c1',
                'action' => 'CounterActions::saveCount',
                'args' => ['count' => 123],
                'idempotencyKey' => $key,
            ],
        ],
    ];

    // 1. Percobaan 1: Gagal (unauthorized)
    $actions->authorized = false;
    $res1 = $controller->handle($payload);
    if ($res1['results'][0]['ok'] !== false) {
        throw new RuntimeException("Percobaan 1 harus gagal");
    }

    // Periksa status di Cache::get
    $record = Cache::get("kylat:idemp:{$key}");
    if (!is_array($record) || $record['status'] !== 'failed') {
        throw new RuntimeException("Status di cache harus 'failed'");
    }
    if (($record['attempt'] ?? null) !== 2) {
        throw new RuntimeException("Attempt harus dinaikkan menjadi 2 oleh markFailed, didapat: " . var_export($record['attempt'], true));
    }
    // Periksa bahwa per-attempt lock lama (attempt 1) sudah dilepas oleh markFailed
    if (isset(Cache::$storage["kylat:idemp:lock:{$key}:1"])) {
        throw new RuntimeException("Lock attempt 1 harus dilepas oleh markFailed");
    }
    echo "✅ markFailed berhasil menaikkan attempt ke 2 dan melepas lock pada Cache.\n";

    // 2. Percobaan 2: Retry langsung dengan izin true
    $actions->authorized = true;
    $payload['calls'][0]['id'] = 'c2';
    $res2 = $controller->handle($payload);
    if ($res2['results'][0]['ok'] !== true) {
        throw new RuntimeException("Retry langsung WAJIB berhasil, gagal dengan: " . json_encode($res2));
    }
    if ($actions->execCount !== 1) {
        throw new RuntimeException("Handler harus dieksekusi tepat 1 kali");
    }

    // Periksa status cache sekarang harus completed
    $record2 = Cache::get("kylat:idemp:{$key}");
    if (!is_array($record2) || $record2['status'] !== 'completed') {
        throw new RuntimeException("Status di cache harus 'completed'");
    }
    echo "✅ Retry langsung dengan payload sama berhasil dieksekusi dan status menjadi completed.\n";

    // 3. Percobaan 3: Panggilan duplikat harus dikembalikan dari cache
    $payload['calls'][0]['id'] = 'c3';
    $res3 = $controller->handle($payload);
    if ($res3['results'][0]['ok'] !== true || $res3['results'][0]['id'] !== 'c3') {
        throw new RuntimeException("Panggilan duplikat harus mengembalikan respon dari cache");
    }
    if ($actions->execCount !== 1) {
        throw new RuntimeException("Handler TIDAK boleh dieksekusi ulang!");
    }
    echo "✅ Panggilan ketiga dikembalikan dari cache tanpa mengeksekusi handler lagi.\n";

    echo "\n🎉 SEMUA PENGUJIAN CACHE FACADE IDEMPOTENCYSTORE BERHASIL 100%!\n";
}
