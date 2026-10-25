/**
 * @kylat/compiler - codegen.ts
 * Emitter JavaScript reaktif berbasis signals untuk @kylat/runtime.
 */

import type { ComponentIR } from './ir.js';

export function generateJavaScript(ir: ComponentIR): string {
  const lines: string[] = [];

  lines.push('/**');
  lines.push(` * Komponen Kylat yang dikompilasi: ${ir.name}`);
  lines.push(' * Dihasilkan secara otomatis oleh @kylat/compiler');
  lines.push(' */');
  lines.push('');
  lines.push("import { createSignal, createComputed, bindText, bindAttr, bindInput, on, callServerAction } from '@kylat/runtime';");
  lines.push('');

  lines.push(`export function create${ir.name}(props = {}) {`);
  lines.push('  // 1. Inisialisasi State Sinyal');

  // Inisialisasi props
  for (const p of ir.props) {
    const fallback = p.defaultValue ?? 'undefined';
    lines.push(`  const prop_${p.name} = props['${p.name}'] !== undefined ? props['${p.name}'] : ${fallback};`);
  }

  // Inisialisasi state lokal
  for (const s of ir.state) {
    lines.push(`  const [${s.name}, set_${s.name}] = createSignal(${s.initialValue});`);
  }

  lines.push('');
  lines.push('  // 2. Definisi Aksi & Method');

  for (const m of ir.methods) {
    if (m.kind === 'server') {
      const contract = ir.serverUses[0]?.contractName ?? ir.name;
      lines.push(`  async function ${m.name}(args = {}) {`);
      lines.push(`    return await callServerAction('${contract}::${m.name}', args);`);
      lines.push('  }');
    } else {
      lines.push(`  function ${m.name}() {`);
      lines.push(`    // Client method ${m.name}`);
      lines.push('  }');
    }
  }

  lines.push('');
  lines.push('  // 3. Konstruksi DOM Element & Binding');
  lines.push("  const root = document.createElement('div');");
  lines.push(`  root.setAttribute('data-kylat-component', '${ir.name}');`);
  lines.push('');
  lines.push('  return root;');
  lines.push('}');
  lines.push('');
  lines.push(`export default create${ir.name};`);
  lines.push('');

  return lines.join('\n');
}
