import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('@kylat/runtime - Anggaran Ukuran Inti (Size Budget)', () => {
  it('ukuran bundle terkompresi (gzip) tidak boleh melebihi batas anggaran (P10: batas terukur + 10%)', () => {
    const configPath = path.resolve(__dirname, '../size-budget.json');
    assert.ok(fs.existsSync(configPath), 'Berkas size-budget.json wajib ada.');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const entryPath = path.resolve(__dirname, '..', config.entry);

    const bundleResult = esbuild.buildSync({
      entryPoints: [entryPath],
      bundle: true,
      minify: true,
      format: 'esm',
      write: false,
    });

    const rawCode = bundleResult.outputFiles[0].contents;
    const rawBytes = rawCode.length;
    const gzipBytes = zlib.gzipSync(rawCode).length;

    console.log(
      `[@kylat/runtime bundle size] Raw: ${rawBytes} B (${(rawBytes / 1024).toFixed(2)} KB) | Gzip: ${gzipBytes} B (${(gzipBytes / 1024).toFixed(2)} KB) | Batas: ${config.maxGzipBytes} B`
    );

    assert.ok(
      gzipBytes <= config.maxGzipBytes,
      `Ukuran gzip runtime (${gzipBytes} B) melebihi batas anggaran (${config.maxGzipBytes} B). Anggaran terlampaui ${gzipBytes - config.maxGzipBytes} B!`
    );
  });
});
