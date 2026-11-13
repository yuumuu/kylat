import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../../packages/compiler/dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const source = fs.readFileSync(path.resolve(__dirname, 'cart.kylat.php'), 'utf-8');
const result = await compile(source, 'cart.kylat.php');

if (!result.success) {
  console.error('❌ Gagal mengompilasi Cart:');
  for (const diagnostic of result.diagnostics) {
    console.error(`   [${diagnostic.code}] baris ${diagnostic.line}:${diagnostic.column} - ${diagnostic.message}`);
  }
  process.exit(1);
}

const outDir = path.resolve(__dirname, 'dist');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.resolve(outDir, 'Cart.js'), result.code, 'utf-8');
console.log('✅ Cart.js ditulis ke dist/Cart.js');
