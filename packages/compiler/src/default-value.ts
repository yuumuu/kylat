/**
 * Mengubah nilai awal PHP subset v0 menjadi literal JavaScript.
 *
 * Mendukung scalar literal, array list/map (`[]` dan `array()`).
 * Nilai yang tidak dapat diterjemahkan ditolak agar codegen tidak menghasilkan
 * JavaScript yang tidak valid.
 */

import { compileExpression, ExpressionError } from './expression.js';

export function compileDefaultValue(source: string): string {
  const trimmed = source.trim();
  const arraySyntax =
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (/^array\s*\(/i.test(trimmed) && trimmed.endsWith(')'));

  if (arraySyntax) {
    const open = trimmed.indexOf(trimmed.startsWith('[') ? '[' : '(');
    const inner = trimmed.slice(open + 1, -1).trim();
    if (!inner) return '[]';

    const parts = splitArguments(inner);
    let hasKeys = false;
    const entries: string[] = [];
    const values: string[] = [];

    for (const part of parts) {
      const arrow = findTopLevelArrow(part);
      if (arrow === -1) {
        values.push(compileDefaultValue(part));
        continue;
      }
      hasKeys = true;
      const rawKey = part.slice(0, arrow).trim();
      const rawValue = part.slice(arrow + 2).trim();
      const key = /^['"]/.test(rawKey)
        ? (() => {
            try {
              return JSON.parse(compileDefaultValue(rawKey)) as string;
            } catch {
              return rawKey.replace(/^['"]|['"]$/g, '');
            }
          })()
        : Number(rawKey);
      entries.push(`${JSON.stringify(String(key))}: ${compileDefaultValue(rawValue)}`);
    }

    if (hasKeys) {
      const numericEntries = values.map((value, index) => `${JSON.stringify(String(index))}: ${value}`);
      return `{ ${[...numericEntries, ...entries].join(', ')} }`;
    }
    return `[${values.join(', ')}]`;
  }

  try {
    return compileExpression(trimmed, { state: new Set(), props: new Set(), loops: new Map() });
  } catch (error) {
    if (error instanceof ExpressionError) {
      throw new ExpressionError(
        error.code,
        `Nilai awal '${trimmed}' tidak didukung: ${error.message}`
      );
    }
    throw error;
  }
}

function splitArguments(source: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (quote) {
      current += ch;
      if (ch === '\\' && i + 1 < source.length) current += source[++i]!;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function findTopLevelArrow(source: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < source.length - 1; i++) {
    const ch = source[i]!;
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth--;
    else if (ch === '=' && source[i + 1] === '>' && depth === 0) return i;
  }
  return -1;
}
