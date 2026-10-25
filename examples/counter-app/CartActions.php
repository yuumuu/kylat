<?php

declare(strict_types=1);

namespace App\Actions;

interface CartActions
{
    public function authorize(): bool;

    public function add(string $productId, int $qty): bool;
}
