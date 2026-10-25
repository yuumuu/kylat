<?php

declare(strict_types=1);

namespace App\Components;

use Kylat\Component;
use Kylat\Attributes\Prop;
use Kylat\Attributes\Client;
use Kylat\Attributes\Server;
use Kylat\Attributes\Uses;
use App\Actions\CounterActions;

#[Uses(CounterActions::class)]
final class Counter extends Component
{
    #[Prop]
    public int $initialCount = 0;

    public int $count = 0;

    #[Client]
    public function increment(): void
    {
        $this->count++;
    }

    #[Client]
    public function decrement(): void
    {
        $this->count--;
    }

    #[Server]
    public function syncToServer(): void
    {
        $this->server(CounterActions::class)->saveCount($this->count);
    }
}
