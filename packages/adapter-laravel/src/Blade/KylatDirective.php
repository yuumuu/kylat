<?php

declare(strict_types=1);

namespace Kylat\Laravel\Blade;

use RuntimeException;

/**
 * Helper rendering direktif Blade @kylat dan @kylatScripts sesuai spec/template.md.
 */
final class KylatDirective
{
    public const MAX_PROPS_BYTES = 16 * 1024; // 16 KB (KIL-212)

    /**
     * Merender markup kontainer island HTML untuk komponen Kylat.
     *
     * @param string $name Nama komponen island (misal: 'CartCounter')
     * @param array<string, mixed> $props Properti awal yang dioper ke komponen
     * @return string Markup HTML kontainer
     */
    public static function renderIsland(string $name, array $props = []): string
    {
        $json = json_encode($props, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            throw new RuntimeException(sprintf("Gagal meng-encode props untuk komponen '%s'.", $name));
        }

        $byteSize = strlen($json);
        if ($byteSize > self::MAX_PROPS_BYTES) {
            throw new RuntimeException(
                sprintf(
                    "Ukuran data-props untuk komponen '%s' (%d bytes) melebihi batas maksimum 16 KB (KIL-212).",
                    $name,
                    $byteSize
                )
            );
        }

        // Escape kutip untuk HTML atribut
        $escapedProps = htmlspecialchars($json, ENT_QUOTES, 'UTF-8');

        return sprintf(
            '<div data-island="%s" data-props="%s"><!-- kylat:%s --></div>',
            htmlspecialchars($name, ENT_QUOTES, 'UTF-8'),
            $escapedProps,
            htmlspecialchars($name, ENT_QUOTES, 'UTF-8')
        );
    }

    /**
     * Merender tag script loader runtime Kylat.
     */
    public static function renderScripts(): string
    {
        return '<script type="module" src="/vendor/kylat/runtime.js"></script>';
    }
}
