<?php

declare(strict_types=1);

namespace App\Actions;

use Kylat\Attributes\Server;

interface CartActions
{
    public function authorize(): bool;

    #[Server]
    public function add(string $productId, int $qty): bool;
}
