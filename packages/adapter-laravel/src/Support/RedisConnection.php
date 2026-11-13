<?php

declare(strict_types=1);

namespace Kylat\Laravel\Support;

use Redis;
use Throwable;

/**
 * Resolusi koneksi phpredis untuk rate limit.
 *
 * Urutan: config Laravel `database.redis.default`, lalu env
 * KYLAT_REDIS_HOST/KYLAT_REDIS_PORT/KYLAT_REDIS_PASSWORD/KYLAT_REDIS_DB.
 * Mengembalikan null bila ekstensi atau koneksi tidak tersedia.
 */
final class RedisConnection
{
    private static ?Redis $connection = null;

    public static function resolve(): ?Redis
    {
        if (self::$connection instanceof Redis) {
            return self::$connection;
        }

        if (!class_exists(Redis::class)) {
            return null;
        }

        $host = self::config('database.redis.default.host') ?? self::env('KYLAT_REDIS_HOST', '127.0.0.1');
        $port = (int) (self::config('database.redis.default.port') ?? self::env('KYLAT_REDIS_PORT', '6379'));
        $password = self::config('database.redis.default.password') ?? self::env('KYLAT_REDIS_PASSWORD', '');
        $database = (int) (self::config('database.redis.default.database') ?? self::env('KYLAT_REDIS_DB', '0'));

        try {
            $redis = new Redis();
            $redis->connect((string) $host, $port, 1.0);
            if (is_string($password) && $password !== '') {
                $redis->auth($password);
            }
            if ($database > 0) {
                $redis->select($database);
            }

            self::$connection = $redis;

            return $redis;
        } catch (Throwable) {
            return null;
        }
    }

    private static function config(string $key): mixed
    {
        if (!function_exists('config')) {
            return null;
        }

        try {
            return config($key);
        } catch (Throwable) {
            return null;
        }
    }

    private static function env(string $name, string $default): string
    {
        $value = getenv($name);

        return is_string($value) && $value !== '' ? $value : $default;
    }
}
