<?php

declare(strict_types=1);

namespace Kylat\Laravel\Http\Controllers;

use Kylat\Laravel\Actions\ActionRegistry;
use Kylat\Laravel\Support\IdempotencyStore;
use ReflectionMethod;
use ReflectionNamedType;
use Throwable;

/**
 * Controller penanganan batch RPC POST /_kylat/call sesuai spec/protocol.schema.json & spec/threat-model.md.
 */
final class KylatBatchCallController
{
    public const MAX_BODY_BYTES = 256 * 1024; // 256 KB
    public const MAX_CALLS_PER_BATCH = 20;
    public const MAX_JSON_DEPTH = 16;
    /**
     * Batas waktu eksekusi aman per-call aksi server (detik).
     * Wajib lebih kecil dari batas lease in_progress (IdempotencyStore::IN_PROGRESS_LEASE_SECONDS = 30)
     * untuk mencegah request kedua merebut lease saat request pertama masih berjalan.
     */
    public const MAX_ACTION_EXECUTION_SECONDS = 20;

    /**
     * Memproses request batch mentah.
     *
     * @param array<string, mixed> $payload
     * @param array<string, string> $headers
     * @return array{results: list<array<string, mixed>>}
     */
    public function handle(array $payload, array $headers = []): array
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
        $headerIdempKey = $headers['Idempotency-Key'] ?? $headers['idempotency-key'] ?? null;

        foreach ($rawCalls as $call) {
            if (!is_array($call)) continue;

            $callId = (string) ($call['id'] ?? uniqid('call_'));
            $action = (string) ($call['action'] ?? '');
            /** @var array<string, mixed> $args */
            $args = isset($call['args']) && is_array($call['args']) ? $call['args'] : [];
            // Jalur resmi: hanya terima dari call.idempotencyKey atau HTTP Header (jalur meta.* ditolak)
            $idempotencyKey = (string) ($call['idempotencyKey'] ?? $headerIdempKey ?? '');

            if (!str_contains($action, '::')) {
                $results[] = [
                    'id' => $callId,
                    'ok' => false,
                    'error' => [
                        'type' => 'kylat:action_error',
                        'message' => sprintf("Format aksi '%s' tidak valid. Gunakan format 'ContractClass::method'.", $action),
                    ],
                ];
                continue;
            }

            [$contract, $method] = explode('::', $action, 2);

            // Invarian Keamanan Dokumen 3 §4: Mutasi WAJIB menyertakan Idempotency-Key
            $isMutation = $this->isMutationAction($contract, $method);
            if ($isMutation && $idempotencyKey === '') {
                $results[] = [
                    'id' => $callId,
                    'ok' => false,
                    'error' => [
                        'type' => 'kylat:validation',
                        'message' => sprintf("Aksi mutasi '%s' wajib menyertakan Idempotency-Key pada header HTTP atau payload call.", $action),
                    ],
                ];
                continue;
            }

            // Tegakkan batasan panjang Idempotency-Key sesuai skema (minLength: 8, maxLength: 128)
            if ($idempotencyKey !== '' && (strlen($idempotencyKey) < 8 || strlen($idempotencyKey) > 128)) {
                $results[] = [
                    'id' => $callId,
                    'ok' => false,
                    'error' => [
                        'type' => 'kylat:validation',
                        'message' => sprintf("Idempotency-Key '%s' tidak valid. Panjang karakter harus antara 8 hingga 128 (diberikan: %d).", $idempotencyKey, strlen($idempotencyKey)),
                    ],
                ];
                continue;
            }

            // Pengecekan Idempotency-Key, Kanonikalisasi JSON, & Anti-Race-Condition
            $payloadHash = '';
            if ($idempotencyKey !== '') {
                $payloadHash = IdempotencyStore::computeCanonicalHash($action, $args);
                $lock = IdempotencyStore::acquire($idempotencyKey, $payloadHash);

                if ($lock['status'] === 'conflict') {
                    $results[] = [
                        'id' => $callId,
                        'ok' => false,
                        'error' => [
                            'type' => 'kylat:idempotency_conflict',
                            'message' => sprintf(
                                "Idempotency-Key '%s' telah digunakan untuk payload yang berbeda.",
                                $idempotencyKey
                            ),
                        ],
                    ];
                    continue;
                }

                if ($lock['status'] === 'in_progress') {
                    $results[] = [
                        'id' => $callId,
                        'ok' => false,
                        'error' => [
                            'type' => 'kylat:in_progress',
                            'message' => sprintf(
                                "Operasi dengan Idempotency-Key '%s' sedang diproses di server. Silakan tunggu.",
                                $idempotencyKey
                            ),
                        ],
                    ];
                    continue;
                }

                if ($lock['status'] === 'completed' && isset($lock['response'])) {
                    $cached = $lock['response'];
                    $cached['id'] = $callId; // Sesuaikan ID panggilan saat ini
                    $results[] = $cached;
                    continue;
                }
            }

            try {
                // Batasi eksekusi aksi maksimal 20 detik agar selalu selesai/abort sebelum batas lease 30 detik
                if (function_exists('set_time_limit') && !in_array('set_time_limit', explode(',', (string) ini_get('disable_functions')), true)) {
                    @set_time_limit(self::MAX_ACTION_EXECUTION_SECONDS);
                }
                $result = $this->dispatchCall($callId, $action, $args);

                if ($idempotencyKey !== '') {
                    if ($result['ok'] ?? false) {
                        IdempotencyStore::complete($idempotencyKey, $payloadHash, $result);
                    } else {
                        IdempotencyStore::markFailed($idempotencyKey, $payloadHash);
                    }
                }

                $results[] = $result;
            } catch (\Throwable $e) {
                if ($idempotencyKey !== '') {
                    IdempotencyStore::release($idempotencyKey);
                }
                throw $e;
            }
        }

