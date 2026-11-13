<?php

declare(strict_types=1);

namespace Kylat\Laravel\Support;

use PDO;
use Throwable;

/**
 * Penyedia koneksi PDO untuk driver idempotensi database.
 *
 * Di Laravel, koneksi diambil dari manager database default agar handler aksi,
 * baris idempotensi, dan outbox berbagi transaksi yang sama. Untuk pengujian
 * standalone, koneksi dapat di-inject lewat set().
 */
final class IdempotencyConnection
{
    private static ?PDO $pdo = null;

    public static function set(?PDO $pdo): void
    {
        self::$pdo = $pdo;
    }

    public static function resolve(): ?PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        if (!function_exists('app')) {
            return null;
        }

        try {
            $manager = app('db');
            if ($manager === null || !method_exists($manager, 'connection')) {
                return null;
            }

            $connection = $manager->connection();
            if (!method_exists($connection, 'getPdo')) {
                return null;
            }

            $pdo = $connection->getPdo();

            return $pdo instanceof PDO ? $pdo : null;
        } catch (Throwable) {
            return null;
        }
    }
}
