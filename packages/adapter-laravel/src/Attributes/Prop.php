<?php

declare(strict_types=1);

namespace Kylat\Attributes;

use Attribute;

/**
 * Menandai properti sebagai props yang diinjeksi dari luar (misal dari Blade data-props).
 */
#[Attribute(Attribute::TARGET_PROPERTY)]
final class Prop
{
    public function __construct(
        public readonly bool $required = false
    ) {}
}
