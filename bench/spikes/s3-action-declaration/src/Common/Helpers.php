<?php

declare(strict_types=1);

namespace Kylat\SpikeS3\Common;

use Attribute;

#[Attribute(Attribute::TARGET_METHOD)]
final class Client {}

#[Attribute(Attribute::TARGET_METHOD)]
final class Server {}

final class User
{
    public function __construct(public string $id) {}

    public function can(string $ability, mixed $target = null): bool
    {
        return true;
    }
}

final class CartResult
{
    public function __construct(
        public bool $success,
        public int $totalItems,
        public int $subtotal
    ) {}
}
