<?php

declare(strict_types=1);

namespace Kylat\Attributes;

use Attribute;

/**
 * Menandai method sebagai interaksi sisi client (hanya berjalan di browser).
 */
#[Attribute(Attribute::TARGET_METHOD)]
final class Client
{
}
