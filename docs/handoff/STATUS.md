# STATUS — Kylat

Diperbarui: 10 November 2026. Sumber kebenaran: `spec/` di repo. File ini ringkasan operasional, bukan spesifikasi.

## Status Gerbang Rilis
- **Status Fase 0**: **DITUTUP pada 10 November 2026**
- **Tag Rilis**: `v0.0.0-p0`
- **Pengesahan Golden Master**: `CartCounter.expected.js` telah DISAHKAN oleh pemilik proyek pada 10 November 2026.
- **Keputusan Arsitektur Terkait**:
  - ADR 0006: Disetujui untuk Fase 1 (Opsi A: accessor getter).
  - ADR 0007: Ditunda ke Fase 3 (rujukan transaksi database outbox).
  - ADR 0008: Disetujui (KIL-130, 203..205 ditunda ke v0.1; KIL-150 didaftarkan dan dipisahkan dari KIL-151).

---

## Ringkasan Progres

Fase 0 resmi ditutup. Baseline toolchain mencakup compiler, runtime sinyal, CLI, contoh referensi (`01-counter` SFC dan `04-cart` server action), serta adapter Laravel yang seluruhnya diverifikasi 100% lulus CI di Node 20/22 dan PHP 8.2/8.3.

## Repo

- `origin/main` sinkron dengan commit lokal.
- Branch `main` bersih, tanpa penumpukan perubahan working tree.
- Tag rilis Fase 0: `v0.0.0-p0`.

## Komponen yang Berjalan dan Terverifikasi

- **Parser PHP**: Subset PHP via `web-tree-sitter` WASM (Spike S1).
- **Format Komponen**: Single-file `*.kylat.php` (KEP-34) dengan validasi KIL-214, 215, 216.
- **Template Engine**: Teks, interpolasi `{{ }}`, `@if/@elseif/@else`, `@foreach/@empty`, `key`, `on:click`, `bind:value`, `bind:checked`, atribut dinamis `:attr`, tag komponen anak `<x-nama>` dengan `#[Child]`.
- **Taksonomi Galat**: 33 kode terdaftar di `spec/errors.md`; 27 kode aktif ditegakkan di `@kylat/compiler` (termasuk pemisahan KIL-150 untuk sintaks markup tak seimbang dan KIL-151 untuk direktif Blade tak didukung). KIL-130, 203..205 berstatus ditunda ke v0.1.
- **Codegen Langsung & Sinyal**: DOM codegen langsung + signals (`alien-signals`), keyed list reconciler, sanitasi skema URL (`bindAttr`).
- **RPC Protokol**: Batch microtask client dispatcher dengan retry transient/in-progress, timeout, CSRF token, idempotency key unik (`createIdempotencyKey`).
- **Adapter Laravel**: Registry-only, method wajib `#[Server]`, otorisasi `authorize()` default-deny, kontrol batas body/batch/depth, Problem Details RFC 9457, proteksi race-condition idempotensi 24 jam.
- **CLI Toolchain**: `make:component`, `check`, `build` (manifest builder), `doctor`.
- **Contoh Aplikasi Referensi**:
  - `examples/01-counter/`: Komponen Single-File resmi (`Counter.kylat.php`), server demo, dan uji E2E integrasi penuh.
  - `examples/04-cart/`: Komponen referensi pemanggilan server action RPC (`CartActions::add`) dengan otorisasi dan prop `productId`.

---

## Backlog Fase Berikutnya

### Fase 1: Runtime & Reaktivitas Lanjutan
1. **Reaktivitas Prop Anak (ADR 0006)**: Implementasi sinyal accessor getter untuk `<x-child :prop="$state">` tanpa memutus rantai reaktivitas granular.
2. **Koneksi State & Multi-komponen**: Validasi hierarki dan passing state antar pulau interaktif.

### Fase 2: CLI & Developer Experience
1. **Source Map Generik**: Pemetaan presisi baris error templat single-file ke baris editor pengguna.
2. **Diagnostik & Autocomplete**: Peningkatan CLI `check` dan integrasi LSP / skema.

### Fase 3: Produksi & Adapter Riil
1. **Idempotensi Database Outbox (ADR 0007)**: Migrasi tabel database dan transactional outbox untuk menggantikan cache interim.
2. **Uji Konkurensi Database Riil**: Pengujian konkurensi tingkat tinggi dengan MySQL/PostgreSQL/Redis nyata.
3. **Reset State Octane/FrankenPHP**: Penanganan siklus hidup worker long-running pada `IdempotencyStore`.

### Fase 4: Optimasi & Produksi Skala Penuh
1. **Anggaran Bundle Size (P10 / KIL-401)**: Penegakan batas <= 8 KB gzipped per chunk (belum diukur di v0, status tes: skip, dipindah ke Fase 4).
2. **Audit Aksesibilitas (P11 / WCAG 2.2 AA)**: Pengujian semantik ARIA dan navigasi keyboard.
3. **Prerender & SSR**: Evaluasi rendering server untuk kecepatan muat awal.

### Fase 5: Dokumentasi, Ekosistem & Adopsi
1. **Target Waktu Adopsi 10 Menit (P8)**: Pengujian waktu dari instalasi hingga komponen pertama berfungsi (belum diukur di v0, status tes: skip, dipindah ke Fase 5).
