/**
 * build.mjs - Build script untuk demo 01-counter
 * Mengompilasi counter.kylat.php ke dist/Counter.js menggunakan @kylat/compiler.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../../packages/compiler/dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const componentPath = path.resolve(__dirname, 'counter.kylat.php');
  const outDir = path.resolve(__dirname, 'dist');
  const outPath = path.resolve(outDir, 'Counter.js');

  const source = fs.readFileSync(componentPath, 'utf-8');

  console.log('⚡ Mengompilasi counter.kylat.php (Single-File Component)...');
  const result = await compile(source, 'counter.kylat.php');

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
