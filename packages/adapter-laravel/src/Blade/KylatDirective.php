<?php

declare(strict_types=1);

namespace Kylat\Laravel\Blade;

use JsonException;
use RuntimeException;

/**
 * Helper rendering direktif Blade @kylat dan @kylatScripts.
 *
 * Serialisasi data-props mengikuti KEP-26: hanya tipe JSON aman, kedalaman
 * maksimum 16, panjang string maksimum 10.000 karakter, dan escape sekali
 * untuk konteks atribut HTML.
 */
final class KylatDirective
{
    public const MAX_PROPS_BYTES = 16 * 1024;
    public const MAX_DEPTH = 16;
    public const MAX_STRING_LENGTH = 10_000;
    public const MAX_ARRAY_ITEMS = 1_000;

    /**
     * @param array<string, mixed> $props
     */
    public static function renderIsland(string $name, array $props = []): string
    {
        self::assertSerializable($props, 0);

        try {
            $json = json_encode(
                $props,
                JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
            );
        } catch (JsonException $exception) {
            throw new RuntimeException(
                sprintf("Gagal meng-encode props untuk komponen '%s': %s", $name, $exception->getMessage()),
                0,
                $exception
            );
        }

        $byteSize = strlen($json);
        if ($byteSize > self::MAX_PROPS_BYTES) {
            throw new RuntimeException(
                sprintf(
                    "Ukuran data-props untuk komponen '%s' (%d bytes) melebihi batas maksimum 16 KB (KIL-213).",
                    $name,
                    $byteSize
                )
            );
        }

        $escapedName = htmlspecialchars($name, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $escapedProps = htmlspecialchars($json, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        return sprintf(
            '<div data-island="%s" data-props="%s"><!-- kylat:%s --></div>',
            $escapedName,
            $escapedProps,
            $escapedName
        );
    }

    public static function renderScripts(): string
    {
        return '<script type="module" src="/vendor/kylat/runtime.js"></script>';
    }

    private static function assertSerializable(mixed $value, int $depth): void
    {
        if ($depth > self::MAX_DEPTH) {
            throw new RuntimeException('Kedalaman data-props melebihi batas 16 tingkat.');
        }

        if ($value === null || is_bool($value) || is_int($value) || is_float($value)) {
            return;
        }

        if (is_string($value)) {
            $length = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
            if ($length > self::MAX_STRING_LENGTH) {
                throw new RuntimeException('Panjang string pada data-props melebihi 10.000 karakter.');
            }
            return;
        }

        if (is_array($value)) {
            if (count($value) > self::MAX_ARRAY_ITEMS) {
                throw new RuntimeException('Jumlah elemen data-props melebihi 1.000.');
            }
            foreach ($value as $key => $child) {
                if (is_string($key) && in_array($key, ['__proto__', 'constructor', 'prototype'], true)) {
                    throw new RuntimeException('data-props memuat key yang dilarang (prototype pollution).');
                }
                self::assertSerializable($child, $depth + 1);
            }
            return;
        }

        throw new RuntimeException(
            'data-props hanya boleh berisi null, bool, int, float, string, list, atau map. Objek/ORM/closure ditolak.'
        );
    }
}
