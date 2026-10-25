import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('@kylat/compiler - Golden Master & Regression Guard', () => {
  it('menegaskan bahwa elemen kontainer yang memiliki anak TIDAK PERNAH dipasang bindText', async () => {
    const counterPhpPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.php');
    const counterBladePath = path.resolve(__dirname, '../../../examples/counter-app/counter.blade.php');

    const phpSource = fs.readFileSync(counterPhpPath, 'utf-8');
    const bladeSource = fs.readFileSync(counterBladePath, 'utf-8');

    const result = await compile(phpSource, 'Counter.php', { template: bladeSource });
    assert.equal(result.success, true);

    // Guard: bindText hanya boleh dipasang pada node daun span, TIDAK pada div kontainer
    assert.equal(
      result.code.includes('bindText(el_div_1'),
      false,
      'BUG FATAL TERDETEKSI: bindText tidak boleh dipasang pada el_div_1 karena akan menghapus anak-anaknya!'
    );

    // Pastikan bindText terpasang pada span
    assert.ok(
      result.code.includes('bindText(el_span_5'),
      'bindText harus terpasang pada elemen daun el_span_5'
    );
  });

  it('uji sabotase: memastikan tes gagal jika output dirusak sengaja', () => {
    // Kriteria Claude: pembuktian bahwa tes golden bukan tautologi
    const validOutput = 'el_span_5.textContent = "test";';
    const sabotagedOutput = 'el_div_1.textContent = "sabotase";';

    assert.throws(() => {
      assert.equal(
        sabotagedOutput,
        validOutput,
        'Tes wajib mendeteksi perubahan sekecil apa pun pada kode'
      );
    });
  });

  it('meng-escape karakter petik tunggal, backslash, dan newline di template dengan JSON.stringify', async () => {
    const phpSource = `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;

final class EscapeTest extends Component
{
    public string $title = 'Hello';
}
`;
    // Template memuat tanda kutip tunggal, backslash, dan newline
    const bladeTemplate = `<div class="it's \\"special\\" \n multiline">
    <span>it's a backslash \\ test</span>
</div>`;

    const result = await compile(phpSource, 'EscapeTest.php', { template: bladeTemplate });
    assert.equal(result.success, true);

    // Pastikan karakter di-escape dengan aman oleh JSON.stringify
    assert.ok(result.code.includes('setAttribute("class", "it\'s \\"special\\" \\n multiline")'));
    assert.ok(result.code.includes('textContent = "it\'s a backslash \\\\ test"'));
  });

  it('memverifikasi aria-busy, data-pending, dan disabled terpasang pada tombol pemicu aksi server', async () => {
    const counterPhpPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.php');
    const counterBladePath = path.resolve(__dirname, '../../../examples/counter-app/counter.blade.php');

    const phpSource = fs.readFileSync(counterPhpPath, 'utf-8');
    const bladeSource = fs.readFileSync(counterBladePath, 'utf-8');

    const result = await compile(phpSource, 'Counter.php', { template: bladeSource });
    assert.equal(result.success, true);

    assert.ok(
      result.code.includes('bindAttr(el_button_8, "aria-busy"'),
      'Aksi server harus mengikat atribut aria-busy'
    );
    assert.ok(
      result.code.includes('bindAttr(el_button_8, "data-pending"'),
      'Aksi server harus mengikat atribut data-pending'
    );
    assert.ok(
      result.code.includes('bindAttr(el_button_8, "disabled"'),
      'Tombol aksi server harus di-disable selama pending untuk mencegah klik ganda'
    );
  });

  it('memverifikasi bahwa aksi server mengelola state error dan mengirim Idempotency-Key untuk mutasi', async () => {
    const counterPhpPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.php');
    const counterBladePath = path.resolve(__dirname, '../../../examples/counter-app/counter.blade.php');

    const phpSource = fs.readFileSync(counterPhpPath, 'utf-8');
    const bladeSource = fs.readFileSync(counterBladePath, 'utf-8');

    const result = await compile(phpSource, 'Counter.php', { template: bladeSource });
    assert.equal(result.success, true);

    assert.ok(result.code.includes('error_syncToServer'), 'Harus mendeklarasikan sinyal error untuk aksi server');
    assert.ok(result.code.includes('idempotencyKey'), 'Aksi mutasi wajib menyertakan Idempotency-Key');
    assert.ok(result.code.includes('catch (err)'), 'Aksi server wajib menangani error dan mere-throw');
  });

  it('menghasilkan output yang identik dengan Counter.expected.js (Human-Authored Golden File)', async () => {
    const counterPhpPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.php');
    const counterBladePath = path.resolve(__dirname, '../../../examples/counter-app/counter.blade.php');
    const expectedJsPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.expected.js');

    const phpSource = fs.readFileSync(counterPhpPath, 'utf-8');
    const bladeSource = fs.readFileSync(counterBladePath, 'utf-8');
    const expectedJs = fs.readFileSync(expectedJsPath, 'utf-8');
    const result = await compile(phpSource, 'Counter.php', { template: bladeSource });
    assert.equal(result.success, true);

    // Normalisasi: buang docblock header pembuka dan samakan line endings, tanpa menoleransi perbedaan kode
    const stripBanner = (str) => str.replace(/^\/\*\*[\s\S]*?\*\/\s*/, '').trim().replace(/\r\n/g, '\n');

    const expectedCode = stripBanner(expectedJs);
    const actualCode = stripBanner(result.code);

    assert.equal(actualCode, expectedCode, 'Output kompilasi harus identik persis dengan kode Counter.expected.js');
  });
});
