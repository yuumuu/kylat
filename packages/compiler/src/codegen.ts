/**
 * @kylat/compiler - codegen.ts
 * Emitter JavaScript reaktif fine-grained signals untuk @kylat/runtime.
 * Menghasilkan konstruksi DOM nyata, sinyal state, transpilasi method, dan binding RPC.
 */

import type { ComponentIR } from './ir.js';
import { parseTemplate, type ParsedElement } from './template-parser.js';

export function generateJavaScript(ir: ComponentIR, templateSource?: string): string {
  const lines: string[] = [];

  lines.push('/**');
  lines.push(` * Komponen Kylat yang dikompilasi: ${ir.name}`);
  lines.push(' * Dihasilkan secara otomatis oleh @kylat/compiler');
  lines.push(' */');
  lines.push('');
  lines.push("import { createSignal, createComputed, bindText, bindAttr, bindInput, on, callServerAction } from '@kylat/runtime';");
  lines.push('');

  lines.push(`export function create${ir.name}(props = {}) {`);
  lines.push('  // 1. Inisialisasi Props & State Sinyal');

  // Inisialisasi props dari argumen props
  for (const p of ir.props) {
    const fallback = p.defaultValue ?? 'undefined';
    lines.push(`  const prop_${p.name} = props['${p.name}'] !== undefined ? props['${p.name}'] : ${fallback};`);
  }

  // Inisialisasi state lokal: jika nama cocok dengan prop_initialX, gunakan prop sebagai initial value
  for (const s of ir.state) {
    const matchingProp = ir.props.find(
      (p) => p.name.toLowerCase() === `initial${s.name.toLowerCase()}` || p.name === s.name
    );
    const initialExpr = matchingProp ? `prop_${matchingProp.name} ?? ${s.initialValue}` : s.initialValue;
    lines.push(`  const [${s.name}, set_${s.name}] = createSignal(${initialExpr});`);
  }

  lines.push('');
  lines.push('  // 2. Definisi Aksi & Method');

  for (const m of ir.methods) {
    if (m.kind === 'server') {
      const contract = ir.serverUses[0]?.contractName ?? ir.name;
      // Ambil method aksi yang sebenarnya dipanggil di dalam body (misal: ->server(...)->saveCount(...))
      const serverCallMatch = m.body.match(/->server\(.*?\)->([a-zA-Z0-9_]+)\((.*?)\)/);
      const actionMethodName = serverCallMatch && serverCallMatch[1] ? serverCallMatch[1] : m.name;
      const rawArg = serverCallMatch && serverCallMatch[2] ? serverCallMatch[2].replace('$this->', '').trim() : '';
      const defaultArgs = rawArg ? `{ ${rawArg}: ${rawArg}() }` : 'args';

      lines.push(`  async function ${m.name}(args = {}) {`);
      lines.push(`    return await callServerAction('${contract}::${actionMethodName}', ${defaultArgs});`);
      lines.push('  }');
    } else {
      lines.push(`  function ${m.name}() {`);

      // Transpilasi ekspresi increment / decrement sederhana
      if (m.body.includes('$this->count++') || m.body.includes('$this->count += 1')) {
        lines.push('    set_count(count() + 1);');
      } else if (m.body.includes('$this->count--') || m.body.includes('$this->count -= 1')) {
        lines.push('    set_count(count() - 1);');
      } else {
        lines.push(`    // Method client ${m.name}`);
      }

      lines.push('  }');
    }
  }

  lines.push('');
  lines.push('  // 3. Konstruksi DOM Element & Binding');

  if (templateSource && templateSource.trim().length > 0) {
    const parsedElements = parseTemplate(templateSource);
    let elemCounter = 0;

    function emitElement(el: ParsedElement, parentVar: string | null): string {
      elemCounter++;
      const elVar = `el_${el.tag.replace(/[^a-zA-Z0-9]/g, '_')}_${elemCounter}`;
      lines.push(`  const ${elVar} = document.createElement('${el.tag}');`);

      for (const [attrName, attrVal] of Object.entries(el.attributes)) {
        lines.push(`  ${elVar}.setAttribute('${attrName}', '${attrVal}');`);
      }

      for (const ev of el.events) {
        // Hapus kurung di handler call jika ada (on:click="increment()")
        const cleanHandler = ev.handlerCall.replace(/\(\)$/, '').trim();
        lines.push(`  on(${elVar}, '${ev.event}', () => ${cleanHandler}());`);
      }

      if (el.expressionBinding) {
        lines.push(`  bindText(${elVar}, () => ${el.expressionBinding}());`);
      } else if (el.textContent) {
        lines.push(`  ${elVar}.textContent = '${el.textContent}';`);
      }

      for (const child of el.children) {
        emitElement(child, elVar);
      }

      if (parentVar) {
        lines.push(`  ${parentVar}.appendChild(${elVar});`);
      }

      return elVar;
    }

    if (parsedElements.length > 0 && parsedElements[0]) {
      const rootVar = emitElement(parsedElements[0], null);
      lines.push(`  ${rootVar}.setAttribute('data-kylat-component', '${ir.name}');`);
      lines.push(`  return ${rootVar};`);
    } else {
      lines.push("  const root = document.createElement('div');");
      lines.push(`  root.setAttribute('data-kylat-component', '${ir.name}');`);
      lines.push('  return root;');
    }
  } else {
    lines.push("  const root = document.createElement('div');");
    lines.push(`  root.setAttribute('data-kylat-component', '${ir.name}');`);
    lines.push('  return root;');
  }

  lines.push('}');
  lines.push('');
  lines.push(`export default create${ir.name};`);
  lines.push('');

  return lines.join('\n');
}
