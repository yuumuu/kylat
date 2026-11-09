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
    validateTemplate(options.template, ir, filename, diagnostics);
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

function validateTemplate(
  templateSource: string,
  ir: ComponentIR | null,
  filename: string,
  diagnostics: Diagnostic[]
): void {
  // 1. KIL-152: HTML mentah {!!
  if (templateSource.includes('{!!')) {
    const idx = templateSource.indexOf('{!!');
    diagnostics.push(createDiagnostic('KIL-152', filename, 1, idx + 1, ERROR_MESSAGES.KIL_152));
  }

  // 2. KIL-155: @foreach tanpa atribut key
  if (templateSource.includes('@foreach') && !/key\s*=\s*['"]?[^'">\s]+['"]?/.test(templateSource)) {
    diagnostics.push(createDiagnostic('KIL-155', filename, 1, 1, ERROR_MESSAGES.KIL_155));
  }

  // 3. Parse element tree
  let parsedElements: import('./template-parser.js').ParsedElement[] = [];
  try {
    parsedElements = parseTemplate(templateSource);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const codeMatch = msg.match(/^(KIL-\d+):\s*(.*)$/);
    const errCode = codeMatch && codeMatch[1] ? codeMatch[1] : 'KIL-151';
    const errMsg = codeMatch && codeMatch[2] ? codeMatch[2] : msg;
    diagnostics.push(createDiagnostic(errCode, filename, 1, 1, errMsg));
    return;
  }

  const ALLOWED_V0_EVENTS = new Set(['click', 'input', 'change', 'submit', 'keydown']);
  const stateNames = new Set(ir ? ir.state.map((s) => s.name) : []);
  const propNames = new Set(ir ? ir.props.map((p) => p.name) : []);
  const validMethods = new Set(ir ? ir.methods.filter((m) => m.isAction).map((m) => m.name) : []);

  function walkElement(el: import('./template-parser.js').ParsedElement): void {
    // KIL-153: event binding on:<event>
    for (const ev of el.events) {
      if (!ALLOWED_V0_EVENTS.has(ev.event)) {
        diagnostics.push(
          createDiagnostic(
            'KIL-153',
            filename,
            1,
            1,
            ERROR_MESSAGES.KIL_153.replace('{event}', ev.event)
          )
        );
      } else {
        const handlerName = ev.handlerCall.replace(/\(.*$/, '').trim();
        if (ir && handlerName && !validMethods.has(handlerName)) {
          diagnostics.push(
            createDiagnostic(
              'KIL-153',
              filename,
              1,
              1,
              ERROR_MESSAGES.KIL_153.replace('{event}', ev.event)
            )
          );
        }
      }
    }

    for (const [attrName, attrVal] of Object.entries(el.attributes)) {
      // KIL-159: {{ }} di dalam atribut direktif atau atribut dinamis
      if ((attrName.startsWith('bind:') || attrName.startsWith('on:') || attrName.startsWith(':')) && attrVal.includes('{{')) {
        diagnostics.push(createDiagnostic('KIL-159', filename, 1, 1, ERROR_MESSAGES.KIL_159));
      }

      // KIL-160: {{ }} pada atribut style atau event bawaan HTML on*
      if ((attrName === 'style' || /^on[a-z]+$/i.test(attrName)) && attrVal.includes('{{')) {
        diagnostics.push(createDiagnostic('KIL-160', filename, 1, 1, ERROR_MESSAGES.KIL_160));
      }

      // KIL-158: Skema URL tidak diizinkan pada href/src/:href/:src
      if (['href', 'src', ':href', ':src'].includes(attrName)) {
        if (/^\s*(?:javascript:|data:|vbscript:)/i.test(attrVal) || /['"]javascript:/i.test(attrVal)) {
          diagnostics.push(createDiagnostic('KIL-158', filename, 1, 1, ERROR_MESSAGES.KIL_158));
        }
      }

      // KIL-154: bind:value mengarah ke prop atau bukan state
      if (attrName.startsWith('bind:')) {
        const targetClean = attrVal.replace(/^\$this->|^\$/, '').trim();
        if (propNames.has(targetClean) || (ir && !stateNames.has(targetClean))) {
          diagnostics.push(createDiagnostic('KIL-154', filename, 1, 1, ERROR_MESSAGES.KIL_154));
        }
      }

      // KIL-156: error mengarah ke path yang bukan state
      if (attrName === 'error') {
        const rootPath = attrVal.trim().split('.')[0] || '';
        if (ir && !stateNames.has(rootPath)) {
          diagnostics.push(
            createDiagnostic(
              'KIL-156',
              filename,
              1,
              1,
              ERROR_MESSAGES.KIL_156.replace('{path}', attrVal.trim())
            )
          );
        }
      }
    }

    for (const child of el.children) {
      walkElement(child);
    }
  }

  for (const el of parsedElements) {
    walkElement(el);
  }
}
