/**
 * @kylat/cli - commands/build.ts
 * Perintah `kylat build` untuk mengompilasi komponen PHP ke JavaScript modules.
 */

import fs from 'node:fs';
import path from 'node:path';
import { compile } from '@kylat/compiler';

export interface BuildOptions {
  outDir?: string;
}

export async function runBuildCommand(inputPath: string = 'resources/views/components', options?: BuildOptions): Promise<number> {
  const outDir = options?.outDir ?? 'public/dist/kylat';
  const resolvedInput = path.resolve(process.cwd(), inputPath);
  const resolvedOutDir = path.resolve(process.cwd(), outDir);

  if (!fs.existsSync(resolvedInput)) {
    console.error(`❌ Direktori input '${inputPath}' tidak ditemukan.`);
    return 1;
  }

  if (!fs.existsSync(resolvedOutDir)) {
    fs.mkdirSync(resolvedOutDir, { recursive: true });
  }

  const phpFiles: string[] = [];
  function collect(dir: string) {
    for (const item of fs.readdirSync(dir)) {
      if (item === 'node_modules' || item === 'vendor' || item === '.git') continue;
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) {
        collect(full);
      } else if (full.endsWith('.php') && !full.endsWith('.blade.php')) {
        phpFiles.push(full);
      }
    }
  }

  collect(resolvedInput);

  if (phpFiles.length === 0) {
    console.log(`ℹ️  Tidak ada berkas .php untuk dikompilasi di '${inputPath}'.`);
    return 0;
  }

  console.log(`⚡ Mengompilasi ${phpFiles.length} komponen Kylat ke '${outDir}'...`);

  let compiledCount = 0;
  let errorCount = 0;
  for (const file of phpFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativeFile = path.relative(process.cwd(), file);

    // Hanya kompilasi berkas yang merupakan kelas komponen Kylat
    if (!content.includes('extends Component')) {
      continue;
    }

    const baseName = path.basename(file, '.php');
    const dirName = path.dirname(file);

    // Cari template blade pendamping (misal counter.blade.php atau Counter.blade.php)
    let templateSource: string | undefined;
    const lowerBlade = path.join(dirName, `${baseName.toLowerCase()}.blade.php`);
    const exactBlade = path.join(dirName, `${baseName}.blade.php`);
    if (fs.existsSync(lowerBlade)) {
      templateSource = fs.readFileSync(lowerBlade, 'utf-8');
    } else if (fs.existsSync(exactBlade)) {
      templateSource = fs.readFileSync(exactBlade, 'utf-8');
    }

    const result = await compile(content, relativeFile, { template: templateSource });
    if (!result.success || !result.ir) {
      errorCount++;
      console.error(`\x1b[31m❌ Gagal mengompilasi ${relativeFile}:\x1b[0m`);
      for (const d of result.diagnostics) {
        console.error(`   [${d.code}] ${d.message} (${d.line}:${d.column})`);
      }
      continue;
    }

    const outFilename = `${result.ir.name}.js`;
    const destPath = path.join(resolvedOutDir, outFilename);
    fs.writeFileSync(destPath, result.code, 'utf-8');
    compiledCount++;
    console.log(`  \x1b[32m✓\x1b[0m ${result.ir.name} -> ${path.relative(process.cwd(), destPath)}`);
  }

  console.log(`\n🎉 Selesai: ${compiledCount} komponen berhasil dikompilasi (${errorCount} gagal).`);
  return errorCount > 0 ? 1 : 0;
}
