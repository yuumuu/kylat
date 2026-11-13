import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { runMakeComponentCommand } from '../dist/commands/make.js';
import { runDoctorCommand } from '../dist/commands/doctor.js';
import { runCheckCommand } from '../dist/commands/check.js';
import { runBuildCommand } from '../dist/commands/build.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('@kylat/cli - Command Suite', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kylat-cli-test-'));
  });

  after(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('make:component', () => {
    it('membuat berkas *.kylat.php baru dengan nama PascalCase', () => {
      const exitCode = runMakeComponentCommand('QuickCounter', { dir: tmpDir });
      assert.equal(exitCode, 0, 'make:component harus mengembalikan exit code 0');

      const targetFile = path.join(tmpDir, 'QuickCounter.kylat.php');
      assert.ok(fs.existsSync(targetFile), 'Berkas QuickCounter.kylat.php harus dibuat');

      const content = fs.readFileSync(targetFile, 'utf-8');
      assert.ok(content.includes('declare(strict_types=1);'), 'Wajib memiliki declare strict_types');
      assert.ok(content.includes('final class QuickCounter extends Component'), 'Wajib memiliki class PascalCase');
      assert.ok(content.includes('?>'), 'Wajib memiliki penutup tag PHP ?>');
    });

    it('menolak nama komponen yang bukan PascalCase', () => {
      const exitCode1 = runMakeComponentCommand('lowercase', { dir: tmpDir });
      assert.equal(exitCode1, 1, 'Nama lowercase harus ditolak');

      const exitCode2 = runMakeComponentCommand('kebab-case', { dir: tmpDir });
      assert.equal(exitCode2, 1, 'Nama kebab-case harus ditolak');

      const exitCode3 = runMakeComponentCommand(undefined, { dir: tmpDir });
      assert.equal(exitCode3, 1, 'Nama undefined harus ditolak');
    });

    it('menolak menimpa berkas jika komponen sudah ada', () => {
      // QuickCounter sudah dibuat pada tes pertama
      const exitCode = runMakeComponentCommand('QuickCounter', { dir: tmpDir });
      assert.equal(exitCode, 1, 'Harus gagal karena berkas sudah ada');
    });
  });

  describe('doctor', () => {
    it('menjalankan audit kesehatan lingkungan pengembang', () => {
      const exitCode = runDoctorCommand();
      assert.equal(typeof exitCode, 'number', 'runDoctorCommand harus mengembalikan exit code angka');
      assert.ok([0, 1].includes(exitCode), 'Exit code harus berupa 0 (sehat) atau 1 (ada isu)');
    });
  });

  describe('check & build', () => {
    it('memeriksa komponen valid dengan kylat check', async () => {
      // tmpDir berisi QuickCounter.kylat.php yang valid
      const exitCode = await runCheckCommand(tmpDir);
      assert.equal(exitCode, 0, 'kylat check pada komponen valid harus menghasilkan exit 0');
    });

    it('mendeteksi galat anatomi pada komponen yang rusak dengan kylat check', async () => {
      const brokenDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kylat-broken-'));
      try {
        const brokenFile = path.join(brokenDir, 'BadName.kylat.php');
        // KIL-215: nama kelas tidak sama dengan nama berkas
        fs.writeFileSync(
          brokenFile,
          `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;
final class DifferentName extends Component {}
?>
<div></div>`,
          'utf-8'
        );

        const exitCode = await runCheckCommand(brokenDir);
        assert.equal(exitCode, 1, 'kylat check harus menghasilkan exit 1 saat ada galat aturan');
      } finally {
        fs.rmSync(brokenDir, { recursive: true, force: true });
      }
    });

    it('mengompilasi komponen single-file dan menghasilkan manifest serta client.js', async () => {
      const outDir = path.join(tmpDir, 'dist');
      const exitCode = await runBuildCommand(tmpDir, { outDir });
      assert.equal(exitCode, 0, 'kylat build harus mengembalikan exit code 0');

      assert.ok(fs.existsSync(path.join(outDir, 'manifest.json')), 'manifest.json harus dibuat');
      assert.ok(fs.existsSync(path.join(outDir, 'client.js')), 'client.js harus dibuat');
      assert.ok(fs.existsSync(path.join(outDir, 'QuickCounter.js')), 'QuickCounter.js modul harus dibuat');

      const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf-8'));
      assert.equal(manifest.version, 1, 'manifest harus memiliki version 1');
      assert.equal(manifest.entry, 'client.js', 'manifest harus menentukan client.js sebagai entry point');
      assert.ok(Array.isArray(manifest.components), 'manifest.components harus berupa array');
      const entry = manifest.components.find((e) => e.name === 'QuickCounter');
      assert.ok(entry, 'manifest.components harus memuat entri QuickCounter');
      assert.equal(entry.output, 'QuickCounter.js');
      assert.equal(entry.sourceMap, 'QuickCounter.js.map', 'manifest harus menunjuk source map');

      const emitted = fs.readFileSync(path.join(outDir, 'QuickCounter.js'), 'utf-8');
      assert.match(emitted, /\/\/# sourceMappingURL=QuickCounter\.js\.map/, 'modul harus menyertakan sourceMappingURL');
      assert.ok(fs.existsSync(path.join(outDir, 'QuickCounter.js.map')), 'file source map harus dibuat');
    });

    it('build produksi menghapus source map', async () => {
      const outDir = path.join(tmpDir, 'dist-prod');
      const exitCode = await runBuildCommand(tmpDir, { outDir, production: true });
      assert.equal(exitCode, 0, 'kylat build --production harus exit 0');

      assert.ok(fs.existsSync(path.join(outDir, 'QuickCounter.js')), 'modul tetap dibuat');
      assert.equal(
        fs.existsSync(path.join(outDir, 'QuickCounter.js.map')),
        false,
        'source map tidak boleh dibuat pada build produksi'
      );

      const emitted = fs.readFileSync(path.join(outDir, 'QuickCounter.js'), 'utf-8');
      assert.doesNotMatch(emitted, /sourceMappingURL/, 'modul produksi tidak boleh menyertakan sourceMappingURL');

      const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf-8'));
      const entry = manifest.components.find((e) => e.name === 'QuickCounter');
      assert.equal(entry.sourceMap, null, 'manifest produksi harus sourceMap null');
    });
  });
});
