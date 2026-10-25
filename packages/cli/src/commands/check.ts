/**
 * @kylat/cli - commands/check.ts
 * Perintah `kylat check [path]` untuk memvalidasi kepatuhan komponen terhadap subset v0.
 */

import fs from 'node:fs';
import path from 'node:path';
import { compile, type Diagnostic } from '@kylat/compiler';

export async function runCheckCommand(targetPath: string = '.'): Promise<number> {
  const resolvedPath = path.resolve(process.cwd(), targetPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Path '${targetPath}' tidak ditemukan.`);
    return 1;
  }

  const phpFiles: string[] = [];

  function collectFiles(currentPath: string) {
    const stat = fs.statSync(currentPath);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(currentPath);
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === 'vendor' || entry === '.git') continue;
        collectFiles(path.join(currentPath, entry));
      }
    } else if (stat.isFile() && currentPath.endsWith('.php')) {
      phpFiles.push(currentPath);
    }
  }

  collectFiles(resolvedPath);

  if (phpFiles.length === 0) {
    console.log(`ℹ️  Tidak ditemukan berkas .php di ${targetPath}.`);
    return 0;
  }

  console.log(`🔍 Memeriksa ${phpFiles.length} berkas komponen PHP...\n`);

  let totalErrors = 0;
  const diagnosticsList: Diagnostic[] = [];

  for (const file of phpFiles) {
    const relativeFile = path.relative(process.cwd(), file);
    const content = fs.readFileSync(file, 'utf-8');

    // Hanya periksa jika berkas tampak seperti komponen Kylat (menggunakan Component atau deklarasi class)
    if (!content.includes('class ') || (!content.includes('Component') && !content.includes('#['))) {
      continue;
    }

    const result = await compile(content, relativeFile);
    if (result.diagnostics.length > 0) {
      diagnosticsList.push(...result.diagnostics);
      if (!result.success) {
        totalErrors++;
      }
    }
  }

  if (diagnosticsList.length === 0) {
    console.log('✅ Semua komponen lolos pemeriksaan subset v0 (0 error, 0 warning)!');
    return 0;
  }

  console.log('--------------------------------------------------');
  for (const diag of diagnosticsList) {
    console.log(`\x1b[31m[${diag.code}]\x1b[0m ${diag.message}`);
    console.log(`  --> ${diag.file}:${diag.line}:${diag.column}`);
    if (diag.hint) {
      console.log(`  \x1b[36m💡 Petunjuk:\x1b[0m ${diag.hint}`);
    }
    console.log(`  \x1b[90m📖 Dokumentasi:\x1b[0m ${diag.docUrl}\n`);
  }
  console.log('--------------------------------------------------');

  if (totalErrors > 0) {
    console.log(`\x1b[31m❌ Ditemukan ${diagnosticsList.length} masalah di komponen Anda.\x1b[0m`);
    return 1;
  }

  console.log(`\x1b[33m⚠️  Ditemukan ${diagnosticsList.length} peringatan.\x1b[0m`);
  return 0;
}
