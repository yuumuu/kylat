/**
 * @kylat/compiler
 * Pipeline compiler komponen PHP subset v0 ke JavaScript signals.
 */

import { initPhpParser, type ParserOptions } from './parser.js';
import { analyzePhpComponent } from './analyzer.js';
import { generateJavaScript, CodegenError } from './codegen.js';
import { createDiagnostic, ERROR_MESSAGES, type Diagnostic } from './diagnostics.js';
import {
  parseTemplateNodes,
  TemplateError,
  type ParsedNode,
} from './template-parser.js';
import { compileExpression, ExpressionError, type ExpressionContext } from './expression.js';
import { SourceMapBuilder } from './source-map.js';
import type { ComponentIR } from './ir.js';

export * from './diagnostics.js';
export * from './ir.js';
export * from './parser.js';
export * from './analyzer.js';
export * from './codegen.js';
export * from './template-parser.js';
export * from './expression.js';
export * from './types.js';
export * from './client-compiler.js';
export * from './source-map.js';
export * from './case-converter.js';

export interface CompileOptions extends ParserOptions {
  template?: string;
}

export interface CompileResult {
  code: string;
  map?: string;
  ir: ComponentIR | null;
  diagnostics: Diagnostic[];
  success: boolean;
}

/**
 * Mengompilasi komponen menjadi modul JavaScript signals.
 *
 * Mendukung dua bentuk:
 * - single-file `*.kylat.php` (PHP + template setelah `?>`), sesuai KEP-34;
 * - legacy dua berkas melalui `options.template` (dipertahankan untuk migrasi).
 */
