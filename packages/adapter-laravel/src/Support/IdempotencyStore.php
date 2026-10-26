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
    public const IN_PROGRESS_LEASE_SECONDS = 30; // Lease pendek 30 detik untuk mencegah hang in_progress

    /**
     * Konfigurasi durasi lease in_progress (detik, mendukung nilai float untuk pengujian sub-detik).
     */
    public static float|int $inProgressLeaseSeconds = self::IN_PROGRESS_LEASE_SECONDS;

    /**
     * Konteks eksekusi aksi server saat ini untuk heartbeat tanpa argumen eksplisit.
     */
    public static ?string $currentActiveKey = null;
    public static ?string $currentActiveHash = null;

    /**
     * Store in-memory untuk testing dan lingkungan development/CLI single-process.
     * 
     * PERINGATAN ARSITEKTUR:
     * Fallback in-memory ini HANYA berlaku untuk satu proses PHP (single-process memory space).
     * Pada lingkungan produksi multi-worker (seperti PHP-FPM, Octane, FrankenPHP, atau multi-server),
     * WAJIB mengonfigurasi driver cache terdistribusi Laravel (Redis, Memcached, atau Database)
     * yang mendukung primitif locking atomik Cache::add() untuk mencegah race-condition antar-worker.
     * 
     * @var array<string, array{status: 'in_progress'|'completed'|'failed', hash: string, response: array<string, mixed>|null, expires_at: float|int, attempt?: int}>
     */
    private static array $memoryStore = [];

    /**
     * Driver eksternal opsional (misal instance Cache repository Laravel).
     * @var object|null
     */
    private static ?object $customDriver = null;

    public static function setLeaseSeconds(float|int $seconds): void
    {
        self::$inProgressLeaseSeconds = $seconds;
    }

    public static function resetLeaseSeconds(): void
    {
        self::$inProgressLeaseSeconds = self::IN_PROGRESS_LEASE_SECONDS;
    }

    public static function setCurrentActive(?string $key, ?string $hash): void
    {
        self::$currentActiveKey = $key;
        self::$currentActiveHash = $hash;
    }

    public static function clearCurrentActive(): void
    {
        self::$currentActiveKey = null;
        self::$currentActiveHash = null;
    }

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
     * Memperpanjang lease waktu in_progress (Heartbeat) selama aksi server sedang berjalan.
     * Mencegah lease 30 detik kadaluarsa ketika aksi sah membutuhkan waktu nyata (wall-clock time) lebih lama.
     * Dapat dipanggil tanpa parameter dari dalam handler aksi server.
     */
    public static function heartbeat(?string $key = null, ?string $payloadHash = null, float|int|null $extendSeconds = null): bool
    {
        $key = $key ?? self::$currentActiveKey;
        $payloadHash = $payloadHash ?? self::$currentActiveHash;
        $extendSeconds = $extendSeconds ?? self::$inProgressLeaseSeconds;

        if ($key === null || $payloadHash === null) {
            return false;
        }

        $cacheKey = "kylat:idemp:{$key}";
        $now = microtime(true);

        if (class_exists('Illuminate\\Support\\Facades\\Cache') && self::$customDriver === null) {
            $record = \Illuminate\Support\Facades\Cache::get($cacheKey);
            if (!is_array($record) || ($record['hash'] ?? null) !== $payloadHash || ($record['status'] ?? null) !== 'in_progress') {
                return false;
            }
            \Illuminate\Support\Facades\Cache::put($cacheKey, $record, (int) ceil($extendSeconds));
            return true;
        }

        if (!isset(self::$memoryStore[$key])) {
            return false;
        }
        $entry = &self::$memoryStore[$key];
        if (($entry['hash'] ?? null) !== $payloadHash || ($entry['status'] ?? null) !== 'in_progress' || ($entry['expires_at'] ?? 0) < $now) {
            return false;
        }
        $entry['expires_at'] = $now + $extendSeconds;
        return true;
    }

    /**
     * Mencoba mengunci / memeriksa Idempotency-Key sebelum aksi dieksekusi secara atomik.
     * Menggunakan lease pendek (default 30 detik) untuk status 'in_progress' agar tidak mengunci pengguna jika crash.
     *
     * @return array{
     *   status: 'acquired'|'conflict'|'in_progress'|'completed',
     *   response?: array<string, mixed>
     * }
     */
    public static function acquire(string $key, string $payloadHash): array
    {
        $cacheKey = "kylat:idemp:{$key}";
        $now = microtime(true);
        $lease = self::$inProgressLeaseSeconds;

        // 1. Integrasi Laravel Cache dengan Atomic Lock (Cache::add set-if-absent)
        if (class_exists('Illuminate\\Support\\Facades\\Cache') && self::$customDriver === null) {
            // Coba peroleh lock secara atomik
            $locked = \Illuminate\Support\Facades\Cache::add($cacheKey, [
                'status' => 'in_progress',
                'hash' => $payloadHash,
                'response' => null,
                'attempt' => 1,
            ], (int) ceil($lease));

            if ($locked) {
                return ['status' => 'acquired'];
            }

            // Jika lock gagal diperoleh, berarti kunci sudah ada di cache
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
                if ($record['status'] === 'failed') {
                    // Retry setelah kegagalan sebelumnya secara atomik:
                    // Cegah 2 request paralel saling berebut dengan atomic lock per-attempt via Cache::add
                    $attempt = (int) ($record['attempt'] ?? 1);
                    $retryLocked = \Illuminate\Support\Facades\Cache::add("kylat:idemp:lock:{$key}:{$attempt}", true, (int) ceil($lease));
                    if (!$retryLocked) {
                        return ['status' => 'in_progress'];
                    }

                    \Illuminate\Support\Facades\Cache::put($cacheKey, [
                        'status' => 'in_progress',
                        'hash' => $payloadHash,
                        'response' => null,
                        'attempt' => $attempt,
                    ], (int) ceil($lease));
                    return ['status' => 'acquired'];
                }
            }

            return ['status' => 'in_progress'];
        }

        // 2. Driver Fallback (In-Memory dengan Lease Pendek & TTL)
        $currentAttempt = 1;
        if (isset(self::$memoryStore[$key])) {
            $entry = self::$memoryStore[$key];

            // Cek masa berlaku TTL / Lease
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
                $currentAttempt = (int) ($entry['attempt'] ?? 1);
            }
        }

        // Kunci pertama kali (atau retry pasca-kegagalan): tandai sebagai in_progress dengan lease
        self::$memoryStore[$key] = [
            'status' => 'in_progress',
            'hash' => $payloadHash,
            'response' => null,
            'expires_at' => $now + $lease,
            'attempt' => $currentAttempt,
        ];

        return ['status' => 'acquired'];
    }

    /**
     * Menyimpan hasil eksekusi setelah aksi berhasil diselesaikan.
     * Memverifikasi bahwa lease masih aktif dan dipegang oleh payload ini sebelum menyimpan,
     * untuk mencegah eksekusi ganda jika aksi melebihi lease tanpa heartbeat.
     *
     * @param array<string, mixed> $response
     * @return bool True jika berhasil dikomit, false jika lease kadaluarsa / hilang
     */
    public static function complete(string $key, string $payloadHash, array $response, int $ttl = self::DEFAULT_TTL_SECONDS): bool
    {
        $cacheKey = "kylat:idemp:{$key}";
        $now = microtime(true);

        if (class_exists('Illuminate\\Support\\Facades\\Cache') && self::$customDriver === null) {
            $record = \Illuminate\Support\Facades\Cache::get($cacheKey);
            if (!is_array($record) || ($record['hash'] ?? null) !== $payloadHash || ($record['status'] ?? null) !== 'in_progress') {
                return false;
            }

            $attempt = (int) ($record['attempt'] ?? 1);
            \Illuminate\Support\Facades\Cache::forget("kylat:idemp:lock:{$key}:{$attempt}");

            \Illuminate\Support\Facades\Cache::put($cacheKey, [
                'status' => 'completed',
                'hash' => $payloadHash,
                'response' => $response,
                'attempt' => $attempt,
            ], $ttl);
            return true;
        }

        if (!isset(self::$memoryStore[$key])) {
            return false;
        }

        $entry = self::$memoryStore[$key];
        if (($entry['hash'] ?? null) !== $payloadHash || ($entry['status'] ?? null) !== 'in_progress' || ($entry['expires_at'] ?? 0) < $now) {
            return false;
        }

        $attempt = (int) ($entry['attempt'] ?? 1);
        self::$memoryStore[$key] = [
            'status' => 'completed',
            'hash' => $payloadHash,
            'response' => $response,
            'attempt' => $attempt,
            'expires_at' => $now + $ttl,
        ];
        return true;
    }

    /**
     * Menandai status eksekusi sebagai gagal, menaikkan counter attempt, dan melepas lock per-attempt
     * agar panggilan retry langsung berikutnya dapat berhasil diperoleh tanpa terhalang lock kadaluarsa,
     * namun tetap mengikat payloadHash agar key ini tidak dapat dibajak untuk payload lain.
     */
    public static function markFailed(string $key, string $payloadHash, int $ttl = self::DEFAULT_TTL_SECONDS): void
    {
        $cacheKey = "kylat:idemp:{$key}";
        $now = microtime(true);

        if (class_exists('Illuminate\\Support\\Facades\\Cache') && self::$customDriver === null) {
            $record = \Illuminate\Support\Facades\Cache::get($cacheKey);
            $attempt = is_array($record) ? ((int) ($record['attempt'] ?? 1)) : 1;

            // Lepaskan lock attempt saat ini agar retry tidak terhambat
            \Illuminate\Support\Facades\Cache::forget("kylat:idemp:lock:{$key}:{$attempt}");

            // Naikkan attempt untuk percobaan retry berikutnya
            $nextAttempt = $attempt + 1;

            \Illuminate\Support\Facades\Cache::put($cacheKey, [
                'status' => 'failed',
                'hash' => $payloadHash,
                'response' => null,
                'attempt' => $nextAttempt,
            ], $ttl);
            return;
        }

        $attempt = isset(self::$memoryStore[$key]['attempt']) ? (int) self::$memoryStore[$key]['attempt'] : 1;
        $nextAttempt = $attempt + 1;

        self::$memoryStore[$key] = [
            'status' => 'failed',
            'hash' => $payloadHash,
            'response' => null,
            'attempt' => $nextAttempt,
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
            $record = \Illuminate\Support\Facades\Cache::get($cacheKey);
            if (is_array($record) && isset($record['attempt'])) {
                $attempt = (int) $record['attempt'];
                \Illuminate\Support\Facades\Cache::forget("kylat:idemp:lock:{$key}:{$attempt}");
            }
            \Illuminate\Support\Facades\Cache::forget($cacheKey);
            return;
        }

        unset(self::$memoryStore[$key]);
    }
}
