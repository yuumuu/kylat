<?php

declare(strict_types=1);

namespace Kylat\Laravel\Support;

/**
 * Rate limit Redis atomik berbasis Lua (INCRBY + EXPIRE dalam satu skrip).
 *
 * Dipakai sebagai fallback non-Laravel ketika ekstensi phpredis tersedia dan
 * store rate limit diarahkan ke Redis. Untuk Laravel penuh, jalur
 * Illuminate\Cache\RateLimiter tetap diutamakan.
 */
final class RedisRateLimiter
{
    private const SCRIPT = <<<'LUA'
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local amount = tonumber(ARGV[1])
local limit = tonumber(ARGV[3])
if current + amount > limit then
    local ttl = redis.call('TTL', KEYS[1])
    if ttl < 0 then ttl = tonumber(ARGV[2]) end
    return {0, ttl}
end
local next = redis.call('INCRBY', KEYS[1], amount)
if next == amount then
    redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return {1, redis.call('TTL', KEYS[1])}
LUA;

    public static function assertAllowed(
        \Redis $redis,
        string $key,
        int $limit,
        int $mutations,
        int $windowSeconds
    ): void {
        if ($mutations <= 0) {
            return;
        }

        $result = $redis->eval(self::SCRIPT, [$key, $mutations, $windowSeconds, $limit], 1);
        if (!is_array($result) || !isset($result[0])) {
            throw new \RuntimeException('RedisRateLimiter: respons skrip Lua tidak valid.');
        }

        if ((int) $result[0] !== 1) {
            throw new RateLimitExceeded((int) max(1, (int) ($result[1] ?? $windowSeconds)));
        }
    }
}
