/**
 * @kylat/compiler
 * Pipeline compiler komponen PHP subset v0 ke JavaScript signals.
 */

export interface Diagnostic {
  code: string;
  file: string;
  line: number;
  column: number;
  message: string;
  hint?: string;
  docUrl: string;
}

export interface CompileResult {
  code: string;
  map?: string;
  diagnostics: Diagnostic[];
  success: boolean;
}

export function compile(_source: string, _filename: string): CompileResult {
  // Stub awal compiler pipeline
  return {
    code: '',
    diagnostics: [],
    success: true,
  };
}
