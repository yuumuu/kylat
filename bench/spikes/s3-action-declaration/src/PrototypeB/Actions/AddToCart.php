<?php

declare(strict_types=1);

namespace Kylat\SpikeS3\PrototypeB\Actions;

use Attribute;
use Kylat\SpikeS3\Common\User;
use Kylat\SpikeS3\Common\CartResult;

#[Attribute(Attribute::TARGET_CLASS)]
final class ServerAction {}

#[ServerAction]
final class AddToCart
{
    public function authorize(User $user, string $productId): bool
    {
        return $user->can('cart.update');
    }

    public function handle(string $productId, int $qty): CartResult
    {
        return new CartResult(true, $qty, 15000 * $qty);
    }
}
