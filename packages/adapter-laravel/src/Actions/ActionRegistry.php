<?php

declare(strict_types=1);

namespace Kylat\Laravel\Actions;

use Closure;

/**
 * Registri pemetaan kontrak aksi server ke resolver implementasi konkresi.
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
        self::$bindings[$contract] = $resolver;
    }

    /**
     * Menyelesaikan instance aksi berdasarkan kontrak.
     *
     * @template T of object
     * @param class-string<T> $contract
     * @return T|null
     */
    public static function resolve(string $contract): ?object
    {
        $binding = self::$bindings[$contract] ?? null;

        if ($binding === null) {
            // Coba instantiate langsung jika class konkret dan ada
            if (class_exists($contract)) {
                /** @var T $instance */
                $instance = new $contract();
                return $instance;
            }
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
