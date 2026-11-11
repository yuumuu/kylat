# STATUS — Kylat

Diperbarui: 11 November 2026. Sumber kebenaran: `spec/` di repo. File ini ringkasan operasional, bukan spesifikasi.

## Status Gerbang Rilis
- **Status Fase 0**: **DITUTUP pada 10 November 2026** (Tag: `v0.0.0-p0`, commit `819bcb4`)
- **Status Fase 1**: **DITUTUP pada 11 November 2026** (Tag: `v0.1.0-p1`)
- **Pengesahan Golden Master**: `CartCounter.expected.js` telah DISAHKAN oleh pemilik proyek pada 10 November 2026.
- **Keputusan Arsitektur Terkait**:
  - ADR 0006: Disetujui untuk Fase 1 (Opsi A: accessor getter).
  - ADR 0007: Ditunda ke Fase 3 (rujukan transaksi database outbox).
  - ADR 0008: Disetujui (KIL-130, 203..205 ditunda ke v0.1; KIL-150 didaftarkan dan dipisahkan dari KIL-151).
  - ADR 0009: **Tetap berstatus USULAN** (Spike S2 alien-signals v3.2.1; syarat uji mobile/JSC dan perangkat fisik belum terpenuhi).

---

## Aturan Proses Rilis & Integritas Main

Mulai penutupan Fase 1, aturan perlindungan branch `main` ditegakkan secara ketat:
- **Semua perubahan ke `main` wajib melalui Pull Request (PR)**: Push langsung ke branch `main` dilarang.
- **Wajib Status Checks CI Hijau**: Seluruh matrix job `Verify Toolchain` (Node 20/22 dan PHP 8.2/8.3) wajib lulus 100% sebelum PR dapat digabungkan (*merged*).
- **Tidak Ada Pengecualian Admin (*No Bypass*)**: Aturan `enforce_admins` diaktifkan (`enforce_admins: true`). Administrator sekalipun tidak dapat mem-bypass branch protection atau mem-push langsung ke `main`.
- **Catatan Pengecualian Riwayat**: Penutupan Fase 1 pada commit `8dd2377` di-push langsung ke `main` menggunakan hak bypass admin pada 11 November 2026. Hal ini dicatat secara resmi sebagai pengecualian satu kali (*one-time exception*) sebelum penegakan proteksi tanpa bypass diaktifkan.

---

## Ringkasan Penutupan Fase 1

Fase 1 (Runtime & Reaktivitas Lanjutan) resmi ditutup pada 11 November 2026. Empat tugas utama Fase 1 telah tuntas dengan rincian hash commit:

1. **Tugas 1 (KEP-35: Reaktivitas Prop Anak)**:
   - `18240d5`: `feat(compiler): dukung reaktivitas prop anak via accessor getter sesuai KEP-35`
   - `773aca3`: `test(compiler): tambah tes penolakan prop bertipe closure dengan KIL-110`
2. **Tugas 2 (Spike S2: Evaluasi Inti Signals & Usulan ADR 0009)**:
   - `d94c436` & `01f4780`: `docs(decisions): tulis dan perbarui usulan ADR 0009 evaluasi inti signals (Spike S2)`
   - `539be3c`: `bench(spikes): perbarui harness Spike S2 perbandingan alien-signals dan @solidjs/signals`
3. **Tugas 3 (Anggaran Ukuran Runtime / P10)**:
   - `d1dcf71`: `test(runtime): tetapkan batas anggaran ukuran runtime (P10) dan tes penegakan gzip`
4. **Tugas 4 (Semantik ARIA / P11)**:
   - `c6aa2de`: `test(runtime): tambah pengujian semantik bindAttr untuk atribut aria (P11)`

### Daftar Batasan "Belum Terbukti"
Meskipun Fase 1 ditutup dan seluruh uji CI lulus 100%, hal-hal berikut secara eksplisit dicatat **belum terbukti**:
- **Safari iOS**: Belum diuji pada Safari iOS fisik (iPhone/iPad). Pengujian WebKit baru mencakup WebKit desktop Playwright.
- **JavaScriptCore fisik**: Belum diuji pada engine JavaScriptCore di atas perangkat keras fisik Apple.
- **Perangkat low-end**: Karakteristik memori dan garbage collection `alien-signals` belum diuji pada perangkat mobile berspesifikasi rendah (*low-end device*).
- **Screen reader**: Kepatuhan aksesibilitas baru sebatas validasi semantik atribut ARIA pada level DOM (`bindAttr`), belum diuji interaktif langsung dengan teknologi pembaca layar (*screen reader* seperti VoiceOver, NVDA, atau TalkBack).

