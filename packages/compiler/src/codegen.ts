/**
 * @kylat/compiler - codegen.ts
 * Emitter JavaScript reaktif fine-grained signals untuk @kylat/runtime.
 * Menghasilkan konstruksi DOM nyata, sinyal state, transpilasi method dari IR AST, dan binding RPC.
 */

import type { ComponentIR } from './ir.js';
import { parseTemplate, type ParsedElement } from './template-parser.js';

export function generateJavaScript(ir: ComponentIR, templateSource?: string): string {
  const bodyLines: string[] = [];
  const usedImports = new Set<string>();

  bodyLines.push(`export function create${ir.name}(props = {}) {`);
  bodyLines.push('  // 1. Inisialisasi Props & State Sinyal');

  // Inisialisasi props dari argumen props
  for (const p of ir.props) {
    const fallback = p.defaultValue ?? 'undefined';
    bodyLines.push(`  const prop_${p.name} = props[${JSON.stringify(p.name)}] !== undefined ? props[${JSON.stringify(p.name)}] : ${fallback};`);
  }

  // Inisialisasi state lokal
  for (const s of ir.state) {
    usedImports.add('createSignal');
    const matchingProp = ir.props.find(
      (p) => p.name.toLowerCase() === `initial${s.name.toLowerCase()}` || p.name === s.name
    );
    const initialExpr = matchingProp ? `prop_${matchingProp.name}` : s.initialValue;
    bodyLines.push(`  const [${s.name}, set_${s.name}] = createSignal(${initialExpr});`);
  }

  // Lacak status pending & error untuk aksi server
  const serverActionPendingSignals = new Map<string, string>();
  const serverActionErrorSignals = new Map<string, string>();

  for (const m of ir.methods) {
    if (m.kind === 'server') {
      usedImports.add('createSignal');
      const pendingSignalName = `is_pending_${m.name}`;
      const errorSignalName = `error_${m.name}`;
      serverActionPendingSignals.set(m.name, pendingSignalName);
      serverActionErrorSignals.set(m.name, errorSignalName);
      bodyLines.push(`  const [${pendingSignalName}, set_${pendingSignalName}] = createSignal(false);`);
      bodyLines.push(`  const [${errorSignalName}, set_${errorSignalName}] = createSignal(null);`);
      bodyLines.push(`  let current_idemp_${m.name} = null;`);
    }
  }

  bodyLines.push('');
  bodyLines.push('  // 2. Definisi Aksi & Method');

  for (const m of ir.methods) {
    if (m.kind === 'server') {
      usedImports.add('callServerAction');
      const serverCall = m.serverCall;
      const contract = serverCall?.contract ?? (ir.serverUses[0]?.contractName ?? ir.name);
      const actionMethod = serverCall?.actionMethod ?? m.name;
      const isMutation = serverCall ? serverCall.isMutation : true;

      const pendingSignal = serverActionPendingSignals.get(m.name)!;
      const errorSignal = serverActionErrorSignals.get(m.name)!;

      const argsObject =
        serverCall && serverCall.args.length > 0
          ? `{ ${serverCall.args.map((a) => `${a.name}: ${a.valueExpr}`).join(', ')} }`
          : 'args';

      bodyLines.push(`  async function ${m.name}(args = {}) {`);
      bodyLines.push(`    set_${pendingSignal}(true);`);
      bodyLines.push(`    set_${errorSignal}(null);`);
      bodyLines.push('    try {');

      if (isMutation) {
        bodyLines.push(`      current_idemp_${m.name} ??= "idemp_" + Date.now();`);
        bodyLines.push(
          `      const res = await callServerAction(${JSON.stringify(`${contract}::${actionMethod}`)}, ${argsObject}, { idempotencyKey: current_idemp_${m.name} });`
        );
        bodyLines.push(`      current_idemp_${m.name} = null;`);
        bodyLines.push(`      return res;`);
      } else {
        bodyLines.push(
          `      return await callServerAction(${JSON.stringify(`${contract}::${actionMethod}`)}, ${argsObject});`
        );
      }

      bodyLines.push('    } catch (err) {');
      bodyLines.push(`      set_${errorSignal}(err instanceof Error ? err.message : String(err));`);
      bodyLines.push('    } finally {');
      bodyLines.push(`      set_${pendingSignal}(false);`);
      bodyLines.push('    }');
      bodyLines.push('  }');
    } else {
      bodyLines.push(`  function ${m.name}() {`);

      // Transpilasi operasi berbasis AST IR terstruktur (tanpa regex string)
      if (m.operations && m.operations.length > 0) {
        for (const op of m.operations) {
          if (op.type === 'mutate_state') {
            if (op.operator === '+=') {
              bodyLines.push(`    set_${op.target}(${op.target}() + ${op.operand});`);
            } else if (op.operator === '-=') {
              bodyLines.push(`    set_${op.target}(${op.target}() - ${op.operand});`);
            } else {
              bodyLines.push(`    set_${op.target}(${op.operand});`);
            }
          }
        }
      }

      bodyLines.push('  }');
    }
  }

  bodyLines.push('');
  bodyLines.push('  // 3. Konstruksi DOM Element & Binding');

  let elemCounter = 0;

  if (templateSource && templateSource.trim().length > 0) {
    const parsedElements = parseTemplate(templateSource);

    function emitElement(el: ParsedElement, parentVar: string | null): string {
      elemCounter++;
      const elVar = `el_${el.tag.replace(/[^a-zA-Z0-9]/g, '_')}_${elemCounter}`;
      bodyLines.push(`  const ${elVar} = document.createElement(${JSON.stringify(el.tag)});`);

      for (const [attrName, attrVal] of Object.entries(el.attributes)) {
        bodyLines.push(`  ${elVar}.setAttribute(${JSON.stringify(attrName)}, ${JSON.stringify(attrVal)});`);
      }

      for (const ev of el.events) {
        usedImports.add('on');
        const cleanHandler = ev.handlerCall.replace(/\(\)$/, '').trim();
        bodyLines.push(`  on(${elVar}, ${JSON.stringify(ev.event)}, () => ${cleanHandler}());`);

        // Jika event memicu aksi server, ikat aria-busy, data-pending, dan disabled (cegah double click)
        const pendingSignal = serverActionPendingSignals.get(cleanHandler);
        if (pendingSignal) {
          usedImports.add('bindAttr');
          bodyLines.push(`  bindAttr(${elVar}, "aria-busy", () => ${pendingSignal}() ? "true" : null);`);
          bodyLines.push(`  bindAttr(${elVar}, "data-pending", () => ${pendingSignal}() ? "" : null);`);
          bodyLines.push(`  bindAttr(${elVar}, "disabled", () => ${pendingSignal}() ? "disabled" : null);`);
        }
      }

      if (el.expressionBinding) {
        usedImports.add('bindText');
        bodyLines.push(`  bindText(${elVar}, () => ${el.expressionBinding}());`);
      } else if (el.textContent) {
        bodyLines.push(`  ${elVar}.textContent = ${JSON.stringify(el.textContent)};`);
      }

      for (const child of el.children) {
        emitElement(child, elVar);
      }

      if (parentVar) {
        bodyLines.push(`  ${parentVar}.appendChild(${elVar});`);
      }

      return elVar;
    }

    if (parsedElements.length > 0 && parsedElements[0]) {
      const rootVar = emitElement(parsedElements[0], null);
      for (const [, errorSignal] of serverActionErrorSignals) {
        elemCounter++;
        const errVar = `el_live_error_${elemCounter}`;
        bodyLines.push(`  const ${errVar} = document.createElement("div");`);
        bodyLines.push(`  ${errVar}.setAttribute("aria-live", "polite");`);
        bodyLines.push(`  ${errVar}.setAttribute("role", "status");`);
        usedImports.add('bindText');
        bodyLines.push(`  bindText(${errVar}, () => ${errorSignal}() ?? "");`);
        bodyLines.push(`  ${rootVar}.appendChild(${errVar});`);
      }
      bodyLines.push(`  ${rootVar}.setAttribute("data-kylat-component", ${JSON.stringify(ir.name)});`);
      bodyLines.push(`  return ${rootVar};`);
    } else {
      const rootVar = 'root';
      bodyLines.push('  const root = document.createElement("div");');
      for (const [, errorSignal] of serverActionErrorSignals) {
        elemCounter++;
        const errVar = `el_live_error_${elemCounter}`;
        bodyLines.push(`  const ${errVar} = document.createElement("div");`);
        bodyLines.push(`  ${errVar}.setAttribute("aria-live", "polite");`);
        bodyLines.push(`  ${errVar}.setAttribute("role", "status");`);
        usedImports.add('bindText');
        bodyLines.push(`  bindText(${errVar}, () => ${errorSignal}() ?? "");`);
        bodyLines.push(`  ${rootVar}.appendChild(${errVar});`);
      }
      bodyLines.push(`  root.setAttribute("data-kylat-component", ${JSON.stringify(ir.name)});`);
      bodyLines.push('  return root;');
    }
  } else {
    const rootVar = 'root';
    bodyLines.push('  const root = document.createElement("div");');
    for (const [, errorSignal] of serverActionErrorSignals) {
      elemCounter++;
      const errVar = `el_live_error_${elemCounter}`;
      bodyLines.push(`  const ${errVar} = document.createElement("div");`);
      bodyLines.push(`  ${errVar}.setAttribute("aria-live", "polite");`);
      bodyLines.push(`  ${errVar}.setAttribute("role", "status");`);
      usedImports.add('bindText');
      bodyLines.push(`  bindText(${errVar}, () => ${errorSignal}() ?? "");`);
      bodyLines.push(`  ${rootVar}.appendChild(${errVar});`);
    }
    bodyLines.push(`  root.setAttribute("data-kylat-component", ${JSON.stringify(ir.name)});`);
    bodyLines.push('  return root;');
  }

  bodyLines.push('}');
  bodyLines.push('');
  bodyLines.push(`export default create${ir.name};`);
  bodyLines.push('');

  // Susun header dan baris impor hanya untuk fungsi yang benar-benar digunakan
  const headerLines: string[] = [
    '/**',
    ` * Komponen Kylat yang dikompilasi: ${ir.name}`,
    ' * Dihasilkan secara otomatis oleh @kylat/compiler',
    ' */',
    '',
  ];

  const sortedImports = Array.from(usedImports).sort();
  if (sortedImports.length > 0) {
    headerLines.push(`import { ${sortedImports.join(', ')} } from '@kylat/runtime';`);
    headerLines.push('');
  }

  return [...headerLines, ...bodyLines].join('\n');
}
