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

  it('uji sabotase permanen: membuktikan mutasi terkendali pada output kompilasi wajib memicu AssertionError terhadap golden file', async () => {
    const counterPhpPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.php');
    const counterBladePath = path.resolve(__dirname, '../../../examples/counter-app/counter.blade.php');
    const expectedJsPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.expected.js');

    const phpSource = fs.readFileSync(counterPhpPath, 'utf-8');
    const bladeSource = fs.readFileSync(counterBladePath, 'utf-8');
    const expectedJs = fs.readFileSync(expectedJsPath, 'utf-8');

    const result = await compile(phpSource, 'Counter.php', { template: bladeSource });
    assert.equal(result.success, true);

    const stripBanner = (str) => str.replace(/^\/\*\*[\s\S]*?\*\/\s*/, '').trim().replace(/\r\n/g, '\n');
    const expectedCode = stripBanner(expectedJs);
    const validActualCode = stripBanner(result.code);

    // Baseline: kode aktual yang valid harus 100% sama dengan golden file
    assert.equal(validActualCode, expectedCode, 'Baseline kompilasi harus valid');

    // SABOTASE 1: Mengembalikan bug bindText (memindah binding teks dari el_span_5 ke kontainer el_div_1)
    const sabotagedBindText = validActualCode.replace('bindText(el_span_5', 'bindText(el_div_1');
    assert.notEqual(sabotagedBindText, validActualCode, 'Sabotase 1 harus mengubah kode');
    assert.throws(
      () => {
        assert.equal(sabotagedBindText, expectedCode);
      },
      (err) => {
        assert.ok(err instanceof assert.AssertionError, 'Wajib melempar AssertionError');
        return true;
      },
      'Sabotase bindText salah elemen WAJIB menggagalkan pengujian golden'
    );

    // SABOTASE 2: Menghapus Idempotency-Key per operasi dari pemanggilan aksi
    const sabotagedIdemp = validActualCode.replace('{ idempotencyKey: current_idemp_syncToServer }', '{}');
    assert.notEqual(sabotagedIdemp, validActualCode, 'Sabotase 2 harus mengubah kode');
    assert.throws(
      () => {
        assert.equal(sabotagedIdemp, expectedCode);
      },
      (err) => {
        assert.ok(err instanceof assert.AssertionError, 'Wajib melempar AssertionError');
        return true;
      },
      'Sabotase penghapusan Idempotency-Key WAJIB menggagalkan pengujian golden'
    );

    // SABOTASE 3: Menghapus atribut aria-live untuk pengumuman error
    const sabotagedAriaLive = validActualCode.replace('el_live_error_9.setAttribute("aria-live", "polite");\n  ', '');
    assert.notEqual(sabotagedAriaLive, validActualCode, 'Sabotase 3 harus mengubah kode');
    assert.throws(
      () => {
        assert.equal(sabotagedAriaLive, expectedCode);
      },
      (err) => {
        assert.ok(err instanceof assert.AssertionError, 'Wajib melempar AssertionError');
        return true;
      },
      'Sabotase penghapusan aria-live WAJIB menggagalkan pengujian golden'
    );
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

  it('menghasilkan output yang identik dengan CartCounter.expected.js (Human-Authored Golden File)', async () => {
    const cartCounterPhpPath = path.resolve(__dirname, '../../../examples/counter-app/CartCounter.php');
    const expectedJsPath = path.resolve(__dirname, '../../../examples/counter-app/CartCounter.expected.js');

    const phpSource = fs.readFileSync(cartCounterPhpPath, 'utf-8');
    const expectedJs = fs.readFileSync(expectedJsPath, 'utf-8');
    const result = await compile(phpSource, 'CartCounter.php');
    assert.equal(result.success, true);

    const stripBanner = (str) => str.replace(/^\/\*\*[\s\S]*?\*\/\s*/, '').trim().replace(/\r\n/g, '\n');

    const expectedCode = stripBanner(expectedJs);
    const actualCode = stripBanner(result.code);

    assert.equal(actualCode, expectedCode, 'Output kompilasi CartCounter harus identik persis dengan kode CartCounter.expected.js');
  });

  it('memastikan prop wajib tanpa default melempar TypeError saat diinisialisasi tanpa props', async () => {
    const cartCounterPhpPath = path.resolve(__dirname, '../../../examples/counter-app/CartCounter.php');
    const phpSource = fs.readFileSync(cartCounterPhpPath, 'utf-8');
    const result = await compile(phpSource, 'CartCounter.php');
    assert.equal(result.success, true);

    // Evaluasi fungsi createCartCounter dari output kode
    // Ganti import runtime dengan mock sederhana dan bersihkan export keyword
    const mockModuleCode = result.code
      .replace(/import\s*\{[^}]*\}\s*from\s*['"]@kylat\/runtime['"];?/, `
        const createSignal = (v) => [() => v, () => {}];
        const callServerAction = async () => {};
        const bindText = () => {};
        const document = { createElement: () => ({ setAttribute: () => {}, appendChild: () => {} }) };
      `)
      .replace(/export\s+function/g, 'function')
      .replace(/export\s+default\s+[^;]+;?/g, '');

    const fn = new Function(`${mockModuleCode}; return createCartCounter;`)();

    // 1. Kasus tanpa argumen props -> wajib melempar TypeError
    assert.throws(
      () => {
        fn();
      },
      (err) => {
        assert.ok(err instanceof TypeError);
        assert.ok(err.message.includes("Prop 'productId' wajib disertakan"));
        return true;
      },
      'Inisialisasi tanpa props wajib melempar TypeError'
    );

    // 2. Kasus props kosong {} -> wajib melempar TypeError
    assert.throws(
      () => {
        fn({});
      },
      (err) => {
        assert.ok(err instanceof TypeError);
        assert.ok(err.message.includes("Prop 'productId' wajib disertakan"));
        return true;
      },
      'Inisialisasi dengan props kosong wajib melempar TypeError'
    );

    // 3. Kasus props valid { productId: "prod_123" } -> berhasil tanpa error
    const instance = fn({ productId: 'prod_123' });
    assert.ok(instance, 'Komponen berhasil diinisialisasi ketika prop wajib diberikan');
  });
});