        return ['results' => $results];
    }

    /**
     * Mengeksekusi satu aksi server individual dengan otorisasi & strict types tanpa koersi.
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

            // Mencegah pemanggilan magic method
            if (str_starts_with($method, '__')) {
                return [
                    'id' => $id,
                    'ok' => false,
                    'error' => [
                        'type' => 'kylat:forbidden',
                        'message' => "Pemanggilan magic method dilarang.",
                    ],
                ];
            }

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

            // 1. Pengecekan Otorisasi (Default Deny)
            if (method_exists($instance, 'authorize')) {
                $isAuthorized = (bool) $instance->authorize();
                if (!$isAuthorized) {
                    return [
                        'id' => $id,
                        'ok' => false,
                        'error' => [
                            'type' => 'kylat:unauthorized',
                            'message' => sprintf("Otorisasi ditolak untuk aksi '%s'.", $action),
                        ],
                    ];
                }
            }

            // 2. Bind & Validasi Strict Types Tanpa Koersi
            $refMethod = new ReflectionMethod($instance, $method);
            if (!$refMethod->isPublic()) {
                return [
                    'id' => $id,
                    'ok' => false,
                    'error' => [
                        'type' => 'kylat:forbidden',
                        'message' => sprintf("Method '%s' harus bersifat public.", $method),
                    ],
                ];
            }

            $invokedArgs = [];

            foreach ($refMethod->getParameters() as $param) {
                $paramName = $param->getName();
                if (array_key_exists($paramName, $args)) {
                    $val = $args[$paramName];

                    // Pemeriksaan tipe ketat (tanpa koersi)
                    $type = $param->getType();
                    if ($type instanceof ReflectionNamedType) {
                        $expectedType = $type->getName();
                        if ($expectedType === 'int' && !is_int($val)) {
                            return [
                                'id' => $id,
                                'ok' => false,
                                'error' => [
                                    'type' => 'kylat:validation',
                                    'message' => sprintf("Parameter '$%s' harus bertipe integer murni tanpa koersi.", $paramName),
                                ],
                            ];
                        }
                        if ($expectedType === 'string' && !is_string($val)) {
                            return [
                                'id' => $id,
                                'ok' => false,
                                'error' => [
                                    'type' => 'kylat:validation',
                                    'message' => sprintf("Parameter '$%s' harus bertipe string murni.", $paramName),
                                ],
                            ];
                        }
                        if ($expectedType === 'bool' && !is_bool($val)) {
                            return [
                                'id' => $id,
                                'ok' => false,
                                'error' => [
                                    'type' => 'kylat:validation',
                                    'message' => sprintf("Parameter '$%s' harus bertipe boolean murni.", $paramName),
                                ],
                            ];
                        }
                    }

                    $invokedArgs[] = $val;
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

    /**
     * Memeriksa apakah aksi server merupakan mutasi (default) atau baca murni (#[Server(read: true)]).
     */
    private function isMutationAction(string $contract, string $method): bool
    {
        $instance = ActionRegistry::resolve($contract);
        if ($instance === null || !method_exists($instance, $method)) {
            return true; // Default adalah mutasi (default-deny)
        }

        $refMethod = new ReflectionMethod($instance, $method);
        foreach ($refMethod->getAttributes() as $attr) {
            $attrName = $attr->getName();
            if (str_ends_with($attrName, 'Server')) {
                $args = $attr->getArguments();
                if (isset($args['read']) && $args['read'] === true) {
                    return false;
                }
                if (isset($args[0]) && $args[0] === true) {
                    return false;
                }
            }
        }

        return true;
    }
}

