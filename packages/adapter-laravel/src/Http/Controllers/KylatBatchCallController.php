<?php

declare(strict_types=1);

namespace Kylat\Laravel\Http\Controllers;

use Kylat\Laravel\Actions\ActionRegistry;
use ReflectionMethod;
use ReflectionNamedType;
use Throwable;

/**
 * Controller penanganan batch RPC POST /_kylat/call sesuai spec/protocol.schema.json.
 */
final class KylatBatchCallController
{
    public const MAX_BODY_BYTES = 256 * 1024; // 256 KB
    public const MAX_CALLS_PER_BATCH = 20;
    public const MAX_JSON_DEPTH = 16;

    /**
     * Memproses request batch mentah (mendukung array request maupun integrasi Illuminate\Http\Request).
     *
     * @param array<string, mixed> $payload
     * @return array{results: list<array<string, mixed>>}
     */
    public function handle(array $payload): array
    {
        /** @var mixed $rawCalls */
        $rawCalls = $payload['calls'] ?? null;

        if (!is_array($rawCalls)) {
            throw new \InvalidArgumentException("Payload batch harus memiliki array 'calls'.");
        }

        if (count($rawCalls) > self::MAX_CALLS_PER_BATCH) {
            throw new \InvalidArgumentException(
                sprintf("Jumlah calls dalam 1 batch (%d) melebihi batas maksimum (%d).", count($rawCalls), self::MAX_CALLS_PER_BATCH)
            );
        }

        $results = [];

        foreach ($rawCalls as $call) {
            if (!is_array($call)) continue;

            $callId = (string) ($call['id'] ?? uniqid('call_'));
            $action = (string) ($call['action'] ?? '');
            /** @var array<string, mixed> $args */
            $args = isset($call['args']) && is_array($call['args']) ? $call['args'] : [];

            $results[] = $this->dispatchCall($callId, $action, $args);
        }

        return ['results' => $results];
    }

    /**
     * Mengeksekusi satu aksi server individual.
     *
     * @param array<string, mixed> $args
     * @return array<string, mixed>
     */
    private function dispatchCall(string $id, string $action, array $args): array
    {
        try {
            if (!str_contains($action, '::')) {
                return [
                    'id' => $id,
                    'ok' => false,
                    'error' => [
                        'type' => 'kylat:action_error',
                        'message' => sprintf("Format aksi '%s' tidak valid. Gunakan format 'ContractClass::method'.", $action),
                    ],
                ];
            }

            [$contract, $method] = explode('::', $action, 2);

            $instance = ActionRegistry::resolve($contract);
            if ($instance === null) {
                return [
                    'id' => $id,
                    'ok' => false,
                    'error' => [
                        'type' => 'kylat:not_found',
                        'message' => sprintf("Aksi server untuk kontrak '%s' tidak ditemukan atau belum didaftarkan.", $contract),
                    ],
                ];
            }

            if (!method_exists($instance, $method)) {
                return [
                    'id' => $id,
                    'ok' => false,
                    'error' => [
                        'type' => 'kylat:not_found',
                        'message' => sprintf("Method '%s' tidak ditemukan pada kontrak '%s'.", $method, $contract),
                    ],
                ];
            }

            // Bind argumen secara reflektif
            $refMethod = new ReflectionMethod($instance, $method);
            $invokedArgs = [];

            foreach ($refMethod->getParameters() as $param) {
                $paramName = $param->getName();
                if (array_key_exists($paramName, $args)) {
                    $invokedArgs[] = $args[$paramName];
                } elseif ($param->isDefaultValueAvailable()) {
                    $invokedArgs[] = $param->getDefaultValue();
                } else {
                    return [
                        'id' => $id,
                        'ok' => false,
                        'error' => [
                            'type' => 'kylat:validation',
                            'message' => sprintf("Parameter wajib '$%s' tidak disertakan dalam pemanggilan '%s'.", $paramName, $action),
                        ],
                    ];
                }
            }

            $output = $refMethod->invokeArgs($instance, $invokedArgs);

            return [
                'id' => $id,
                'ok' => true,
                'data' => $output,
            ];
        } catch (Throwable $e) {
            return [
                'id' => $id,
                'ok' => false,
                'error' => [
                    'type' => 'kylat:server_error',
                    'message' => $e->getMessage(),
                ],
            ];
        }
    }
}
