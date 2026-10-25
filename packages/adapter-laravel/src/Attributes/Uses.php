<?php

declare(strict_types=1);

namespace Kylat\Attributes;

use Attribute;

/**
 * Mendeklarasikan interface kontrak aksi server yang digunakan oleh komponen.
 * Sesuai keputusan pemisahan #[Uses] dan #[Child].
 */
#[Attribute(Attribute::TARGET_CLASS | Attribute::IS_REPEATABLE)]
final class Uses
{
    /**
     * @param class-string $contract FQCN interface kontrak aksi server.
     */
    public function __construct(
        public readonly string $contract
    ) {}
}
