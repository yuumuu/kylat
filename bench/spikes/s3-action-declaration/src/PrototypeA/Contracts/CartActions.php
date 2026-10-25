<?php

declare(strict_types=1);

namespace Kylat\SpikeS3\PrototypeA\Contracts;

use Kylat\SpikeS3\Common\CartResult;

/**
 * Kontrak aksi server untuk operasi keranjang belanja.
 */
interface CartActions
{
    public function add(string $productId, int $qty): CartResult;

    public function remove(string $productId): CartResult;
}
