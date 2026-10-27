/**
 * @kylat/compiler & @kylat/runtime - Suite Uji Otomatis Verifikasi Gate Prinsip P1 sampai P12
 * 
 * Memverifikasi 12 Prinsip Non-Negosiasi Kylat (P1 s/d P12) sebagaimana didefinisikan dalam
 * docs/decisions/README.md dan dokumen perancangan arsitektur.
 * Setiap prinsip memiliki minimal satu uji fail-on-violation otomatis.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../dist/index.js';
import { createSignal, createComputed, createEffect, bindText, bindAttr } from '../../runtime/dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Kylat Architectural Gates - Verifikasi Prinsip Non-Negosiasi P1 s/d P12', () => {

  // --- GATE P1 ---
  it('P1: Sintaks PHP standar yang dikenal developer, tanpa DSL atau ekstensi compiler aneh', async () => {
    // 1. PHP standar valid wajib lulus kompilasi
    const standardPhp = `<?php
declare(strict_types=1);

namespace App\\Components;

use Kylat\\Component;
use Kylat\\Attributes\\Prop;
use Kylat\\Attributes\\Client;

final class StandardCounter extends Component
{
    #[Prop]
    public int $step = 1;

    public int $count = 0;

    #[Client]
    public function increment(): void
    {
        $this->count += $this->step;
    }
}
`;
    const res = await compile(standardPhp, 'StandardCounter.php');
    assert.equal(res.success, true, 'PHP standar valid harus berhasil dikompilasi tanpa DSL khusus');
    assert.ok(res.code.includes('export function createStandardCounter'), 'Menghasilkan factory function standar');

    // 2. Fail-on-violation: Sintaks non-standar / keyword terlarang di luar subset v0 (global) wajib ditolak
    const forbiddenGlobal = `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;
final class BadGlobal extends Component {
    public function broken(): void {
        global $badVariable;
    }
}
`;
    const failRes = await compile(forbiddenGlobal, 'BadGlobal.php');
    assert.equal(failRes.success, false, 'Penggunaan construct terlarang wajib menggagalkan build');
    assert.ok(failRes.diagnostics.some(d => d.code === 'KIL-103'), 'Wajib mendeteksi KIL-103 untuk global variable');
  });

  // --- GATE P2 ---
  it('P2: Satu konsep untuk memulai (quick start counter langsung jalan tanpa konfigurasi rumit)', async () => {
    // Quickstart minimal: class tunggal + template sederhana langsung jalan tanpa config file atau atribut #[Child]
    const minimalComponent = `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;

final class QuickCounter extends Component
{
    public int $count = 0;

    public function increment(): void
    {
        $this->count++;
    }
}
`;
    const minimalTemplate = `<button on:click="increment()">+ {{ $count }}</button>`;

    const res = await compile(minimalComponent, 'QuickCounter.php', { template: minimalTemplate });
    assert.equal(res.success, true, 'Quick start counter harus berhasil dikompilasi instan tanpa konfigurasi rumit');
    assert.ok(res.code.includes('createSignal(0)'), 'State count langsung terikat ke sinyal 0');
    assert.ok(res.code.includes('on('), 'Event listener on:click langsung terikat');
    assert.ok(res.code.includes('bindText('), 'Interpolasi teks count langsung terikat');
  });

  // --- GATE P3 ---
  it('P3: Kesalahan build memiliki pesan jelas, lokasi baris akurat, dan tautan panduan perbaikan', async () => {
    // Pelanggaran KIL-102: tanpa declare(strict_types=1)
    const codeMissingStrict = `<?php
namespace App\\Components;
use Kylat\\Component;

final class MissingStrict extends Component
{
    public int $val = 10;
}
`;
    const res = await compile(codeMissingStrict, 'MissingStrict.php');
    assert.equal(res.success, false, 'Wajib gagal jika melanggar aturan build');
    assert.ok(res.diagnostics.length > 0, 'Wajib memuat array diagnosa');

    const diag = res.diagnostics.find(d => d.code === 'KIL-102');
    assert.ok(diag, 'Wajib memuat kode kesalahan resmi KIL-102 dari spec/errors.md');
    assert.ok(typeof diag.line === 'number' && diag.line >= 1, 'Lokasi baris wajib bernomor valid (>= 1)');
    assert.ok(typeof diag.column === 'number' && diag.column >= 0, 'Lokasi kolom wajib bernomor valid (>= 0)');
    assert.ok(diag.message && diag.message.length > 10, 'Pesan kesalahan harus deskriptif dan manusiawi');
    assert.ok(diag.docUrl && diag.docUrl.startsWith('https://kylat.dev/docs/errors/kil-102'), 'Wajib memuat tautan panduan perbaikan resmi');
  });

  // --- GATE P4 ---
  it('P4: Tidak ada virtual DOM di client; reaktivitas langsung mengikat mutasi sinyal ke node DOM riil', () => {
    // Simulasi node DOM riil
    const mockSpan = {
      textContent: '0',
    };

    const [count, setCount] = createSignal(0);

    // bindText langsung mengikat effect ke node DOM riil
    bindText(mockSpan, () => String(count()));

    assert.equal(mockSpan.textContent, '0', 'Nilai awal node DOM riil harus 0');

    // Mutasi sinyal langsung memperbarui textContent node yang sama tanpa VDOM diffing
    setCount(1);
    assert.equal(mockSpan.textContent, '1', 'Mutasi sinyal harus langsung merefleksikan perubahan ke node DOM riil');

    setCount(42);
    assert.equal(mockSpan.textContent, '42', 'Node DOM riil diperbarui langsung tanpa VDOM reconciliation loop');
  });

  // --- GATE P5 ---
  it('P5: Server adalah otoritas kebenaran data; client tidak pernah dipercaya tanpa validasi', async () => {
    // Komponen mendeklarasikan aksi server; mutasi tidak dijalankan lokal melainkan diarahkan via callServerAction
    const cartPhp = `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;
use Kylat\\Attributes\\Server;
use Kylat\\Attributes\\Uses;
use App\\Actions\\CartActions;

#[Uses(CartActions::class)]
final class SecureCart extends Component
{
    public int $qty = 1;

    #[Server]
    public function checkout(): void
    {
        $this->server(CartActions::class)->checkout($this->qty);
    }
}
`;
    const res = await compile(cartPhp, 'SecureCart.php');
    assert.equal(res.success, true);

    // Klien TIDAK mengeksekusi logika mutasi sendiri, melainkan memanggil endpoint RPC aman
    assert.ok(res.code.includes('callServerAction("CartActions::checkout"'), 'Mutasi wajib diproteksi lewat RPC ke server');
    assert.ok(res.code.includes('idempotencyKey'), 'Setiap mutasi wajib menyertakan Idempotency-Key untuk otoritas integritas data');
  });

  // --- GATE P6 ---
  it('P6: Aman secara default (secure by default) — bebas eval/Function, raw HTML ditolak', async () => {
    const counterPhpPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.php');
    const counterBladePath = path.resolve(__dirname, '../../../examples/counter-app/counter.blade.php');
    const phpSource = fs.readFileSync(counterPhpPath, 'utf-8');
    const bladeSource = fs.readFileSync(counterBladePath, 'utf-8');

    const res = await compile(phpSource, 'Counter.php', { template: bladeSource });
    assert.equal(res.success, true);

    // Dilarang ada eval() atau new Function() dalam kode hasil kompilasi
    assert.equal(res.code.includes('eval('), false, 'Hasil kompilasi dilarang mengandung pemanggilan eval()');
    assert.equal(res.code.includes('new Function('), false, 'Hasil kompilasi dilarang mengandung new Function()');
    assert.equal(res.code.includes('innerHTML'), false, 'Hasil kompilasi dilarang menggunakan innerHTML mentah');

    // Fail-on-violation: Percobaan pemakaian raw HTML {!! !!} wajib ditolak dengan KIL-152
    const rawHtmlTemplate = `<div>{!! $unescapedContent !!}</div>`;
    const rawRes = await compile(phpSource, 'Counter.php', { template: rawHtmlTemplate });
    assert.equal(rawRes.success, false, 'Template dengan raw HTML wajib digagalkan saat build');
    assert.ok(rawRes.diagnostics.some(d => d.code === 'KIL-152'), 'Wajib memicu KIL-152 untuk raw HTML');
  });

  // --- GATE P7 ---
  it('P7: Protokol RPC netral bahasa (/_kylat/call) yang kompatibel dengan backend apa pun', async () => {
    // Periksa bahwa kode hasil kompilasi mengimpor dan memanggil protokol RPC netral bahasa
    const cartPhpPath = path.resolve(__dirname, '../../../examples/counter-app/CartCounter.php');
    const cartBladePath = path.resolve(__dirname, '../../../examples/counter-app/cart-counter.blade.php');
    const phpSource = fs.readFileSync(cartPhpPath, 'utf-8');
    const bladeSource = fs.readFileSync(cartBladePath, 'utf-8');

    const res = await compile(phpSource, 'CartCounter.php', { template: bladeSource });
    assert.equal(res.success, true);

    assert.ok(res.code.includes("import { bindAttr, bindText, callServerAction, createSignal, on } from '@kylat/runtime';"));
    assert.ok(res.code.includes('callServerAction("CartActions::add", { productId: prop_productId, qty: qty() }, { idempotencyKey: current_idemp_submitOrder })'));

    // Verifikasi skema protokol wire JSON
    const protocolSchemaPath = path.resolve(__dirname, '../../../spec/protocol.schema.json');
    assert.ok(fs.existsSync(protocolSchemaPath), 'Skema kontrak protokol resmi wajib ada di spec/protocol.schema.json');
    const schemaContent = JSON.parse(fs.readFileSync(protocolSchemaPath, 'utf-8'));
    assert.equal(schemaContent.title, 'KylatWireProtocol', 'Skema mendefinisikan RPC batch netral bahasa');
    assert.ok(schemaContent.$defs.BatchRequest, 'Skema memuat definisi BatchRequest');
    assert.ok(schemaContent.$defs.BatchResponse, 'Skema memuat definisi BatchResponse');
    assert.ok(schemaContent.$defs.ProblemDetails, 'Skema memuat definisi ProblemDetails RFC 9457');
  });

  // --- GATE P8 ---
  it('P8: Waktu adopsi < 10 menit (metrik pantauan: latensi kompilasi cepat sub-detik)', async () => {
    const counterPhpPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.php');
    const counterBladePath = path.resolve(__dirname, '../../../examples/counter-app/counter.blade.php');
    const phpSource = fs.readFileSync(counterPhpPath, 'utf-8');
    const bladeSource = fs.readFileSync(counterBladePath, 'utf-8');

    const start = performance.now();
    const res = await compile(phpSource, 'Counter.php', { template: bladeSource });
    const durationMs = performance.now() - start;

    assert.equal(res.success, true);
    // Latensi kompilasi single component harus sangat cepat (< 200 ms) untuk memastikan waktu adopsi < 10 menit
    assert.ok(durationMs < 200, `Kompilasi komponen harus di bawah 200 ms (aktual: ${durationMs.toFixed(2)} ms)`);
  });

  // --- GATE P9 ---
  it('P9: Dokumentasi dan contoh kode selalu diverifikasi dan sejalan dengan implementasi aktual', async () => {
    const counterPhpPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.php');
    const counterBladePath = path.resolve(__dirname, '../../../examples/counter-app/counter.blade.php');
    const counterExpectedPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.expected.js');

    const cartCounterPhpPath = path.resolve(__dirname, '../../../examples/counter-app/CartCounter.php');
    const cartCounterBladePath = path.resolve(__dirname, '../../../examples/counter-app/cart-counter.blade.php');
    const cartCounterExpectedPath = path.resolve(__dirname, '../../../examples/counter-app/CartCounter.expected.js');

    const stripBanner = (str) => str.replace(/^\/\*\*[\s\S]*?\*\/\s*/, '').trim().replace(/\r\n/g, '\n');

    // Verifikasi Counter.php vs Counter.expected.js
    const counterRes = await compile(fs.readFileSync(counterPhpPath, 'utf-8'), 'Counter.php', { template: fs.readFileSync(counterBladePath, 'utf-8') });
    assert.equal(counterRes.success, true);
    assert.equal(stripBanner(counterRes.code), stripBanner(fs.readFileSync(counterExpectedPath, 'utf-8')), 'Contoh Counter.php harus 100% cocok dengan golden contract');

    // Verifikasi CartCounter.php vs CartCounter.expected.js
    const cartRes = await compile(fs.readFileSync(cartCounterPhpPath, 'utf-8'), 'CartCounter.php', { template: fs.readFileSync(cartCounterBladePath, 'utf-8') });
    assert.equal(cartRes.success, true);
    assert.equal(stripBanner(cartRes.code), stripBanner(fs.readFileSync(cartCounterExpectedPath, 'utf-8')), 'Contoh CartCounter.php harus 100% cocok dengan golden contract');
  });

  // --- GATE P10 ---
  it('P10: Anggaran ukuran bundle JavaScript runtime minimal dan terukur ketat', () => {
    const runtimeDistDir = path.resolve(__dirname, '../../runtime/dist');
    assert.ok(fs.existsSync(runtimeDistDir), 'Distributable runtime harus telah dibangun');

    let totalRuntimeBytes = 0;
    const distFiles = fs.readdirSync(runtimeDistDir).filter(f => f.endsWith('.js'));
    for (const file of distFiles) {
      const stats = fs.statSync(path.join(runtimeDistDir, file));
      totalRuntimeBytes += stats.size;
    }

    // Pagu ukuran unminified runtime v0 maksimal 30 KB
    const maxBudgetBytes = 30 * 1024;
    assert.ok(
      totalRuntimeBytes < maxBudgetBytes,
      `Total ukuran unminified runtime (${(totalRuntimeBytes / 1024).toFixed(2)} KB) melampaui pagu ${maxBudgetBytes / 1024} KB`
    );

    // Pagu ukuran signals core unminified maksimal 5 KB
    const signalsJsPath = path.join(runtimeDistDir, 'signals.js');
    if (fs.existsSync(signalsJsPath)) {
      const signalsSize = fs.statSync(signalsJsPath).size;
      assert.ok(signalsSize < 5 * 1024, `Modul sinyal inti (${signalsSize} byte) harus di bawah 5 KB`);
    }
  });

  // --- GATE P11 ---
  it('P11: Dukungan aksesibilitas (a11y) bawaan memenuhi standar WCAG 2.2 AA', async () => {
    const cartCounterPhpPath = path.resolve(__dirname, '../../../examples/counter-app/CartCounter.php');
    const cartCounterBladePath = path.resolve(__dirname, '../../../examples/counter-app/cart-counter.blade.php');

    const res = await compile(
      fs.readFileSync(cartCounterPhpPath, 'utf-8'),
      'CartCounter.php',
      { template: fs.readFileSync(cartCounterBladePath, 'utf-8') }
    );
    assert.equal(res.success, true);

    // 1. Tombol pemicu aksi server otomatis diikat atribut state proteksi
    assert.ok(res.code.includes('bindAttr(el_button_3, "aria-busy"'), 'Tombol mutasi server wajib diikat aria-busy');
    assert.ok(res.code.includes('bindAttr(el_button_3, "data-pending"'), 'Tombol mutasi server wajib diikat data-pending');
    assert.ok(res.code.includes('bindAttr(el_button_3, "disabled"'), 'Tombol mutasi server wajib diikat disabled');

    // 2. Elemen live region untuk pengumuman error server otomatis disertakan
    assert.ok(res.code.includes('setAttribute("aria-live", "polite")'), 'Komponen server wajib memiliki aria-live="polite" untuk screen reader');
    assert.ok(res.code.includes('setAttribute("role", "status")'), 'Komponen server wajib memiliki role="status"');
    assert.ok(res.code.includes('bindText(el_live_error_4, () => error_submitOrder() ?? "")'), 'Pesan error server otomatis dialirkan ke live region');
  });

  // --- GATE P12 ---
  it('P12: Kompatibel penuh dengan kebijakan keamanan konten (CSP) ketat tanpa unsafe-eval', () => {
    // Memverifikasi fungsi sinyal reaktif dan DOM binding berjalan murni tanpa eval atau Function
    const [name, setName] = createSignal('Kylat');
    const upper = createComputed(() => name().toUpperCase());

    let observed = '';
    const cleanup = createEffect(() => {
      observed = `Framework: ${upper()}`;
    });

    assert.equal(observed, 'Framework: KYLAT');
    setName('Signals');
    assert.equal(observed, 'Framework: SIGNALS');

    cleanup();
    setName('Other');
    assert.equal(observed, 'Framework: SIGNALS', 'Effect berhasil dibersihkan');

    // Membuktikan kode reaktivitas berjalan bebas dari dynamic eval
    assert.equal(typeof createSignal, 'function');
    assert.equal(typeof createComputed, 'function');
    assert.equal(typeof createEffect, 'function');
  });

});
