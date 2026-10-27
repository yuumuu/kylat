/**
 * @kylat/compiler
 * Pipeline compiler komponen PHP subset v0 ke JavaScript signals.
 */

import { initPhpParser, type ParserOptions } from './parser.js';
import { analyzePhpComponent } from './analyzer.js';
import { generateJavaScript } from './codegen.js';
import { createDiagnostic, ERROR_MESSAGES, type Diagnostic } from './diagnostics.js';
import { parseTemplate } from './template-parser.js';
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

  if (options?.template) {
    if (options.template.includes('{!!')) {
      const idx = options.template.indexOf('{!!');
      diagnostics.push(
        createDiagnostic(
          'KIL-152',
          filename,
          1,
          idx + 1,
          ERROR_MESSAGES.KIL_152
        )
      );
    }
    try {
      parseTemplate(options.template);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const codeMatch = msg.match(/^(KIL-\d+):\s*(.*)$/);
      const errCode = codeMatch && codeMatch[1] ? codeMatch[1] : 'KIL-151';
      const errMsg = codeMatch && codeMatch[2] ? codeMatch[2] : msg;
      diagnostics.push(createDiagnostic(errCode, filename, 1, 1, errMsg));
    }
  }

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
