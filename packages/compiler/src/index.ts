/**
 * @kylat/compiler
 * Pipeline compiler komponen PHP subset v0 ke JavaScript signals.
 */

import { initPhpParser, type ParserOptions } from './parser.js';
import { analyzePhpComponent } from './analyzer.js';
import { generateJavaScript } from './codegen.js';
import type { Diagnostic } from './diagnostics.js';
import type { ComponentIR } from './ir.js';

export * from './diagnostics.js';
export * from './ir.js';
export * from './parser.js';
export * from './analyzer.js';
export * from './codegen.js';
export * from './template-parser.js';
export * from './case-converter.js';

export interface CompileOptions extends ParserOptions {
  sourceMap?: boolean;
  template?: string;
}

export interface CompileResult {
  code: string;
  ir: ComponentIR | null;
  diagnostics: Diagnostic[];
  success: boolean;
}

/**
 * Mengompilasi kode sumber komponen PHP subset v0 menjadi modul JavaScript signals.
 */
export async function compile(
  source: string,
  filename: string,
  options?: CompileOptions
): Promise<CompileResult> {
  const parser = await initPhpParser(options);
  const tree = parser.parse(source);

  const { ir, diagnostics } = analyzePhpComponent(tree, filename);
  const hasErrors = diagnostics.length > 0;

  if (!ir || hasErrors) {
    return {
      code: '',
      ir,
      diagnostics,
      success: false,
    };
  }

  const code = generateJavaScript(ir, options?.template);

  return {
    code,
    ir,
    diagnostics,
    success: true,
  };
}
