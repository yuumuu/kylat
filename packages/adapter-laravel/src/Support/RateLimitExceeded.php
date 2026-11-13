<?php

declare(strict_types=1);

namespace Kylat\Laravel\Support;

use RuntimeException;

final class RateLimitExceeded extends RuntimeException
{
    public function __construct(public readonly int $retryAfterSeconds)
    {
        parent::__construct('Rate limit terlampaui.');
    }
}
