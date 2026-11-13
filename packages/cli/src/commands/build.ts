/**
 * @kylat/cli - commands/build.ts
 * Perintah `kylat build`: kompilasi komponen single-file *.kylat.php
 * (dan format dua-berkas legacy) menjadi modul JavaScript.
 */

import fs from 'node:fs';
import path from 'node:path';
import { analyzeActionContract, compile, initPhpParser } from '@kylat/compiler';

export interface BuildOptions {
  outDir?: string;
  /** Default true; `--production` mematikan source map. */
  sourceMap?: boolean;
  production?: boolean;
}

interface ManifestEntry {
  name: string;
  file: string;
  output: string;
  sourceMap: string | null;
}

export async function runBuildCommand(
  inputPath: string = 'resources/views/components',
  options?: BuildOptions
): Promise<number> {
  const outDir = options?.outDir ?? 'public/dist/kylat';
  const emitSourceMap = options?.sourceMap ?? !options?.production;
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
  function collect(dir: string): void {
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

  // KIL-310: preflight kontrak/kelas aksi di direktori input.
  for (const file of phpFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('extends Component') || !/#\[\s*(?:Kylat\\Attributes\\)?Server\b/.test(content)) {
      continue;
    }
    const parser = await initPhpParser();
    const actionDiagnostics = analyzeActionContract(parser.parse(content), path.relative(process.cwd(), file));
    for (const diagnostic of actionDiagnostics) {
      errorCount++;
      console.error(
        `\x1b[31m❌ [${diagnostic.code}] ${diagnostic.message} (${diagnostic.file}:${diagnostic.line}:${diagnostic.column})\x1b[0m`
      );
    }
  }
  const manifest: ManifestEntry[] = [];
  const emittedNames = new Map<string, string>();

  for (const file of phpFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativeFile = path.relative(process.cwd(), file);

    const isKylatSingleFile = file.endsWith('.kylat.php');
    if (!isKylatSingleFile && !content.includes('extends Component')) {
      continue;
    }
    if (isKylatSingleFile && !content.includes('extends Component')) {
      continue;
    }

    let templateSource: string | undefined;
    if (!content.includes('?>')) {
      // Format legacy: template pendamping hanya untuk berkas .php lama.
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
    if (!result.success || !result.ir) {
      errorCount++;
      console.error(`\x1b[31m❌ Gagal mengompilasi ${relativeFile}:\x1b[0m`);
      for (const diagnostic of result.diagnostics) {
        console.error(
          `   [${diagnostic.code}] ${diagnostic.message} (${diagnostic.line}:${diagnostic.column})`
        );
      }
      continue;
    }

    const outFilename = `${result.ir.name}.js`;
    if (emittedNames.has(outFilename)) {
      errorCount++;
      console.error(
        `\x1b[31m❌ Nama komponen '${result.ir.name}' bentrok dengan ${emittedNames.get(outFilename)}.\x1b[0m`
      );
      continue;
    }
    emittedNames.set(outFilename, relativeFile);

    const destPath = path.join(resolvedOutDir, outFilename);
    const mapFilename = `${outFilename}.map`;
    const codeWithMap = emitSourceMap && result.map
      ? `${result.code}\n//# sourceMappingURL=${mapFilename}\n`
      : result.code;

    fs.writeFileSync(destPath, codeWithMap, 'utf-8');
    if (emitSourceMap && result.map) {
      fs.writeFileSync(path.join(resolvedOutDir, mapFilename), result.map, 'utf-8');
    }
    manifest.push({
      name: result.ir.name,
      file: relativeFile.replace(/\\/g, '/'),
      output: outFilename,
      sourceMap: emitSourceMap && result.map ? mapFilename : null,
    });
    compiledCount++;
    console.log(`  \x1b[32m✓\x1b[0m ${result.ir.name} -> ${path.relative(process.cwd(), destPath)}`);
  }

  if (compiledCount > 0) {
    const imports = manifest
      .map((entry) => `import { create${entry.name} } from './${entry.name}.js';`)
      .join('\n');
    const registrations = manifest
      .map((entry) => `registerIsland(${JSON.stringify(entry.name)}, create${entry.name});`)
      .join('\n');

    const clientEntry = `import { hydrateAll, registerIsland } from '@kylat/runtime';
${imports}

${registrations}

function boot() {
  hydrateAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

export { boot };
`;
    fs.writeFileSync(path.join(resolvedOutDir, 'client.js'), clientEntry, 'utf-8');
  }

  fs.writeFileSync(
    path.join(resolvedOutDir, 'manifest.json'),
    JSON.stringify(
      { version: 1, entry: compiledCount > 0 ? 'client.js' : null, components: manifest },
      null,
      2
    ),
    'utf-8'
  );

  console.log(
    `\n🎉 Selesai: ${compiledCount} komponen berhasil dikompilasi (${errorCount} gagal).`
  );
  return errorCount > 0 ? 1 : 0;
}
