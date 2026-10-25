/**
 * @kylat/compiler - parser.ts
 * Inisialisasi dan wrapper web-tree-sitter (WASM) untuk parsing PHP subset v0.
 */

import Parser from 'web-tree-sitter';
import path from 'path';
import { createRequire } from 'module';

let isParserInitialized = false;
let phpLanguage: Parser.Language | null = null;

export interface ParserOptions {
  customWasmPath?: string;
}

/**
 * Menginisialisasi web-tree-sitter dan memuat grammar PHP WASM.
 */
export async function initPhpParser(options?: ParserOptions): Promise<Parser> {
  if (!isParserInitialized) {
    await Parser.init();
    isParserInitialized = true;
  }

  if (!phpLanguage) {
    let wasmFile = options?.customWasmPath;
    if (!wasmFile) {
      const require = createRequire(import.meta.url);
      const wasmPkg = require.resolve('tree-sitter-wasms/package.json');
      wasmFile = path.join(path.dirname(wasmPkg), 'out', 'tree-sitter-php.wasm');
    }
    if (!wasmFile) {
      throw new Error('Gagal menemukan path tree-sitter-php.wasm');
    }
    phpLanguage = await Parser.Language.load(wasmFile);
  }

  const parser = new Parser();
  parser.setLanguage(phpLanguage);
  return parser;
}
