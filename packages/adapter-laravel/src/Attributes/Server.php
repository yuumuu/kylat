<?php

declare(strict_types=1);

namespace Kylat\Attributes;

use Attribute;

/**
 * Menandai method sebagai aksi server (dieksekusi melalui panggilan RPC batch POST /_kylat/call).
 * Secara default merupakan mutasi (read: false) yang wajib menyertakan Idempotency-Key.
 */
#[Attribute(Attribute::TARGET_METHOD)]
final class Server
{
    public function __construct(
        public readonly bool $read = false
    ) {}
}
