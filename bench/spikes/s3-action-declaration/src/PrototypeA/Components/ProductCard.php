<?php

declare(strict_types=1);

namespace Kylat\SpikeS3\PrototypeA\Components;

use Kylat\SpikeS3\Common\Component;
use Kylat\SpikeS3\Common\Uses;
use Kylat\SpikeS3\Common\Client;
use Kylat\SpikeS3\Common\CartResult;
use Kylat\SpikeS3\PrototypeA\Contracts\CartActions;

#[Uses(CartActions::class)]
final class ProductCard extends Component
{
    public string $productId = 'p-101';
    public int $qty = 1;

    #[Client]
    public function handleAdd(): CartResult
    {
        // PHPStan menganalisis pemanggilan $this->server(CartActions::class)->add(...)
        // secara native dengan inferensi tipe balik CartResult dan parameter (string, int).
        return $this->server(CartActions::class)->add($this->productId, $this->qty);
    }
}
