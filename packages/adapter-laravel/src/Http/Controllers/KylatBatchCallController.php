<?php

declare(strict_types=1);

namespace Kylat\Laravel\Http\Controllers;

use Kylat\Laravel\Actions\ActionRegistry;
use Kylat\Laravel\Support\IdempotencyStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use JsonException;
use ReflectionMethod;
use ReflectionNamedType;
use ReflectionType;
use ReflectionUnionType;
use Throwable;

/**
 * Controller batch RPC POST /_kylat/call sesuai spec/protocol.schema.json.
 *
 * Prinsip keamanan:
 * - hanya kontrak yang terdaftar yang dapat dipanggil;
 * - hanya method dengan atribut #[Server] pada kontrak/implementasi;
 * - otorisasi wajib ada dan default-deny;
 * - pesan exception internal tidak dikirim ke client.
 */
final class KylatBatchCallController
{
    public const MAX_BODY_BYTES = 256 * 1024;
    public const MAX_CALLS_PER_BATCH = 20;
    public const MAX_JSON_DEPTH = 16;
    public const MAX_STRING_LENGTH = 10_000;
    public const MAX_ARRAY_ITEMS = 1_000;
    public const MAX_ACTION_EXECUTION_SECONDS = 10;

    /**
     * @param array<string, mixed> $payload
     * @param array<string, string> $headers
     * @return array{results: list<array<string, mixed>>}
     */
    public function handle(array $payload, array $headers = [], int $bodyBytes = 0): array
    {
        if ($bodyBytes > self::MAX_BODY_BYTES) {
            throw new \InvalidArgumentException('Ukuran body melebihi batas 256 KB.');
        }

        foreach (array_keys($payload) as $payloadKey) {
            if ($payloadKey !== 'calls') {
                throw new \InvalidArgumentException("Properti payload '$payloadKey' tidak dikenal.");
            }
        }

        $rawCalls = $payload['calls'] ?? null;
        if (!is_array($rawCalls) || !array_is_list($rawCalls)) {
            throw new \InvalidArgumentException("Payload batch harus memiliki array 'calls' berupa list.");
        }
        if (count($rawCalls) === 0) {
            throw new \InvalidArgumentException('Batch tidak boleh kosong.');
        }
        if (count($rawCalls) > self::MAX_CALLS_PER_BATCH) {
            throw new \InvalidArgumentException(
                sprintf(
                    'Jumlah calls dalam 1 batch (%d) melebihi batas maksimum (%d).',
                    count($rawCalls),
                    self::MAX_CALLS_PER_BATCH
                )
            );
        }

        $results = [];
        $headerKey = count($rawCalls) === 1
            ? ($headers['Idempotency-Key'] ?? $headers['idempotency-key'] ?? null)
            : null;

        foreach ($rawCalls as $index => $call) {
            $callId = is_array($call) && isset($call['id']) && is_string($call['id'])
                ? $call['id']
                : 'call_' . $index;

            $structuralError = $this->validateCallShape($call);
            if ($structuralError !== null) {
                $results[] = $this->errorResult($callId, 'kylat:validation', $structuralError);
                continue;
            }

            /** @var array<string, mixed> $call */
            $action = $call['action'];
            $args = $call['args'];

            if (!$this->isValidCallId($callId)) {
                $results[] = $this->errorResult(
                    'call_' . $index,
                    'kylat:validation',
                    "Call id wajib cocok dengan ^[a-zA-Z0-9_-]+$ dan maksimal 64 karakter."
                );
                continue;
            }

            if (strlen($action) > 128 || !preg_match('/^[A-Za-z_][A-Za-z0-9_\\\\]*(?:::|\.)[A-Za-z_][A-Za-z0-9_]*$/', $action)) {
                $results[] = $this->errorResult(
                    $callId,
                    'kylat:action_error',
                    sprintf(
                        "Format aksi '%s' tidak valid. Gunakan format 'ContractClass::method'.",
                        $action
                    )
                );
                continue;
            }

            if (array_is_list($args) && count($args) > 0) {
                $results[] = $this->errorResult(
                    $callId,
                    'kylat:validation',
                    "Argumen aksi wajib berupa object JSON, bukan array list."
                );
                continue;
            }

            $argsError = $this->validateValue($args, 0);
            if ($argsError !== null) {
                $results[] = $this->errorResult($callId, 'kylat:validation', $argsError);
                continue;
            }

            $idempotencyKey = $call['idempotencyKey'] ?? $headerKey ?? '';
            if (!is_string($idempotencyKey)) {
                $results[] = $this->errorResult(
                    $callId,
                    'kylat:validation',
                    'Idempotency-Key wajib berupa string.'
                );
                continue;
            }

            [$contract, $method] = preg_split('/::|\\./', $action, 2);
            $isMutation = $this->isMutationAction($contract, $method);

            if ($isMutation && $idempotencyKey === '') {
                $results[] = $this->errorResult(
                    $callId,
                    'kylat:validation',
                    sprintf(
                        "Aksi mutasi '%s' wajib menyertakan Idempotency-Key pada header HTTP atau payload call.",
                        $action
                    )
                );
                continue;
            }

            if ($idempotencyKey !== '' && (strlen($idempotencyKey) < 8 || strlen($idempotencyKey) > 128)) {
                $results[] = $this->errorResult(
                    $callId,
                    'kylat:validation',
                    sprintf(
                        "Idempotency-Key '%s' tidak valid. Panjang karakter harus antara 8 hingga 128 (diberikan: %d).",
                        $idempotencyKey,
                        strlen($idempotencyKey)
                    )
                );
                continue;
            }

            $storeKey = $idempotencyKey !== '' ? $this->scopeIdempotencyKey($idempotencyKey) : '';
            $payloadHash = '';
            if ($idempotencyKey !== '') {
                $payloadHash = IdempotencyStore::computeCanonicalHash($action, $args);
                $lock = IdempotencyStore::acquire($storeKey, $payloadHash);

                if ($lock['status'] === 'conflict') {
                    $results[] = $this->errorResult(
                        $callId,
                        'kylat:idempotency_conflict',
                        sprintf(
                            "Idempotency-Key '%s' telah digunakan untuk payload yang berbeda.",
                            $idempotencyKey
                        )
                    );
                    continue;
                }

                if ($lock['status'] === 'in_progress') {
                    $results[] = $this->errorResult(
                        $callId,
                        'kylat:in_progress',
                        sprintf(
                            "Operasi dengan Idempotency-Key '%s' sedang diproses di server. Silakan tunggu.",
                            $idempotencyKey
                        )
                    );
                    continue;
                }

                if ($lock['status'] === 'completed' && isset($lock['response'])) {
                    $cached = $lock['response'];
                    $cached['id'] = $callId;
                    $results[] = $cached;
                    continue;
                }
            }

            try {
                if (
                    function_exists('set_time_limit') &&
                    !in_array('set_time_limit', explode(',', (string) ini_get('disable_functions')), true)
                ) {
                    @set_time_limit(self::MAX_ACTION_EXECUTION_SECONDS);
                }

                if ($idempotencyKey !== '') {
                    IdempotencyStore::setCurrentActive($storeKey, $payloadHash);
                }

                $result = $this->dispatchCall($callId, $action, $args);

                if ($idempotencyKey !== '') {
                    IdempotencyStore::clearCurrentActive();

                    if (!($result['ok'] ?? false)) {
                        if ($isMutation) {
                            IdempotencyStore::markFailed($storeKey, $payloadHash);
                        } else {
                            IdempotencyStore::release($storeKey);
                        }
                    } elseif ($isMutation) {
                        $completed = IdempotencyStore::complete($storeKey, $payloadHash, $result);
                        if (!$completed) {
                            $result = $this->errorResult(
                                $callId,
                                'kylat:action_error',
                                'Lease idempotensi telah kadaluarsa sebelum aksi selesai dieksekusi. Gunakan IdempotencyStore::heartbeat() untuk aksi berdurasi panjang.'
                            );
                        }
                    } else {
                        // Hasil baca tidak di-cache 24 jam; cukup lepaskan lease.
                        IdempotencyStore::release($storeKey);
                    }
                }

                $results[] = $result;
            } catch (Throwable $exception) {
                if ($idempotencyKey !== '') {
                    IdempotencyStore::clearCurrentActive();
                    if ($isMutation) {
                        IdempotencyStore::markFailed($storeKey, $payloadHash);
                    } else {
                        IdempotencyStore::release($storeKey);
                    }
                }
                $this->logInternalError($exception);
                $results[] = $this->errorResult(
                    $callId,
                    'kylat:server_error',
                    'Terjadi kesalahan internal pada server.'
                );
            }
        }

        return ['results' => $results];
    }

