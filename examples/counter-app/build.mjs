/**
 * build.mjs - Build script untuk demo counter-app
 * Mengompilasi Counter.php dan counter.blade.php ke dist/Counter.js menggunakan @kylat/compiler.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../../packages/compiler/dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const phpPath = path.resolve(__dirname, 'Counter.php');
  const bladePath = path.resolve(__dirname, 'counter.blade.php');
  const outDir = path.resolve(__dirname, 'dist');
  const outPath = path.resolve(outDir, 'Counter.js');

  const phpSource = fs.readFileSync(phpPath, 'utf-8');
  const bladeSource = fs.readFileSync(bladePath, 'utf-8');

  console.log('⚡ Mengompilasi Counter.php dengan template Blade...');
  const result = await compile(phpSource, 'Counter.php', { template: bladeSource });

  if (!result.success) {
    console.error('❌ Gagal mengompilasi Counter:');
    for (const d of result.diagnostics) {
      console.error(`   [${d.code}] baris ${d.line}:${d.column} - ${d.message}`);
    }
    process.exit(1);
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outPath, result.code, 'utf-8');
  console.log(`✅ Kompilasi sukses! Output ditulis ke: ${outPath}`);
}

main().catch((err) => {
  console.error('Fatal error during build:', err);
  process.exit(1);
});
