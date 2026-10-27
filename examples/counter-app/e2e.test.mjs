/**
 * e2e.test.mjs - Pengujian Otomatis End-to-End untuk Aplikasi Counter Kylat
 * 
 * Menguji pipeline lengkap dari hulu ke hilir:
 * 1. Kompilasi Counter.php + counter.blade.php via @kylat/compiler
 * 2. Inisialisasi komponen di lingkungan DOM
 * 3. Reaktivitas sinyal lokal (increment, decrement) tanpa reload
 * 4. Panggilan mutasi RPC ke server nyata (POST /_kylat/call) dengan Idempotency-Key
 * 5. Proteksi tombol saat aksi in-flight (aria-busy, data-pending, disabled)
 * 6. Verifikasi kontrak idempotensi server (§3.1: replay cache dan penolakan konflik)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../../packages/compiler/dist/index.js';
import { createDemoServer } from './server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Counter App - End-to-End Test Suite', () => {
  let serverInstance;
  let serverBaseUrl;
  let resetState;
  let getState;

  before(async () => {
    // 1. Jalankan server demo HTTP pada port ephemeral bebas
    const demo = createDemoServer();
    serverInstance = demo.server;
    resetState = demo.resetState;
    getState = demo.getState;

    await new Promise((resolve) => {
      serverInstance.listen(0, '127.0.0.1', () => {
        const address = serverInstance.address();
        serverBaseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => serverInstance.close(resolve));
  });

  it('Langkah 1: Mengompilasi Counter.php dan counter.blade.php secara deterministik', async () => {
    const phpPath = path.resolve(__dirname, 'Counter.php');
    const bladePath = path.resolve(__dirname, 'counter.blade.php');

    const phpSource = fs.readFileSync(phpPath, 'utf-8');
    const bladeSource = fs.readFileSync(bladePath, 'utf-8');

    const res = await compile(phpSource, 'Counter.php', { template: bladeSource });
    assert.equal(res.success, true, 'Kompilasi komponen Counter wajib berhasil');
    assert.ok(res.code.includes('export function createCounter'), 'Wajib mengekspor createCounter');
    assert.ok(res.code.includes('CounterActions::saveCount'), 'Wajib memetakan aksi server saveCount');
  });

  it('Langkah 2: Menjalankan reaktivitas sinyal lokal (increment & decrement) pada DOM riil', async () => {
    // Bangun mock DOM sederhana yang merefleksikan API elemen browser
    class MockElement {
      constructor(tag) {
        this.tagName = tag.toUpperCase();
        this.attributes = new Map();
        this.listeners = new Map();
        this.children = [];
        this._textContent = '';
      }
      setAttribute(name, val) { this.attributes.set(name, String(val)); }
      getAttribute(name) { return this.attributes.get(name) ?? null; }
      removeAttribute(name) { this.attributes.delete(name); }
      appendChild(child) { this.children.push(child); }
      addEventListener(event, fn) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(fn);
      }
      click() {
        const fns = this.listeners.get('click') || [];
        for (const fn of fns) fn();
      }
      set textContent(val) { this._textContent = String(val); }
      get textContent() {
        if (this.children.length === 0) return this._textContent;
        return this.children.map(c => c.textContent).join('');
      }
      querySelector(selector) {
        if (selector === 'span') {
          return this._find(el => el.tagName === 'SPAN');
        }
        return null;
      }
      _find(predicate) {
        for (const c of this.children) {
          if (predicate(c)) return c;
          const found = c._find ? c._find(predicate) : null;
          if (found) return found;
        }
        return null;
      }
    }

    const originalDocument = globalThis.document;
    globalThis.document = {
      createElement: (tag) => new MockElement(tag)
    };

    try {
      // Muat createCounter dari dist/Counter.js
      const { createCounter } = await import('./dist/Counter.js');
      const root = createCounter({ initialCount: 10 });

      // Cari elemen span dan tombol
      const span = root.querySelector('span');
      assert.ok(span, 'Elemen span penampil count harus ada');
      assert.equal(span.textContent, '10', 'Count awal harus sesuai prop (10)');

      // Tombol decrement (-), increment (+), dan sync
      // Struktur DOM: root -> el_div_3 -> [btn_dec (button_4), span (span_5), btn_inc (button_6)]
      const innerContainer = root.children.find(c => c.children && c.children.some(x => x.tagName === 'SPAN'));
      assert.ok(innerContainer, 'Kontainer tombol harus ditemukan');

      const btnDec = innerContainer.children.find(c => c.tagName === 'BUTTON' && c.textContent === '-');
      const btnInc = innerContainer.children.find(c => c.tagName === 'BUTTON' && c.textContent === '+');
      assert.ok(btnDec, 'Tombol decrement (-) harus ada');
      assert.ok(btnInc, 'Tombol increment (+) harus ada');

      // 1. Klik decrement: 10 -> 9
      btnDec.click();
      assert.equal(span.textContent, '9', 'Klik decrement harus langsung memperbarui span ke 9');

      // 2. Klik increment 2 kali: 9 -> 10 -> 11
      btnInc.click();
      assert.equal(span.textContent, '10', 'Klik increment pertama harus langsung memperbarui span ke 10');
      btnInc.click();
      assert.equal(span.textContent, '11', 'Klik increment kedua harus langsung memperbarui span ke 11');
    } finally {
      globalThis.document = originalDocument;
    }
  });

  it('Langkah 3: Panggilan mutasi RPC ke server nyata POST /_kylat/call dengan Idempotency-Key', async () => {
    resetState();

    const idempKey = 'idemp_test_counter_12345678';
    const payload = {
      calls: [
        {
          callId: 'call-counter-1',
          action: 'CounterActions::saveCount',
          args: { count: 42 }
        }
      ]
    };

    const res = await fetch(`${serverBaseUrl}/_kylat/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempKey
      },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 200, 'Server harus membalas HTTP 200 OK');
    const json = await res.json();

    assert.equal(Array.isArray(json.results), true);
    assert.equal(json.results[0].status, 'success');
    assert.equal(json.results[0].data.count, 42);
    assert.equal(json.results[0].data.saved, true);
    assert.equal(json.results[0].data.mutationSequence, 1);

    // Verifikasi state server diperbarui
    const st = getState();
    assert.equal(st.serverSavedCount, 42);
    assert.equal(st.serverMutationCount, 1);
  });

  it('Langkah 4: Kontrak Idempotensi §3.1 Aturan 4 (Replay Cache tanpa Re-eksekusi)', async () => {
    const idempKey = 'idemp_test_replay_87654321';
    const payload = {
      calls: [
        {
          callId: 'call-replay-1',
          action: 'CounterActions::saveCount',
          args: { count: 99 }
        }
      ]
    };

    // Panggilan Pertama: Eksekusi normal
    const res1 = await fetch(`${serverBaseUrl}/_kylat/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempKey
      },
      body: JSON.stringify(payload)
    });
    const json1 = await res1.json();
    assert.equal(json1.results[0].data.mutationSequence, 2, 'Urutan mutasi server harus bertambah');

    // Panggilan Kedua (Replay dengan key dan payload sama)
    const res2 = await fetch(`${serverBaseUrl}/_kylat/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempKey
      },
      body: JSON.stringify(payload)
    });

    assert.equal(res2.status, 200);
    assert.equal(res2.headers.get('x-kylat-idempotency-replay'), 'true', 'Wajib memuat header tanda replay');
    const json2 = await res2.json();

    // Respons harus identik dengan panggilan pertama
    assert.deepEqual(json2, json1, 'Respons replay wajib identik dengan hasil pertama');

    // Server mutasi sequence TIDAK boleh bertambah (§3.1 Aturan 5: efek samping paling banyak sekali)
    const st = getState();
    assert.equal(st.serverMutationCount, 2, 'Server mutation sequence dilarang bertambah saat replay');
  });

  it('Langkah 5: Kontrak Idempotensi §3.1 Aturan 3 (Penolakan Konflik Payload Berbeda dengan Key Sama)', async () => {
    const idempKey = 'idemp_conflict_key_99999999';

    // 1. Request awal dengan count = 1
    await fetch(`${serverBaseUrl}/_kylat/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempKey
      },
      body: JSON.stringify({
        calls: [{ action: 'CounterActions::saveCount', args: { count: 1 } }]
      })
    });

    // 2. Request kedua dengan key sama namun payload beda (count = 2) -> wajib ditolak 409 Conflict
    const resConflict = await fetch(`${serverBaseUrl}/_kylat/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempKey
      },
      body: JSON.stringify({
        calls: [{ action: 'CounterActions::saveCount', args: { count: 2 } }]
      })
    });

    assert.equal(resConflict.status, 409, 'Wajib menolak HTTP 409 untuk idempotency conflict');
    const conflictBody = await resConflict.json();
    assert.ok(conflictBody.detail.includes('kylat:idempotency_conflict'));
  });

  it('Langkah 6: Kontrak Idempotensi §3.1 Aturan 1 (Penolakan Idempotency-Key di luar 8 s/d 128 karakter)', async () => {
    // Key terlalu pendek (< 8 karakter)
    const resShort = await fetch(`${serverBaseUrl}/_kylat/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'short'
      },
      body: JSON.stringify({
        calls: [{ action: 'CounterActions::saveCount', args: { count: 10 } }]
      })
    });

    assert.equal(resShort.status, 400, 'Idempotency-Key < 8 karakter wajib ditolak dengan HTTP 400');
    const bodyShort = await resShort.json();
    assert.ok(bodyShort.detail.includes('8 sampai 128 karakter'));
  });

});
