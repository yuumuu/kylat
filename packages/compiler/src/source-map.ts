/**
 * @kylat/compiler - source-map.ts
 * Generator source map v3 minimal untuk output JavaScript.
 *
 * Pemetaan bersifat line-level: setiap baris output dipetakan ke baris sumber
 * PHP/templat asli. Kolom sumber dipertahankan bila tersedia.
 */

export interface SourceMapping {
  generatedLine: number;
  sourceLine: number;
  sourceColumn: number;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeVlq(value: number): string {
  let vlq = value < 0 ? ((-value) << 1) | 1 : value << 1;
  let encoded = '';
  do {
    let digit = vlq & 31;
    vlq >>>= 5;
    if (vlq > 0) digit |= 32;
    encoded += BASE64[digit]!;
  } while (vlq > 0);
  return encoded;
}

export class SourceMapBuilder {
  private readonly mappings = new Map<number, SourceMapping>();

  /**
   * Menambahkan pemetaan. Pemetaan pertama untuk sebuah baris menang agar
   * node templat terdalam tidak ditimpa oleh wrapper elemen induk.
   */
  public add(generatedLine: number, sourceLine: number, sourceColumn = 0): void {
    if (generatedLine < 1 || sourceLine < 1) return;
    if (this.mappings.has(generatedLine)) return;
    this.mappings.set(generatedLine, {
      generatedLine,
      sourceLine,
      sourceColumn,
    });
  }

  public shift(offset: number): void {
    if (offset <= 0) return;
    const shifted = new Map<number, SourceMapping>();
    for (const mapping of this.mappings.values()) {
      shifted.set(mapping.generatedLine + offset, {
        ...mapping,
        generatedLine: mapping.generatedLine + offset,
      });
    }
    this.mappings.clear();
    for (const [line, mapping] of shifted) this.mappings.set(line, mapping);
  }

  public toJSON(file: string, source: string, sourceContent: string): string {
    const mappings = [...this.mappings.values()].sort(
      (left, right) => left.generatedLine - right.generatedLine
    );
    let previousSourceLine = 0;
    let previousSourceColumn = 0;
    let output = '';
    let currentLine = 1;

    for (const mapping of mappings) {
      while (currentLine < mapping.generatedLine) {
        output += ';';
        currentLine++;
      }
      // generatedColumn 0, sourceIndex delta 0, originalLine delta, originalColumn delta
      const segment =
        encodeVlq(0) +
        encodeVlq(0) +
        encodeVlq(mapping.sourceLine - 1 - previousSourceLine) +
        encodeVlq(mapping.sourceColumn - previousSourceColumn);
      output += segment;
      previousSourceLine = mapping.sourceLine - 1;
      previousSourceColumn = mapping.sourceColumn;
    }

    return JSON.stringify({
      version: 3,
      file,
      sources: [source],
      sourcesContent: [sourceContent],
      names: [],
      mappings: output,
    });
  }
}
