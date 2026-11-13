<?php

declare(strict_types=1);

namespace Kylat\Laravel\Support;

use RuntimeException;

/**
 * Registry handler outbox berdasarkan event_type.
 *
 * Aplikasi mendaftarkan handler idempotent saat service provider boot:
 *
 *   $registry->register('order.created', function (array $payload, array $event): void {
 *       // gunakan $event['event_id'] untuk deduplikasi
 *   });
 */
final class OutboxHandlerRegistry
{
    /** @var array<string, callable(array<string,mixed>, array<string,mixed>): void> */
    private array $handlers = [];

    /**
     * @param callable(array<string,mixed>, array<string,mixed>): void $handler
     */
    public function register(string $eventType, callable $handler): void
    {
        $this->handlers[$eventType] = $handler;
    }

    public function has(string $eventType): bool
    {
        return isset($this->handlers[$eventType]);
    }

    /**
     * @param array{id:int, event_id:string, event_type:string, payload:array<string,mixed>, attempts:int} $event
     */
    public function dispatch(array $event): void
    {
        $eventType = (string) ($event['event_type'] ?? '');
        if (!isset($this->handlers[$eventType])) {
            throw new RuntimeException("Handler outbox untuk event_type '{$eventType}' belum terdaftar.");
        }

        ($this->handlers[$eventType])($event['payload'] ?? [], $event);
    }
}