---

## Ringkasan Progres

Fase 0 dan Fase 1 resmi ditutup. Baseline toolchain mencakup compiler, runtime sinyal, CLI, contoh referensi (`01-counter` SFC dan `04-cart` server action), serta adapter Laravel yang seluruhnya diverifikasi 100% lulus CI di Node 20/22 dan PHP 8.2/8.3.

## Repo

- `origin/main` sinkron dengan commit lokal.
- Branch `main` bersih, tanpa penumpukan perubahan working tree.
- Tag rilis Fase 0: `v0.0.0-p0`.
- Tag rilis Fase 1: `v0.1.0-p1`.

## Komponen yang Berjalan dan Terverifikasi

- **Parser PHP**: Subset PHP via `web-tree-sitter` WASM (Spike S1).
- **Format Komponen**: Single-file `*.kylat.php` (KEP-34) dengan validasi KIL-214, 215, 216.
- **Template Engine**: Teks, interpolasi `{{ }}`, `@if/@elseif/@else`, `@foreach/@empty`, `key`, `on:click`, `bind:value`, `bind:checked`, atribut dinamis `:attr`, tag komponen anak `<x-nama>` dengan `#[Child]`, reaktivitas prop anak via accessor getter (KEP-35).
- **Taksonomi Galat**: 33 kode terdaftar di `spec/errors.md`; 27 kode aktif ditegakkan di `@kylat/compiler` (termasuk KIL-110 penolakan closure prop, pemisahan KIL-150 markup tak seimbang dan KIL-151 direktif tak didukung).
- **Codegen Langsung & Sinyal**: DOM codegen langsung + signals (`alien-signals` v3.2.1), keyed list reconciler, sanitasi skema URL & penegakan atribut ARIA (`bindAttr`).
- **Anggaran Runtime (P10)**: Runtime monolitik gzipped < 4 KB, chunk terkompilasi < 8 KB.
- **RPC Protokol**: Batch microtask client dispatcher dengan retry transient/in-progress, timeout, CSRF token, idempotency key unik (`createIdempotencyKey`).
- **Adapter Laravel**: Registry-only, method wajib `#[Server]`, otorisasi `authorize()` default-deny, kontrol batas body/batch/depth, Problem Details RFC 9457, proteksi race-condition idempotensi 24 jam.
- **CLI Toolchain**: `make:component`, `check`, `build` (manifest builder), `doctor`.
- **Contoh Aplikasi Referensi**:
  - `examples/01-counter/`: Komponen Single-File resmi (`Counter.kylat.php`), server demo, uji E2E Node, dan uji WebKit Playwright.
  - `examples/04-cart/`: Komponen referensi pemanggilan server action RPC (`CartActions::add`) dengan otorisasi dan prop `productId`.

---

## Backlog Fase Berikutnya

### Fase 2: CLI & Developer Experience
1. **Source Map Generik**: Pemetaan presisi baris error templat single-file ke baris editor pengguna.
2. **Diagnostik & Autocomplete**: Peningkatan CLI `check` dan integrasi LSP / skema.

### Fase 3: Produksi & Adapter Riil
1. **Idempotensi Database Outbox (ADR 0007)**: Migrasi tabel database dan transactional outbox untuk menggantikan cache interim.
2. **Uji Konkurensi Database Riil**: Pengujian konkurensi tingkat tinggi dengan MySQL/PostgreSQL/Redis nyata.
3. **Reset State Octane/FrankenPHP**: Penanganan siklus hidup worker long-running pada `IdempotencyStore`.

### Fase 4: Optimasi & Produksi Skala Penuh
1. **Pengujian Fisik & Mobile**: Pengujian Safari iOS fisik, JSC, dan perangkat low-end untuk evaluasi final ADR 0009.
2. **Audit Aksesibilitas Nyata**: Pengujian langsung dengan screen reader (VoiceOver, NVDA).
3. **Prerender & SSR**: Evaluasi rendering server untuk kecepatan muat awal.

### Fase 5: Dokumentasi, Ekosistem & Adopsi
1. **Target Waktu Adopsi 10 Menit (P8)**: Pengujian waktu dari instalasi hingga komponen pertama berfungsi.
