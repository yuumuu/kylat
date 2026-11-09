/**
 * @kylat/cli - commands/check.ts
 * Perintah `kylat check [path]` untuk memvalidasi komponen terhadap subset v0,
 * termasuk template single-file setelah ?>.
 */

import fs from 'node:fs';
import path from 'node:path';
import { analyzeActionContract, compile, initPhpParser, type Diagnostic } from '@kylat/compiler';

export async function runCheckCommand(targetPath: string = '.'): Promise<number> {
  const resolvedPath = path.resolve(process.cwd(), targetPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Path '${targetPath}' tidak ditemukan.`);
    return 1;
  }

  const phpFiles: string[] = [];

  function collectFiles(currentPath: string): void {
    const stat = fs.statSync(currentPath);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(currentPath)) {
        if (entry === 'node_modules' || entry === 'vendor' || entry === '.git') continue;
        collectFiles(path.join(currentPath, entry));
      }
    } else if (stat.isFile() && currentPath.endsWith('.php') && !currentPath.endsWith('.blade.php')) {
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

    // KIL-310: periksa kontrak/kelas aksi yang mengekspos #[Server].
    // Komponen (extends Component) dilewati karena method #[Server] di sana
    // hanyalah proxy ke kontrak aksi.
    if (!content.includes('extends Component') && /#\[\s*(?:Kylat\\Attributes\\)?Server\b/.test(content)) {
      const parser = await initPhpParser();
      const actionDiagnostics = analyzeActionContract(parser.parse(content), relativeFile);
      if (actionDiagnostics.length > 0) {
        diagnosticsList.push(...actionDiagnostics);
        totalErrors++;
      }
      continue;
    }

    if (!content.includes('class ') || !content.includes('Component')) {
      continue;
    }

    let templateSource: string | undefined;
    if (!content.includes('?>')) {
      const baseName = path.basename(file, '.php');
      const dirName = path.dirname(file);
      const candidates = [
        path.join(dirName, `${baseName}.blade.php`),
        path.join(dirName, `${baseName.toLowerCase()}.blade.php`),
      ];
      const found = candidates.find((candidate) => fs.existsSync(candidate));
      if (found) templateSource = fs.readFileSync(found, 'utf-8');
    }

    const result = await compile(
      content,
      relativeFile,
      templateSource === undefined ? undefined : { template: templateSource }
    );
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
  for (const diagnostic of diagnosticsList) {
    console.log(`\x1b[31m[${diagnostic.code}]\x1b[0m ${diagnostic.message}`);
    console.log(`  --> ${diagnostic.file}:${diagnostic.line}:${diagnostic.column}`);
    if (diagnostic.hint) {
      console.log(`  \x1b[36m💡 Petunjuk:\x1b[0m ${diagnostic.hint}`);
    }
    console.log(`  \x1b[90m📖 Dokumentasi:\x1b[0m ${diagnostic.docUrl}\n`);
  }
  console.log('--------------------------------------------------');

  if (totalErrors > 0) {
    console.log(`\x1b[31m❌ Ditemukan ${diagnosticsList.length} masalah di komponen Anda.\x1b[0m`);
    return 1;
  }

  console.log(`\x1b[33m⚠️  Ditemukan ${diagnosticsList.length} peringatan.\x1b[0m`);
  return 0;
}
