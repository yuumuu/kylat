<?php

declare(strict_types=1);

namespace Kylat\Laravel\Support;

use PDO;

/**
 * Orkestrasi relay outbox untuk dipakai command/worker aplikasi.
 */
final class OutboxRelayRunner
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly OutboxHandlerRegistry $handlers,
        private readonly int $maxAttempts = OutboxRelay::DEFAULT_MAX_ATTEMPTS,
        private readonly int $leaseSeconds = OutboxRelay::DEFAULT_LEASE_SECONDS
    ) {
    }

    /**
     * @return int jumlah event yang diproses pada pemanggilan ini
     */
    public function run(int $maxEvents = 1000): int
    {
        $relay = new OutboxRelay($this->pdo, $this->maxAttempts, $this->leaseSeconds);

        return $relay->run(
            fn (array $event): mixed => $this->handlers->dispatch($event),
            $maxEvents
        );
    }
}
