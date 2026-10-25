<?php

declare(strict_types=1);

namespace Kylat\SpikeS3\PrototypeA\Actions;

use Kylat\SpikeS3\Common\User;
use Kylat\SpikeS3\Common\CartResult;
use Kylat\SpikeS3\PrototypeA\Contracts\CartActions;

final class CartActionHandler implements CartActions
{
    public function authorize(User $user, string $productId): bool
    {
        return $user->can('cart.update');
    }

    public function add(string $productId, int $qty): CartResult
    {
        return new CartResult(true, $qty, 15000 * $qty);
    }

    public function remove(string $productId): CartResult
    {
        return new CartResult(true, 0, 0);
    }
}
