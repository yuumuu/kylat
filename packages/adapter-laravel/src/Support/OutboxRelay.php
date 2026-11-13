<?php

declare(strict_types=1);

namespace Kylat\Laravel\Support;

use PDO;
use RuntimeException;
use Throwable;

/**
 * Relay transactional outbox.
 *
 * Semantik: at-least-once. Handler wajib idempotent (gunakan event_id).
 * Klaim memakai FOR UPDATE SKIP LOCKED pada MySQL 8+/PostgreSQL; SQLite
 * hanya untuk unit test single-process.
 */
final class OutboxRelay
{
    public const DEFAULT_MAX_ATTEMPTS = 5;
    public const DEFAULT_LEASE_SECONDS = 60;
    public const MAX_BACKOFF_SECONDS = 3600;
    public const MAX_ERROR_LENGTH = 2000;

    public function __construct(
        private readonly PDO $pdo,
        private readonly int $maxAttempts = self::DEFAULT_MAX_ATTEMPTS,
        private readonly int $leaseSeconds = self::DEFAULT_LEASE_SECONDS
    ) {
        if ($maxAttempts < 1) {
            throw new RuntimeException('maxAttempts minimal 1.');
        }
        if ($leaseSeconds < 1) {
            throw new RuntimeException('leaseSeconds minimal 1.');
        }
    }

    /**
     * @return list<array{id:int, event_id:string, event_type:string, payload:array<string,mixed>, attempts:int}>
     */
    public function claim(int $limit = 10): array
    {
        $limit = max(1, min(1000, $limit));
        $driver = (string) $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        $lockClause = in_array($driver, ['mysql', 'pgsql'], true)
            ? ' FOR UPDATE SKIP LOCKED'
            : '';

        $now = self::now();
        $this->pdo->beginTransaction();

        try {
            $select = $this->pdo->prepare(
                "SELECT id, event_id, event_type, payload, attempts
                 FROM kylat_outbox
                 WHERE status IN ('pending', 'processing')
                   AND available_at <= ?
                   AND (locked_until IS NULL OR locked_until <= ?)
                 ORDER BY id
                 LIMIT {$limit}{$lockClause}"
            );
            $select->execute([$now, $now]);
            $rows = $select->fetchAll(PDO::FETCH_ASSOC);

            if ($rows === []) {
                $this->pdo->commit();
                return [];
            }

            $leaseUntil = self::timestamp(time() + $this->leaseSeconds);
            $update = $this->pdo->prepare(
                "UPDATE kylat_outbox
                 SET status = 'processing', attempts = attempts + 1, locked_until = ?, updated_at = ?
                 WHERE id = ?"
            );
            $invalidate = $this->pdo->prepare(
                "UPDATE kylat_outbox
                 SET status = 'failed', locked_until = NULL, last_error = ?, updated_at = ?
                 WHERE id = ?"
            );

            $events = [];
            foreach ($rows as $row) {
                $id = (int) $row['id'];
                $update->execute([$leaseUntil, $now, $id]);

                $payload = json_decode((string) $row['payload'], true);
                if (!is_array($payload)) {
                    $invalidate->execute(['payload bukan object JSON yang valid', $now, $id]);
                    continue;
                }

                $events[] = [
                    'id' => $id,
                    'event_id' => (string) $row['event_id'],
                    'event_type' => (string) $row['event_type'],
                    'payload' => $payload,
                    'attempts' => ((int) $row['attempts']) + 1,
                ];
            }

            $this->pdo->commit();

            return $events;
        } catch (Throwable $exception) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $exception;
        }
    }

    public function complete(int $id): void
    {
        $now = self::now();
        $update = $this->pdo->prepare(
            "UPDATE kylat_outbox
             SET status = 'completed', locked_until = NULL, last_error = NULL, updated_at = ?
             WHERE id = ? AND status = 'processing'"
        );
        $update->execute([$now, $id]);
    }

    /**
     * @param array{id:int, attempts:int} $event
     */
    public function fail(array $event, string $error): void
    {
        $attempts = (int) $event['attempts'];
        $now = self::now();
        $failed = $attempts >= $this->maxAttempts;
        $status = $failed ? 'failed' : 'pending';
        $availableAt = $failed
            ? $now
            : self::timestamp(time() + self::backoffSeconds($attempts));
        $message = substr($error, 0, self::MAX_ERROR_LENGTH);

        $update = $this->pdo->prepare(
            "UPDATE kylat_outbox
             SET status = ?, available_at = ?, locked_until = NULL, last_error = ?, updated_at = ?
             WHERE id = ?"
        );
        $update->execute([$status, $availableAt, $message, $now, (int) $event['id']]);
    }

    /**
     * @param callable(array{id:int, event_id:string, event_type:string, payload:array<string,mixed>, attempts:int}): void $handler
     */
    public function run(callable $handler, int $maxEvents = 100): int
    {
        $processed = 0;

        while ($processed < $maxEvents) {
            $events = $this->claim(min(10, $maxEvents - $processed));
            if ($events === []) {
                break;
            }

            foreach ($events as $event) {
                try {
                    $handler($event);
                    $this->complete((int) $event['id']);
                } catch (Throwable $exception) {
                    $this->fail($event, $exception->getMessage());
                }
                $processed++;
            }
        }

        return $processed;
    }

    private static function backoffSeconds(int $attempts): int
    {
        $exponent = max(0, $attempts - 1);
        $delay = 10 * (2 ** $exponent);

        return (int) min(self::MAX_BACKOFF_SECONDS, $delay);
    }

    private static function now(): string
    {
        return self::timestamp(time());
    }

    private static function timestamp(int $timestamp): string
    {
        return date('Y-m-d H:i:s', $timestamp);
    }
}
