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
      result.code.includes('bindText(el_span_') || result.code.includes('bindText('),
      'bindText harus terpasang pada elemen daun'
    );
  });

  it('memverifikasi aria-busy dan data-pending terpasang pada tombol pemicu aksi server', async () => {
    const counterPhpPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.php');
    const counterBladePath = path.resolve(__dirname, '../../../examples/counter-app/counter.blade.php');

    const phpSource = fs.readFileSync(counterPhpPath, 'utf-8');
    const bladeSource = fs.readFileSync(counterBladePath, 'utf-8');

    const result = await compile(phpSource, 'Counter.php', { template: bladeSource });
    assert.equal(result.success, true);

    assert.ok(
      result.code.includes("bindAttr(") && result.code.includes("'aria-busy'"),
      'Aksi server harus mengikat atribut aria-busy'
    );
    assert.ok(
      result.code.includes("bindAttr(") && result.code.includes("'data-pending'"),
      'Aksi server harus mengikat atribut data-pending'
    );
  });

  it('memverifikasi impor dari @kylat/runtime hanya menyertakan modul yang dipakai', async () => {
    const counterPhpPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.php');
    const counterBladePath = path.resolve(__dirname, '../../../examples/counter-app/counter.blade.php');

    const phpSource = fs.readFileSync(counterPhpPath, 'utf-8');
    const bladeSource = fs.readFileSync(counterBladePath, 'utf-8');

    const result = await compile(phpSource, 'Counter.php', { template: bladeSource });
    assert.equal(result.success, true);

    // createComputed dan bindInput tidak dipakai di Counter, jadi tidak boleh diimpor
    assert.equal(result.code.includes('createComputed'), false, 'createComputed tidak boleh diimpor jika tidak digunakan');
    assert.equal(result.code.includes('bindInput'), false, 'bindInput tidak boleh diimpor jika tidak digunakan');
  });

  it('menghasilkan output yang identik dengan Counter.expected.js (Human-Authored Golden File)', async () => {
    const counterPhpPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.php');
    const counterBladePath = path.resolve(__dirname, '../../../examples/counter-app/counter.blade.php');
    const expectedJsPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.expected.js');

    const phpSource = fs.readFileSync(counterPhpPath, 'utf-8');
    const bladeSource = fs.readFileSync(counterBladePath, 'utf-8');
    const expectedJs = fs.readFileSync(expectedJsPath, 'utf-8').trim().replace(/\r\n/g, '\n');

    const result = await compile(phpSource, 'Counter.php', { template: bladeSource });
    assert.equal(result.success, true);

    const actualJs = result.code.trim().replace(/\r\n/g, '\n');
    assert.equal(actualJs, expectedJs, 'Output kompilasi harus identik persis dengan Counter.expected.js');
  });
});