    /**
     * Entry point HTTP Laravel. Membaca body, menegakkan batas, dan memetakan
     * kegagalan request ke Problem Details RFC 9457.
     */
    public function handleRequest(Request $request): JsonResponse
    {
        $body = $request->getContent();
        if (strlen($body) > self::MAX_BODY_BYTES) {
            return $this->problem(413, 'Payload Too Large', 'Ukuran body melebihi batas 256 KB.');
        }

        if (!$request->isJson()) {
            return $this->problem(415, 'Unsupported Media Type', 'Content-Type wajib application/json.');
        }

        try {
            /** @var mixed $payload */
            $payload = json_decode($body, true, self::MAX_JSON_DEPTH, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return $this->problem(400, 'Bad Request', 'Payload JSON tidak valid atau melebihi kedalaman 16.');
        }

        if (!is_array($payload)) {
            return $this->problem(400, 'Bad Request', "Payload wajib berupa object JSON.");
        }

        $headers = [];
        foreach ($request->headers->all() as $name => $values) {
            $headers[$name] = is_array($values) ? (string) ($values[0] ?? '') : (string) $values;
        }

        try {
            $result = $this->handle($payload, $headers, strlen($body));
        } catch (\InvalidArgumentException $exception) {
            return $this->problem(400, 'Bad Request', $exception->getMessage());
        }

        return response()->json($result)
            ->header('Cache-Control', 'private, no-store')
            ->header('X-Content-Type-Options', 'nosniff');
    }

    private function problem(int $status, string $title, string $detail): JsonResponse
    {
        return response()->json([
            'type' => 'https://kylat.dev/errors/http_' . $status,
            'title' => $title,
            'status' => $status,
            'detail' => $detail,
        ], $status, [
            'Content-Type' => 'application/problem+json',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    /**
     * Validasi bentuk call sebelum menyentuh registry.
     *
     * @param mixed $call
     */
    private function validateCallShape(mixed $call): ?string
    {
        if (!is_array($call)) {
            return 'Setiap call wajib berupa object.';
        }
        if (!isset($call['id']) || !is_string($call['id'])) {
            return "Setiap call wajib memiliki 'id' bertipe string.";
        }
        if (!isset($call['action']) || !is_string($call['action'])) {
            return "Setiap call wajib memiliki 'action' bertipe string.";
        }
        if (!array_key_exists('args', $call) || !is_array($call['args'])) {
            return "Setiap call wajib memiliki 'args' berupa object.";
        }
        if (isset($call['idempotencyKey']) && !is_string($call['idempotencyKey'])) {
            return "'idempotencyKey' wajib berupa string.";
        }
        foreach (array_keys($call) as $key) {
            if (!in_array($key, ['id', 'action', 'args', 'idempotencyKey'], true)) {
                return "Properti call '$key' tidak dikenal.";
            }
        }
        return null;
    }

    private function isValidCallId(string $id): bool
    {
        return (bool) preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $id);
    }

    /**
     * @param mixed $value
     */
    private function validateValue(mixed $value, int $depth): ?string
    {
        if ($depth > self::MAX_JSON_DEPTH) {
            return sprintf('Kedalaman argumen melebihi batas %d tingkat.', self::MAX_JSON_DEPTH);
        }

        if (is_string($value)) {
            $length = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
            if ($length > self::MAX_STRING_LENGTH) {
                return sprintf('Panjang string argumen melebihi batas %d karakter.', self::MAX_STRING_LENGTH);
            }
            return null;
        }

        if (is_array($value)) {
            if (count($value) > self::MAX_ARRAY_ITEMS) {
                return sprintf('Jumlah elemen array melebihi batas %d.', self::MAX_ARRAY_ITEMS);
            }
            foreach ($value as $key => $child) {
                if (in_array((string) $key, ['__proto__', 'constructor', 'prototype'], true)) {
                    return 'Argumen memuat key yang dilarang (prototype pollution).';
                }
                $error = $this->validateValue($child, $depth + 1);
                if ($error !== null) {
                    return $error;
                }
            }
            return null;
        }

        if (is_object($value) || is_resource($value)) {
            return 'Argumen hanya boleh berisi tipe JSON (null, bool, number, string, array, object).';
        }

        return null;
    }

    /**
     * @param array<string, mixed> $args
     * @return array<string, mixed>
     */
    private function dispatchCall(string $id, string $action, array $args): array
    {
        try {
            if (!preg_match('/^[A-Za-z_][A-Za-z0-9_\\\\]*(?:::|\\.)[A-Za-z_][A-Za-z0-9_]*$/', $action)) {
                return $this->errorResult($id, 'kylat:action_error', 'Format aksi tidak valid.');
            }

            [$contract, $method] = explode('::', $action, 2);

            if (str_starts_with($method, '__')) {
                return $this->errorResult($id, 'kylat:forbidden', 'Pemanggilan magic method dilarang.');
            }

            $instance = ActionRegistry::resolve($contract);
            if ($instance === null) {
                return $this->errorResult(
                    $id,
                    'kylat:not_found',
                    sprintf("Aksi server untuk kontrak '%s' tidak ditemukan atau belum didaftarkan.", $contract)
                );
            }

            if (!method_exists($instance, $method)) {
                return $this->errorResult(
                    $id,
                    'kylat:not_found',
                    sprintf("Method '%s' tidak ditemukan pada kontrak '%s'.", $method, $contract)
                );
            }

            $actionRef = $this->actionReflection($contract, $instance, $method);
            if ($actionRef === null || !$this->hasServerAttribute($actionRef)) {
                return $this->errorResult(
                    $id,
                    'kylat:forbidden',
                    'Method tidak dideklarasikan sebagai aksi server (#[Server]).'
                );
            }

            $authorization = $this->authorizeAction($instance, $args);
            if ($authorization !== null) {
                return $this->errorResult($id, 'kylat:unauthorized', $authorization);
            }

            $refMethod = new ReflectionMethod($instance, $method);
            if (!$refMethod->isPublic()) {
                return $this->errorResult(
                    $id,
                    'kylat:forbidden',
                    sprintf("Method '%s' harus bersifat public.", $method)
                );
            }

            $invokedArgs = [];
            foreach ($refMethod->getParameters() as $parameter) {
                $parameterName = $parameter->getName();
                if (array_key_exists($parameterName, $args)) {
                    $value = $args[$parameterName];
                    $typeError = $this->validateParameterType($parameter->getType(), $value, $parameterName);
                    if ($typeError !== null) {
                        return $this->errorResult($id, 'kylat:validation', $typeError);
                    }
                    $invokedArgs[] = $value;
                } elseif ($parameter->isDefaultValueAvailable()) {
                    $invokedArgs[] = $parameter->getDefaultValue();
                } else {
                    return $this->errorResult(
                        $id,
                        'kylat:validation',
                        sprintf(
                            "Parameter wajib '$%s' tidak disertakan dalam pemanggilan '%s'.",
                            $parameterName,
                            $action
                        )
                    );
                }
            }

            $output = $refMethod->invokeArgs($instance, $invokedArgs);

            return [
                'id' => $id,
                'ok' => true,
                'data' => $output,
            ];
        } catch (Throwable $exception) {
            $this->logInternalError($exception);
            return $this->errorResult($id, 'kylat:server_error', 'Terjadi kesalahan internal pada server.');
        }
    }

    private function actionReflection(string $contract, object $instance, string $method): ?ReflectionMethod
    {
        try {
            if (interface_exists($contract)) {
                if (!method_exists($contract, $method)) {
                    return null;
                }
                return new ReflectionMethod($contract, $method);
            }

            // Dukung nama kontrak pendek (mis. 'CounterActions') yang dipakai
            // oleh contoh/komponen lama, selama implementasi memang
            // mengimplementasikan interface dengan nama pendek tersebut.
            foreach (class_implements($instance) ?: [] as $interface) {
                if (
                    ($interface === $contract || str_ends_with($interface, '\\' . ltrim($contract, '\\')))
                    && method_exists($interface, $method)
                ) {
                    return new ReflectionMethod($interface, $method);
                }
            }

            return new ReflectionMethod($instance, $method);
        } catch (\ReflectionException) {
            return null;
        }
    }

    private function hasServerAttribute(ReflectionMethod $method): bool
    {
        foreach ($method->getAttributes() as $attribute) {
            $name = $attribute->getName();
            if ($name === 'Kylat\\Attributes\\Server' || str_ends_with($name, '\\Server')) {
                return true;
            }
        }
        return false;
    }

    /**
     * @param array<string, mixed> $args
     * @return string|null Pesan penolakan, atau null bila diizinkan.
     */
    private function authorizeAction(object $instance, array $args): ?string
    {
        if (!method_exists($instance, 'authorize')) {
            return 'Aksi tidak memiliki policy otorisasi (default deny).';
        }

        $method = new ReflectionMethod($instance, 'authorize');
        try {
            if ($method->getNumberOfRequiredParameters() === 0) {
                return $method->invoke($instance) === true ? null : 'Otorisasi ditolak.';
            }

            $values = [];
            foreach ($method->getParameters() as $parameter) {
                $name = $parameter->getName();
                $parameterType = $parameter->getType();
                $isUserType = $parameterType instanceof ReflectionNamedType
                    && !$parameterType->isBuiltin();

                if (str_contains(strtolower($name), 'user') || $isUserType) {
                    // Identitas pemanggil tidak boleh berasal dari argumen client.
                    $values[] = $this->currentUser();
                } elseif (array_key_exists($name, $args)) {
                    $values[] = $args[$name];
                } elseif ($parameter->isDefaultValueAvailable()) {
                    $values[] = $parameter->getDefaultValue();
                } elseif (in_array(strtolower($name), ['id', 'identifier', 'uuid'], true)) {
                    $values[] = $args[$name] ?? $args['id'] ?? $args['uuid'] ?? null;
                } else {
                    return 'Policy otorisasi membutuhkan konteks yang tidak tersedia.';
                }
            }

            return $method->invokeArgs($instance, $values) === true ? null : 'Otorisasi ditolak.';
        } catch (Throwable) {
            return 'Otorisasi gagal dievaluasi.';
        }
    }

    private function scopeIdempotencyKey(string $key): string
    {
        $user = $this->currentUser();
        if (is_object($user) && method_exists($user, 'getAuthIdentifier')) {
            return 'user:' . (string) $user->getAuthIdentifier() . ':' . $key;
        }
        if (function_exists('session')) {
            try {
                return 'session:' . (string) session()->getId() . ':' . $key;
            } catch (Throwable) {
                // fall through
            }
        }
        // Tanpa sesi/auth (mis. CLI/test), pertahankan key apa adanya.
        return $key;
    }

    private function currentUser(): mixed
    {
        if (function_exists('auth')) {
            try {
                return auth()->user();
            } catch (Throwable) {
                return null;
            }
        }
        return null;
    }

    private function validateParameterType(?ReflectionType $type, mixed $value, string $parameterName): ?string
    {
        if ($type === null) {
            return null;
        }

        if ($type instanceof ReflectionUnionType) {
            foreach ($type->getTypes() as $member) {
                if ($this->validateParameterType($member, $value, $parameterName) === null) {
                    return null;
                }
            }
            return sprintf("Parameter '$%s' tidak sesuai dengan union type.", $parameterName);
        }

        if (!$type instanceof ReflectionNamedType) {
            return null;
        }

        if ($value === null) {
            return $type->allowsNull() ? null : sprintf("Parameter '$%s' tidak boleh null.", $parameterName);
        }

        $expected = $type->getName();
        $valid = match ($expected) {
            'int' => is_int($value),
            'float' => is_float($value) || is_int($value),
            'string' => is_string($value),
            'bool' => is_bool($value),
            'array', 'iterable' => is_array($value),
            'mixed' => true,
            default => !$type->isBuiltin() && $value instanceof $expected,
        };

        if (!$valid) {
            return sprintf("Parameter '$%s' harus bertipe %s tanpa koersi.", $parameterName, $expected);
        }

        return null;
    }

    /**
     * @return array{id: string, ok: false, error: array{type: string, message: string}}
     */
    private function errorResult(string $id, string $type, string $message): array
    {
        return [
            'id' => $id,
            'ok' => false,
            'error' => [
                'type' => $type,
                'message' => $message,
            ],
        ];
    }

    private function logInternalError(Throwable $exception): void
    {
        if (function_exists('logger')) {
            try {
                logger()->error('[Kylat] Aksi server gagal: ' . $exception->getMessage(), [
                    'exception' => $exception,
                ]);
                return;
            } catch (Throwable) {
                // fall through
            }
        }
        error_log('[Kylat] Aksi server gagal: ' . $exception->getMessage());
    }

    private function isMutationAction(string $contract, string $method): bool
    {
        $instance = ActionRegistry::resolve($contract);
        if ($instance === null || !method_exists($instance, $method)) {
            return true;
        }

        $refMethod = $this->actionReflection($contract, $instance, $method);
        if ($refMethod === null) {
            return true;
        }

        foreach ($refMethod->getAttributes() as $attribute) {
            $name = $attribute->getName();
            if ($name === 'Kylat\\Attributes\\Server' || str_ends_with($name, '\\Server')) {
                $arguments = $attribute->getArguments();
                if (isset($arguments['read']) && $arguments['read'] === true) {
                    return false;
                }
                if (isset($arguments[0]) && $arguments[0] === true) {
                    return false;
                }
            }
        }

        return true;
    }
}
