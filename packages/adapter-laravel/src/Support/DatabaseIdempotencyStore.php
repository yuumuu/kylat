<?php

declare(strict_types=1);

namespace Kylat\Laravel\Support;

use PDO;
use PDOException;
use RuntimeException;
use Throwable;

/**
 * Driver idempotensi database (MySQL/PostgreSQL) dengan transaksi dan outbox.
 *
 * Satu panggilan execute() = satu transaksi. Handler bisnis dan enqueueOutbox()
 * memakai PDO yang sama; exception membatalkan seluruh transaksi.
 */
final class DatabaseIdempotencyStore
{
    public const RESPONSE_MAX_BYTES = 65536;
    public const IN_PROGRESS_LEASE_SECONDS = 30;
    public const DEFAULT_TTL_SECONDS = 86400;

    private static ?PDO $pdo = null;
    private static string $driver = '';

    public static function useConnection(PDO $pdo): void
    {
        self::$pdo = $pdo;
        self::$driver = (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    }

    public static function reset(): void
    {
        self::$pdo = null;
        self::$driver = '';
    }

    /**
     * @param callable(): array<string, mixed> $handler
     * @return array{status: 'completed'|'replay'|'conflict'|'in_progress', response?: array<string, mixed>}
     */
    public static function execute(
        string $identity,
        string $key,
        string $action,
        string $payloadHash,
        callable $handler
    ): array {
        $pdo = self::pdo();
        $keyColumn = self::quoteIdentifier('key');
        $now = self::now();
        $expiresAt = self::timestamp(time() + self::DEFAULT_TTL_SECONDS);
        $lockedUntil = self::timestamp(time() + self::IN_PROGRESS_LEASE_SECONDS);

        $pdo->beginTransaction();
        try {
            $insert = $pdo->prepare(
                "INSERT INTO kylat_idempotency_keys
                 (user_id, {$keyColumn}, action, payload_hash, status, response, attempts, locked_until, expires_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'in_progress', NULL, 1, ?, ?, ?, ?)"
            );
            $insert->execute([$identity, $key, $action, $payloadHash, $lockedUntil, $expiresAt, $now, $now]);
        } catch (PDOException $exception) {
            if (!self::isDuplicate($exception)) {
                $pdo->rollBack();
                throw $exception;
            }
            $pdo->rollBack();
            return self::inspectExisting($identity, $key, $payloadHash);
        }

        try {
            $response = $handler();
            $payload = self::encodeResponse($response);

            $update = $pdo->prepare(
                "UPDATE kylat_idempotency_keys
                 SET status = 'completed', response = ?, locked_until = NULL, updated_at = ?
                 WHERE user_id = ? AND {$keyColumn} = ? AND payload_hash = ?"
            );
            $update->execute([$payload, self::now(), $identity, $key, $payloadHash]);
            if ($update->rowCount() === 0) {
                throw new RuntimeException('Gagal menyimpan status idempotensi completed.');
            }

            $pdo->commit();
            return ['status' => 'completed', 'response' => $response];
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
    }

    /**
     * Menulis event outbox di transaksi yang sama dengan handler.
     *
     * @param array<string, mixed> $payload
     */
    public static function enqueueOutbox(string $eventType, array $payload): string
    {
        $pdo = self::pdo();
        if (!$pdo->inTransaction()) {
            throw new RuntimeException('enqueueOutbox wajib dipanggil di dalam transaksi idempotensi.');
        }

        $eventId = self::uuid();
        $insert = $pdo->prepare(
            'INSERT INTO kylat_outbox
             (event_id, event_type, payload, status, attempts, available_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, 0, ?, ?, ?)'
        );
        $insert->execute([
            $eventId,
            $eventType,
            self::encodeResponse($payload),
            'pending',
            self::now(),
            self::now(),
            self::now(),
        ]);

        return $eventId;
    }

    /** @return array{status: 'replay'|'conflict'|'in_progress', response?: array<string, mixed>} */
    private static function inspectExisting(string $identity, string $key, string $payloadHash): array
    {
        $pdo = self::pdo();
        $keyColumn = self::quoteIdentifier('key');
        $select = $pdo->prepare(
            "SELECT payload_hash, status, response, locked_until FROM kylat_idempotency_keys
             WHERE user_id = ? AND {$keyColumn} = ?"
        );
        $select->execute([$identity, $key]);
        $row = $select->fetch(PDO::FETCH_ASSOC);

        if (!is_array($row)) {
            throw new RuntimeException('Baris idempotensi hilang setelah konflik unique.');
        }

        if (!hash_equals((string) $row['payload_hash'], $payloadHash)) {
            return ['status' => 'conflict'];
        }

        if ((string) $row['status'] === 'completed') {
            $decoded = json_decode((string) $row['response'], true);
            return ['status' => 'replay', 'response' => is_array($decoded) ? $decoded : []];
        }

        return ['status' => 'in_progress'];
    }

    private static function pdo(): PDO
    {
        if (self::$pdo === null) {
            throw new RuntimeException('DatabaseIdempotencyStore belum memiliki koneksi PDO.');
        }
        return self::$pdo;
    }

    private static function isDuplicate(PDOException $exception): bool
    {
        $sqlState = (string) ($exception->getCode() ?? '');
        $driverCode = (int) ($exception->errorInfo[1] ?? 0);

        return $sqlState === '23000'
            || $sqlState === '23505'
            || $driverCode === 1062
            || $driverCode === 19;
    }

    private static function encodeResponse(array $response): string
    {
        try {
            $encoded = json_encode($response, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        } catch (Throwable $exception) {
            throw new RuntimeException('Respons idempotensi tidak dapat diserialisasi.', 0, $exception);
        }

        if (strlen($encoded) > self::RESPONSE_MAX_BYTES) {
            throw new RuntimeException('Respons idempotensi melebihi batas 64 KB.');
        }

        return $encoded;
    }

    private static function quoteIdentifier(string $identifier): string
    {
        return self::$driver === 'mysql' ? '`' . $identifier . '`' : '"' . $identifier . '"';
    }

    private static function now(): string
    {
        return self::timestamp(time());
    }

    private static function timestamp(int $timestamp): string
    {
        return date('Y-m-d H:i:s', $timestamp);
    }

    private static function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
