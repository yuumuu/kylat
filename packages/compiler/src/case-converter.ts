/**
 * @kylat/compiler - case-converter.ts
 * Konversi nama prop antara format kebab-case HTML dan camelCase PHP sesuai spec/template.md §7.
 */

/**
 * Mengubah string kebab-case menjadi camelCase deterministik.
 * Contoh:
 *   - "initial-count" -> "initialCount"
 *   - "max-items" -> "maxItems"
 *   - "item-2-count" -> "item2Count"
 *   - "max-allowed-items" -> "maxAllowedItems"
 */
export function kebabToCamel(str: string): string {
  return str.replace(/-([a-zA-Z0-9])/g, (_, char) => char.toUpperCase());
}

/**
 * Mengubah string camelCase menjadi kebab-case HTML.
 * Contoh:
 *   - "initialCount" -> "initial-count"
 *   - "maxItems" -> "max-items"
 *   - "item2Count" -> "item-2-count"
 */
export function camelToKebab(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}
