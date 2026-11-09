<?php

declare(strict_types=1);

namespace App\Components;

use Kylat\Component;
use Kylat\Attributes\Client;

/**
 * Contoh komponen single-file Kylat (KEP-34).
 * Logika PHP dan template berada dalam satu berkas *.kylat.php.
 */
final class Counter extends Component
{
    public int $count = 0;
    public string $label = 'Counter';

    #[Client]
    public function increment(): void
    {
        $this->count += 1;
    }

    #[Client]
    public function decrement(): void
    {
        $this->count -= 1;
    }
}
?>
<div class="counter">
    <h1>{{ $label }}</h1>
    <button on:click="decrement">-</button>
    <span>{{ $count }}</span>
    <button on:click="increment">+</button>
    @if($count > 0)
        <p>Positif</p>
    @elseif($count === 0)
        <p>Nol</p>
    @else
        <p>Negatif</p>
    @endif
</div>
