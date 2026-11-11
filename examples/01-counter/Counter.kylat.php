<?php

declare(strict_types=1);

namespace App\Components;

use Kylat\Component;
use Kylat\Attributes\Prop;
use Kylat\Attributes\Client;
use Kylat\Attributes\Server;
use Kylat\Attributes\Uses;
use App\Actions\CounterActions;

/**
 * Contoh Komponen Single-File Resmi Kylat (ADR 0004 / KEP-34).
 * Menggabungkan class PHP dan template Blade/HTML dalam satu berkas *.kylat.php.
 */
#[Uses(CounterActions::class)]
final class Counter extends Component
{
    #[Prop]
    public int $initialCount = 0;

    public int $count = 0;

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

    #[Server]
    public function syncToServer(): void
    {
        $this->server(CounterActions::class)->saveCount($this->count);
    }
}
?>
<div class="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md space-y-4">
    <h2 class="text-xl font-bold text-gray-900">Kylat Counter Island</h2>
    <div class="flex items-center space-x-4">
        <button on:click="decrement()" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded">-</button>
        <span data-testid="count" class="text-2xl font-mono">{{ $count }}</span>
        <button on:click="increment()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">+</button>
    </div>
    <div>
        <button on:click="syncToServer()" class="w-full mt-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium">
            Simpan ke Server (RPC)
        </button>
    </div>
</div>
