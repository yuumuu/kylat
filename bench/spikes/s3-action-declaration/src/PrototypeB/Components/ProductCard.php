<?php

declare(strict_types=1);

namespace Kylat\SpikeS3\PrototypeB\Components;

use Kylat\SpikeS3\Common\Component;
use Kylat\SpikeS3\Common\Uses;
use Kylat\SpikeS3\Common\Client;
use Kylat\SpikeS3\Common\CartResult;
use Kylat\SpikeS3\PrototypeB\Actions\AddToCart;

#[Uses(AddToCart::class)]
final class ProductCard extends Component
{
    public string $productId = 'p-102';
    public int $qty = 1;

    #[Client]
    public function handleAdd(): CartResult
    {
        return $this->server(AddToCart::class)->handle($this->productId, $this->qty);
    }
}
