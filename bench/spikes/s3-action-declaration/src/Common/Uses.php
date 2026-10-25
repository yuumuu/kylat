<?php

declare(strict_types=1);

namespace Kylat\SpikeS3\Common;

use Attribute;

#[Attribute(Attribute::TARGET_CLASS | Attribute::IS_REPEATABLE)]
final class Uses
{
    /**
     * @param class-string $contract
     */
    public function __construct(public string $contract) {}
}