export async function compile(
  source: string,
  filename: string,
  options?: CompileOptions
): Promise<CompileResult> {
  const diagnostics: Diagnostic[] = [];

  let phpSource = source;
  let templateSource = options?.template;
  let singleFile = filename.endsWith('.kylat.php');
  let templateLineOffset = 0;

  const closeTag = findPhpCloseTag(source);
  if (closeTag !== -1) {
    singleFile = true;
    if (templateSource === undefined) {
      templateSource = source.slice(closeTag + 2);
      templateLineOffset = (source.slice(0, closeTag + 2).match(/\n/g) ?? []).length;
    }
    phpSource = source.slice(0, closeTag + 2);
  }

  if (singleFile && closeTag === -1 && templateSource === undefined) {
    diagnostics.push(
      createDiagnostic(
        'KIL-216',
        filename,
        1,
        1,
        'Komponen single-file wajib memiliki tag penutup ?> sebelum bagian templat.',
        'Tambahkan ?> setelah definisi kelas, lalu tulis templat HTML/Kylat.'
      )
    );
  }

  if (templateSource !== undefined && /<\?(?:php|=)/i.test(templateSource)) {
    diagnostics.push(
      createDiagnostic(
        'KIL-216',
        filename,
        1,
        1,
        'Tidak boleh ada tag PHP pembuka di bagian templat setelah ?>.',
        'Pindahkan kode PHP ke bagian kelas sebelum ?>.'
      )
    );
  }

  const parser = await initPhpParser(options);
  const tree = parser.parse(phpSource);
  const analysis = analyzePhpComponent(tree, filename);
  diagnostics.push(...analysis.diagnostics);

  const { ir } = analysis;

  if (ir) {
    validateSingleFileStructure(ir, filename, tree.rootNode, singleFile, diagnostics);
  }

  if (templateSource !== undefined) {
    const templateDiagnosticsStart = diagnostics.length;
    validateTemplate(templateSource, ir, filename, diagnostics);
    if (templateLineOffset > 0) {
      for (let i = templateDiagnosticsStart; i < diagnostics.length; i++) {
        diagnostics[i]!.line += templateLineOffset;
      }
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

  try {
    const sourceMap = new SourceMapBuilder();
    const code = generateJavaScript(ir, templateSource, sourceMap, templateLineOffset);
    return {
      code,
      map: sourceMap.toJSON(filename, filename, source),
      ir,
      diagnostics,
      success: true,
    };
  } catch (err) {
    if (err instanceof CodegenError) {
      diagnostics.push(createDiagnostic(err.code, filename, err.line, err.column, err.message));
    } else if (err instanceof TemplateError) {
      diagnostics.push(createDiagnostic(err.code, filename, err.line, err.column, err.message));
    } else {
      const message = err instanceof Error ? err.message : String(err);
      diagnostics.push(createDiagnostic('KIL-104', filename, 1, 1, message));
    }
    return { code: '', ir, diagnostics, success: false };
  }
}

function validateSingleFileStructure(
  ir: ComponentIR,
  filename: string,
  root: import('web-tree-sitter').SyntaxNode,
  singleFile: boolean,
  diagnostics: Diagnostic[]
): void {
  if (!singleFile) return;

  const classNodes = root.descendantsOfType('class_declaration');
  if (classNodes.length > 1) {
    diagnostics.push(
      createDiagnostic(
        'KIL-201',
        filename,
        classNodes[1]!.startPosition.row + 1,
        classNodes[1]!.startPosition.column + 1,
        'Satu berkas komponen hanya boleh mendefinisikan satu kelas.',
        'Pisahkan kelas lain ke berkas komponennya sendiri.'
      )
    );
  }

  const base = filename.replace(/^.*[\\/]/, '').replace(/\.kylat\.php$/i, '');
  if (base && base !== ir.name) {
    diagnostics.push(
      createDiagnostic(
        'KIL-215',
        filename,
        1,
        1,
        `Nama kelas '${ir.name}' wajib sama persis dengan nama berkas '${base}'.`,
        `Ganti nama kelas menjadi '${base}' atau ganti nama berkas menjadi '${ir.name}.kylat.php'.`
      )
    );
  }

  // KIL-214: hanya declare, namespace, use, komentar, dan satu kelas di top-level.
  for (const child of root.namedChildren) {
    if (
      child.type === 'php_tag' ||
      child.type === 'declare_statement' ||
      child.type === 'namespace_definition' ||
      child.type === 'namespace_use_declaration' ||
      child.type === 'class_declaration' ||
      child.type === 'comment' ||
      child.type === 'text_interpolation'
    ) {
      continue;
    }
    if (child.type === 'text') continue;
    diagnostics.push(
      createDiagnostic(
        'KIL-214',
        filename,
        child.startPosition.row + 1,
        child.startPosition.column + 1,
        `Pernyataan '${child.type}' di luar kelas tidak diizinkan pada komponen single-file.`,
        'Pindahkan logika ke dalam kelas komponen atau ke kelas aksi terpisah.'
      )
    );
  }
}

function validateTemplate(
  templateSource: string,
  ir: ComponentIR | null,
  filename: string,
  diagnostics: Diagnostic[]
): void {
  let nodes: ParsedNode[];
  try {
    nodes = parseTemplateNodes(templateSource);
  } catch (err) {
    if (err instanceof TemplateError) {
      diagnostics.push(createDiagnostic(err.code, filename, err.line, err.column, err.message));
    } else {
      const message = err instanceof Error ? err.message : String(err);
      diagnostics.push(createDiagnostic('KIL-151', filename, 1, 1, message));
    }
    return;
  }

  const stateNames = new Set(ir?.state.map((s) => s.name) ?? []);
  const propNames = new Set(ir?.props.map((p) => p.name) ?? []);
  const computedNames = new Set(ir?.computeds.map((c) => c.name) ?? []);
  const validMethods = new Set(ir?.methods.filter((m) => m.isAction).map((m) => m.name) ?? []);
  const childTags = new Set(ir?.childComponents.map((c) => c.tag) ?? []);
  const allowedEvents = new Set(['click', 'input', 'change', 'submit', 'keydown']);
  const urlAttributes = new Set(['href', 'src', 'formaction', 'xlink:href']);

  const ctx: ExpressionContext = {
    state: stateNames,
    props: propNames,
    computed: computedNames,
    loops: new Map(),
  };

  const addExpressionError = (
    expression: string,
    expressionContext: ExpressionContext,
    loc: { line: number; column: number }
  ): void => {
    try {
      compileExpression(expression, expressionContext);
    } catch (err) {
      if (err instanceof ExpressionError) {
        diagnostics.push(createDiagnostic(err.code, filename, loc.line, loc.column, err.message));
      } else {
        const message = err instanceof Error ? err.message : String(err);
        diagnostics.push(createDiagnostic('KIL-104', filename, loc.line, loc.column, message));
      }
    }
  };

  const loopContext = (base: ExpressionContext, item: string): ExpressionContext => ({
    state: base.state,
    props: base.props,
    computed: base.computed,
    loops: new Map(base.loops).set(item, 'item'),
  });

  const addUrlError = (value: string, loc: { line: number; column: number }): void => {
    if (/(?:^|[\s"'`])(?:javascript|data|vbscript):/i.test(value)) {
      diagnostics.push(
        createDiagnostic('KIL-158', filename, loc.line, loc.column, ERROR_MESSAGES.KIL_158)
      );
    }
  };

  const parseHandler = (raw: string): { method: string; args: string[] } => {
    const trimmed = raw.trim();
    const open = trimmed.indexOf('(');
    if (open === -1) return { method: trimmed, args: [] };
    const close = trimmed.lastIndexOf(')');
    if (close < open) return { method: trimmed, args: [] };
    const method = trimmed.slice(0, open).trim();
    const inner = trimmed.slice(open + 1, close).trim();
    if (!inner) return { method, args: [] };
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let quote: string | null = null;
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i]!;
      if (quote) {
        current += ch;
        if (ch === '\\' && i + 1 < inner.length) current += inner[++i]!;
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
      } else {
        current += ch;
      }
    }
    if (current.trim()) args.push(current.trim());
    return { method, args };
  };

  const walk = (node: ParsedNode, currentContext: ExpressionContext): void => {
    if (node.type === 'text') return;
    if (node.type === 'expression') {
      addExpressionError(node.expression, currentContext, node.loc);
      return;
    }
    if (node.type === 'if') {
      for (const branch of node.branches) {
        if (branch.condition !== undefined) {
          addExpressionError(branch.condition, currentContext, branch.loc);
        }
        for (const child of branch.children) walk(child, currentContext);
      }
      return;
    }
    if (node.type === 'foreach') {
      addExpressionError(node.collection, currentContext, node.loc);
      const childContext = loopContext(currentContext, node.item);
      if (node.keyExpression) {
        addExpressionError(node.keyExpression, childContext, node.loc);
      }
      for (const child of node.children) {
        if (child.type === 'element' && !child.keyExpression) {
          diagnostics.push(
            createDiagnostic(
              'KIL-155',
              filename,
              child.loc.line,
              child.loc.column,
              ERROR_MESSAGES.KIL_155
            )
          );
        }
        walk(child, childContext);
      }
      for (const child of node.emptyChildren) walk(child, currentContext);
      return;
    }

    // Element
    for (const [attrName, attrVal] of Object.entries(node.attributes)) {
      if (
        (attrName.startsWith('bind:') ||
          attrName.startsWith('on:') ||
          attrName.startsWith(':') ||
          attrName === 'key') &&
        attrVal.includes('{{')
      ) {
        diagnostics.push(
          createDiagnostic('KIL-159', filename, node.loc.line, node.loc.column, ERROR_MESSAGES.KIL_159)
        );
      }

      if ((attrName === 'style' || /^on[a-z]+$/i.test(attrName)) && attrVal.includes('{{')) {
        diagnostics.push(
          createDiagnostic('KIL-160', filename, node.loc.line, node.loc.column, ERROR_MESSAGES.KIL_160)
        );
      }

      const normalized = attrName.startsWith(':') ? attrName.slice(1) : attrName;
      if (urlAttributes.has(normalized)) {
        addUrlError(attrVal, node.loc);
      }
    }

    if (node.tag.toLowerCase().startsWith('x-')) {
      if (!childTags.has(node.tag.toLowerCase())) {
        diagnostics.push(
          createDiagnostic(
            'KIL-212',
            filename,
            node.loc.line,
            node.loc.column,
            ERROR_MESSAGES.KIL_212.replace('{nama}', node.tag.replace(/^x-/, ''))
          )
        );
      }
    }

    for (const ev of node.events) {
      if (!allowedEvents.has(ev.event)) {
        diagnostics.push(
          createDiagnostic(
            'KIL-153',
            filename,
            ev.loc.line,
            ev.loc.column,
            ERROR_MESSAGES.KIL_153.replace('{event}', ev.event)
          )
        );
      }
      const handler = parseHandler(ev.handlerCall);
      if (!validMethods.has(handler.method)) {
        diagnostics.push(
          createDiagnostic(
            'KIL-153',
            filename,
            ev.loc.line,
            ev.loc.column,
            ERROR_MESSAGES.KIL_153.replace('{event}', ev.event)
          )
        );
      }
      for (const arg of handler.args) {
        addExpressionError(arg, currentContext, ev.loc);
      }
    }

    for (const [bindingName, target] of Object.entries(node.bindings)) {
      const state = target.startsWith('$') ? target.slice(1) : target;
      if (propNames.has(state) || !stateNames.has(state) || target.includes('->') || target.includes('.')) {
        diagnostics.push(
          createDiagnostic('KIL-154', filename, node.loc.line, node.loc.column, ERROR_MESSAGES.KIL_154)
        );
      }
      if (!['value', 'checked'].includes(bindingName)) {
        diagnostics.push(
          createDiagnostic(
            'KIL-154',
            filename,
            node.loc.line,
            node.loc.column,
            `bind:${bindingName} tidak didukung. Gunakan bind:value atau bind:checked.`
          )
        );
      }
    }

    for (const expression of Object.values(node.dynamicAttributes)) {
      addExpressionError(expression, currentContext, node.loc);
    }

    if (node.errorPath) {
      const root = node.errorPath.split('.')[0] ?? '';
      if (!stateNames.has(root)) {
        diagnostics.push(
          createDiagnostic(
            'KIL-156',
            filename,
            node.loc.line,
            node.loc.column,
            ERROR_MESSAGES.KIL_156.replace('{path}', node.errorPath)
          )
        );
      }
    }

    for (const child of node.nodes) walk(child, currentContext);
  };

  for (const node of nodes) walk(node, ctx);
}

/**
 * Mencari ?> pertama di luar string/komentar agar komponen tidak terpotong
 * hanya karena kode PHP memuat teks "?>".
 */
function findPhpCloseTag(source: string): number {
  let quote: string | null = null;
  let blockComment = false;
  let lineComment = false;

  for (let i = 0; i < source.length - 1; i++) {
    const ch = source[i]!;
    const next = source[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      lineComment = true;
      i++;
      continue;
    }
    if (ch === '#') {
      lineComment = true;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === '?' && next === '>') {
      return i;
    }
  }
  return -1;
}
