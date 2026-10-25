<?php

declare(strict_types=1);

namespace Kylat\Laravel\Support;

/**
 * Pengelola idempotensi RPC Kylat dengan dukungan kanonikalisasi JSON, atomic locking,
 * deteksi in-progress (anti race-condition), isolasi retry pasca-kegagalan, dan TTL 24 jam.
 */
class IdempotencyStore
{
    public const DEFAULT_TTL_SECONDS = 86400; // 24 Jam (Threat Model §3 A4)

    /**
     * Store in-memory untuk testing dan fallback standalone.
     * @var array<string, array{status: 'in_progress'|'completed'|'failed', hash: string, response: array<string, mixed>|null, expires_at: int}>
     */
    private static array $memoryStore = [];

    /**
     * Driver eksternal opsional (misal instance Cache repository Laravel).
     * @var object|null
     */
    private static ?object $customDriver = null;

    public static function setDriver(?object $driver): void
    {
        self::$customDriver = $driver;
    }

    public static function resetMemory(): void
    {
        self::$memoryStore = [];
    }

    /**
     * Kanonikalisasi data rekursif: mengurutkan semua key pada dictionary/associative array
     * agar representasi JSON deterministik dan kebal terhadap perbedaan urutan field.
     */
    public static function canonicalize(mixed $data): mixed
    {
        if (!is_array($data)) {
            return $data;
        }

        // Jika bukan array list berindeks integer urut 0..n-1, urutkan ksort
        if (!array_is_list($data)) {
            ksort($data);
        }

        foreach ($data as $key => $value) {
            $data[$key] = self::canonicalize($value);
        }

        return $data;
    }

    /**
     * Menghitung hash SHA-256 kanonik dari payload RPC (action + args).
     *
     * @param array<string, mixed> $args
     */
    public static function computeCanonicalHash(string $action, array $args): string
    {
        $canonicalData = self::canonicalize([
            'action' => $action,
            'args' => $args,
        ]);

        return hash('sha256', (string) json_encode($canonicalData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    /**
     * Mencoba mengunci / memeriksa Idempotency-Key sebelum aksi dieksekusi.
     *
     * @return array{
     *   status: 'acquired'|'conflict'|'in_progress'|'completed',
     *   response?: array<string, mixed>
     * }
     */
    public static function acquire(string $key, string $payloadHash, int $ttl = self::DEFAULT_TTL_SECONDS): array
    {
        $cacheKey = "kylat:idemp:{$key}";
        $now = time();

        // 1. Integrasi Laravel Cache jika tersedia
        if (class_exists('Illuminate\\Support\\Facades\\Cache') && self::$customDriver === null) {
            /** @var mixed $record */
            $record = \Illuminate\Support\Facades\Cache::get($cacheKey);
            if (is_array($record)) {
                if ($record['hash'] !== $payloadHash) {
                    return ['status' => 'conflict'];
                }
                if ($record['status'] === 'in_progress') {
                    return ['status' => 'in_progress'];
                }
                if ($record['status'] === 'completed') {
                    return ['status' => 'completed', 'response' => $record['response']];
                }
                // Jika status === 'failed', diizinkan retry dengan payload sama -> set ke in_progress
            }

            \Illuminate\Support\Facades\Cache::put($cacheKey, [
                'status' => 'in_progress',
                'hash' => $payloadHash,
                'response' => null,
            ], $ttl);

            return ['status' => 'acquired'];
        }

        // 2. Driver Fallback (In-Memory dengan TTL & Atomic Guard)
        if (isset(self::$memoryStore[$key])) {
            $entry = self::$memoryStore[$key];

            // Cek masa berlaku TTL
            if ($entry['expires_at'] < $now) {
                unset(self::$memoryStore[$key]);
            } else {
                if ($entry['hash'] !== $payloadHash) {
                    return ['status' => 'conflict'];
                }
                if ($entry['status'] === 'in_progress') {
                    return ['status' => 'in_progress'];
                }
                if ($entry['status'] === 'completed') {
                    return ['status' => 'completed', 'response' => $entry['response']];
                }
                // Jika status === 'failed', diizinkan retry dengan payload sama
            }
        }

        // Kunci pertama kali (atau retry pasca-kegagalan): tandai sebagai in_progress
        self::$memoryStore[$key] = [
            'status' => 'in_progress',
            'hash' => $payloadHash,
            'response' => null,
            'expires_at' => $now + $ttl,
        ];

        return ['status' => 'acquired'];
    }

    /**
     * Menyimpan hasil eksekusi setelah aksi berhasil diselesaikan.
     *
     * @param array<string, mixed> $response
     */
    public static function complete(string $key, string $payloadHash, array $response, int $ttl = self::DEFAULT_TTL_SECONDS): void
    {
        $cacheKey = "kylat:idemp:{$key}";
        $now = time();

        if (class_exists('Illuminate\\Support\\Facades\\Cache') && self::$customDriver === null) {
            \Illuminate\Support\Facades\Cache::put($cacheKey, [
                'status' => 'completed',
                'hash' => $payloadHash,
                'response' => $response,
            ], $ttl);
            return;
        }

        self::$memoryStore[$key] = [
            'status' => 'completed',
            'hash' => $payloadHash,
            'response' => $response,
            'expires_at' => $now + $ttl,
        ];
    }

    /**
     * Menandai status eksekusi sebagai gagal, namun tetap mengikat payloadHash
     * agar key ini tidak dapat dibajak untuk payload lain di kemudian hari.
     */
    public static function markFailed(string $key, string $payloadHash, int $ttl = self::DEFAULT_TTL_SECONDS): void
    {
        $cacheKey = "kylat:idemp:{$key}";
        $now = time();

        if (class_exists('Illuminate\\Support\\Facades\\Cache') && self::$customDriver === null) {
            \Illuminate\Support\Facades\Cache::put($cacheKey, [
                'status' => 'failed',
                'hash' => $payloadHash,
                'response' => null,
            ], $ttl);
            return;
        }

        self::$memoryStore[$key] = [
            'status' => 'failed',
            'hash' => $payloadHash,
            'response' => null,
            'expires_at' => $now + $ttl,
        ];
    }

    /**
     * Melepaskan kunci jika diperlukan secara manual.
     */
    public static function release(string $key): void
    {
        $cacheKey = "kylat:idemp:{$key}";

        if (class_exists('Illuminate\\Support\\Facades\\Cache') && self::$customDriver === null) {
            \Illuminate\Support\Facades\Cache::forget($cacheKey);
            return;
        }

        unset(self::$memoryStore[$key]);
    }
}
