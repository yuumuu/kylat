<?php

declare(strict_types=1);

namespace Kylat\Attributes;

use Attribute;

/**
 * Menandai method sebagai aksi server (dieksekusi melalui panggilan RPC batch POST /_kylat/call).
 */
#[Attribute(Attribute::TARGET_METHOD)]
final class Server
{
}
