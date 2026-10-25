/**
 * @kylat/compiler - codegen.ts
 * Emitter JavaScript reaktif fine-grained signals untuk @kylat/runtime.
 * Menghasilkan konstruksi DOM nyata, sinyal state, transpilasi method, dan binding RPC.
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
    bodyLines.push(`  const prop_${p.name} = props['${p.name}'] !== undefined ? props['${p.name}'] : ${fallback};`);
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

  // Lacak status pending untuk aksi server
  const serverActionPendingSignals = new Map<string, string>();
  for (const m of ir.methods) {
    if (m.kind === 'server') {
      usedImports.add('createSignal');
      const pendingSignalName = `is_pending_${m.name}`;
      serverActionPendingSignals.set(m.name, pendingSignalName);
      bodyLines.push(`  const [${pendingSignalName}, set_${pendingSignalName}] = createSignal(false);`);
    }
  }

  bodyLines.push('');
  bodyLines.push('  // 2. Definisi Aksi & Method');

  for (const m of ir.methods) {
    if (m.kind === 'server') {
      usedImports.add('callServerAction');
      const contract = ir.serverUses[0]?.contractName ?? ir.name;
      const pendingSignalName = serverActionPendingSignals.get(m.name)!;

      // Ambil method aksi yang sebenarnya dipanggil di dalam body (misal: ->server(...)->saveCount(...))
      const serverCallMatch = m.body.match(/->server\(.*?\)->([a-zA-Z0-9_]+)\((.*?)\)/);
      const actionMethodName = serverCallMatch && serverCallMatch[1] ? serverCallMatch[1] : m.name;
      const rawArg = serverCallMatch && serverCallMatch[2] ? serverCallMatch[2].replace('$this->', '').trim() : '';
      const defaultArgs = rawArg ? `{ ${rawArg}: ${rawArg}() }` : 'args';

      bodyLines.push(`  async function ${m.name}(args = {}) {`);
      bodyLines.push(`    set_${pendingSignalName}(true);`);
      bodyLines.push('    try {');
      bodyLines.push(`      return await callServerAction('${contract}::${actionMethodName}', ${defaultArgs});`);
      bodyLines.push('    } finally {');
      bodyLines.push(`      set_${pendingSignalName}(false);`);
      bodyLines.push('    }');
      bodyLines.push('  }');
    } else {
      bodyLines.push(`  function ${m.name}() {`);

      // Transpilasi ekspresi increment / decrement sederhana
      if (m.body.includes('$this->count++') || m.body.includes('$this->count += 1')) {
        bodyLines.push('    set_count(count() + 1);');
      } else if (m.body.includes('$this->count--') || m.body.includes('$this->count -= 1')) {
        bodyLines.push('    set_count(count() - 1);');
      } else {
        bodyLines.push(`    // Method client ${m.name}`);
      }

      bodyLines.push('  }');
    }
  }

  bodyLines.push('');
  bodyLines.push('  // 3. Konstruksi DOM Element & Binding');

  if (templateSource && templateSource.trim().length > 0) {
    const parsedElements = parseTemplate(templateSource);
    let elemCounter = 0;

    function emitElement(el: ParsedElement, parentVar: string | null): string {
      elemCounter++;
      const elVar = `el_${el.tag.replace(/[^a-zA-Z0-9]/g, '_')}_${elemCounter}`;
      bodyLines.push(`  const ${elVar} = document.createElement('${el.tag}');`);

      for (const [attrName, attrVal] of Object.entries(el.attributes)) {
        bodyLines.push(`  ${elVar}.setAttribute('${attrName}', '${attrVal}');`);
      }

      for (const ev of el.events) {
        usedImports.add('on');
        const cleanHandler = ev.handlerCall.replace(/\(\)$/, '').trim();
        bodyLines.push(`  on(${elVar}, '${ev.event}', () => ${cleanHandler}());`);

        // Jika event memicu aksi server, ikat aria-busy dan data-pending
        const pendingSignal = serverActionPendingSignals.get(cleanHandler);
        if (pendingSignal) {
          usedImports.add('bindAttr');
          bodyLines.push(`  bindAttr(${elVar}, 'aria-busy', () => ${pendingSignal}() ? 'true' : null);`);
          bodyLines.push(`  bindAttr(${elVar}, 'data-pending', () => ${pendingSignal}() ? '' : null);`);
        }
      }

      if (el.expressionBinding) {
        usedImports.add('bindText');
        bodyLines.push(`  bindText(${elVar}, () => ${el.expressionBinding}());`);
      } else if (el.textContent) {
        bodyLines.push(`  ${elVar}.textContent = '${el.textContent}';`);
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
      bodyLines.push(`  ${rootVar}.setAttribute('data-kylat-component', '${ir.name}');`);
      bodyLines.push(`  return ${rootVar};`);
    } else {
      bodyLines.push("  const root = document.createElement('div');");
      bodyLines.push(`  root.setAttribute('data-kylat-component', '${ir.name}');`);
      bodyLines.push('  return root;');
    }
  } else {
    bodyLines.push("  const root = document.createElement('div');");
    bodyLines.push(`  root.setAttribute('data-kylat-component', '${ir.name}');`);
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
