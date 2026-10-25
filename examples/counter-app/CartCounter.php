<?php

declare(strict_types=1);

namespace App\Components;

use Kylat\Component;
use Kylat\Attributes\Prop;
use Kylat\Attributes\Client;
use Kylat\Attributes\Server;
use Kylat\Attributes\Uses;
use App\Actions\CartActions;

#[Uses(CartActions::class)]
final class CartCounter extends Component
{
    #[Prop]
    public string $productId;

    public int $qty = 1;

    #[Client]
    public function increment(): void
    {
        $this->qty++;
    }

    #[Server]
    public function submitOrder(): void
    {
        $this->server(CartActions::class)->add($this->productId, $this->qty);
    }
}
