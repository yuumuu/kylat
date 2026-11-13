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
final class Cart extends Component
{
    #[Prop]
    public string $productId = 'sku-1';

    public int $qty = 0;

    #[Client]
    public function add(): void
    {
        $this->qty += 1;
    }

    #[Server]
    public function submit(): void
    {
        $this->server(CartActions::class)->add($this->productId, $this->qty);
    }
}
?>
<div class="cart">
    <h2>Keranjang</h2>
    <div class="row">
        <button class="add" on:click="add()">Tambah</button>
        <span class="qty">{{ $qty }}</span>
        <button class="submit" on:click="submit()">Simpan ke Server</button>
    </div>
    <p class="status" aria-live="polite"></p>
</div>
