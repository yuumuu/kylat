<?php

declare(strict_types=1);

namespace Kylat\Attributes;

use Attribute;

/**
 * Mendeklarasikan komponen anak (child component) yang digunakan di dalam template.
 * Sesuai keputusan pemisahan #[Uses] dan #[Child].
 */
#[Attribute(Attribute::TARGET_CLASS | Attribute::IS_REPEATABLE)]
final class Child
{
    /**
     * @param class-string $component FQCN kelas komponen anak.
     */
    public function __construct(
        public readonly string $component
    ) {}
}
