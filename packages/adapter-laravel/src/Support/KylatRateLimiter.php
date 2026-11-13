<?php

declare(strict_types=1);

namespace Kylat\Laravel\Support;

/**
 * Rate limit sederhana untuk aksi mutasi.
 *
 * Memakai RateLimiter Laravel bila tersedia; fallback in-memory hanya untuk
 * test/CLI. Fallback ini bukan pengganti rate limit terdistribusi di produksi.
 */
final class KylatRateLimiter
{
    public const MUTATIONS_PER_MINUTE_AUTHENTICATED = 60;
    public const MUTATIONS_PER_MINUTE_ANONYMOUS = 20;
    public const WINDOW_SECONDS = 60;

    /** @var array<string, list<float>> */
    private static array $hits = [];

    public static function assertAllowed(mixed $user, ?string $ip, int $mutations = 1): void
    {
        if ($mutations <= 0) {
            return;
        }

        $authenticated = is_object($user) && method_exists($user, 'getAuthIdentifier');
        $key = $authenticated
            ? 'kylat:mutation:user:' . (string) $user->getAuthIdentifier()
            : 'kylat:mutation:ip:' . ($ip ?? 'unknown');
        $limit = $authenticated
            ? self::MUTATIONS_PER_MINUTE_AUTHENTICATED
            : self::MUTATIONS_PER_MINUTE_ANONYMOUS;

        if (class_exists(\Illuminate\Support\Facades\RateLimiter::class)) {
            if (\Illuminate\Support\Facades\RateLimiter::tooManyAttempts($key, $limit)) {
                throw new RateLimitExceeded(
                    (int) \Illuminate\Support\Facades\RateLimiter::availableIn($key)
                );
            }

            for ($i = 0; $i < $mutations; $i++) {
                \Illuminate\Support\Facades\RateLimiter::hit($key, self::WINDOW_SECONDS);
            }

            return;
        }

        $now = microtime(true);
        $recent = array_values(array_filter(
            self::$hits[$key] ?? [],
            static fn (float $timestamp): bool => $timestamp > $now - self::WINDOW_SECONDS
        ));

        if (count($recent) + $mutations > $limit) {
            $retryAfter = (int) max(1, self::WINDOW_SECONDS - ($now - ($recent[0] ?? $now)));
            throw new RateLimitExceeded($retryAfter);
        }

        for ($i = 0; $i < $mutations; $i++) {
            $recent[] = $now;
        }
        self::$hits[$key] = $recent;
    }

    /**
     * Reset state in-memory; hanya untuk test.
     */
    public static function reset(): void
    {
        self::$hits = [];
    }
}
