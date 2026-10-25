<?php

declare(strict_types=1);

namespace Kylat;

use Kylat\Laravel\Actions\ActionRegistry;
use RuntimeException;

/**
 * Kelas dasar abstrak untuk semua komponen Kylat.
 */
abstract class Component
{
    /**
     * Mengakses instance aksi server terikat untuk kontrak yang dideklarasikan.
     *
     * @template T of object
     * @param class-string<T> $contract
     * @return T
     */
    protected function server(string $contract): object
    {
        /** @var T|null $actionInstance */
        $actionInstance = ActionRegistry::resolve($contract);

        if ($actionInstance === null) {
            throw new RuntimeException(
                sprintf("Aksi server untuk kontrak '%s' belum terdaftar di ActionRegistry.", $contract)
            );
        }

        return $actionInstance;
    }
}
