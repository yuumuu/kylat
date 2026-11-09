<?php

declare(strict_types=1);

namespace Kylat\Laravel\Actions;

use Closure;
use InvalidArgumentException;

/**
 * Registri kontrak aksi server.
 *
 * Keamanan: hanya kontrak yang didaftarkan secara eksplisit yang dapat
 * di-resolve. Tidak ada fallback `new $contract()` dari input wire.
 */
final class ActionRegistry
{
    /**
     * @var array<string, object|Closure(): object>
     */
    private static array $bindings = [];

    /**
     * Mendaftarkan implementasi untuk kontrak aksi tertentu.
     *
     * @template T of object
     * @param class-string<T> $contract
     * @param T|Closure(): T $resolver
     */
    public static function register(string $contract, object $resolver): void
    {
        if (interface_exists($contract) && !method_exists($contract, 'authorize')) {
            throw new InvalidArgumentException(
                sprintf("KIL-310: kontrak aksi '%s' wajib mendeklarasikan authorize().", $contract)
            );
        }

        if (!$resolver instanceof Closure && interface_exists($contract) && !$resolver instanceof $contract) {
            throw new InvalidArgumentException(
                sprintf("Resolver untuk kontrak '%s' wajib mengimplementasikan interface tersebut.", $contract)
            );
        }

        self::$bindings[$contract] = $resolver;
    }

    /**
     * Menyelesaikan instance aksi yang sudah terdaftar. Null bila tidak ada.
     *
     * @template T of object
     * @param class-string<T> $contract
     * @return T|null
     */
    public static function resolve(string $contract): ?object
    {
        $binding = self::$bindings[$contract] ?? null;
        if ($binding === null) {
            return null;
        }

        if ($binding instanceof Closure) {
            /** @var T $resolved */
            $resolved = $binding();

            return $resolved;
        }

        /** @var T $binding */
        return $binding;
    }

    /**
     * Menghapus semua binding (berguna untuk testing).
     */
    public static function flush(): void
    {
        self::$bindings = [];
    }
}
