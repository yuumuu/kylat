# STATUS — Kylat

Diperbarui: 12 November 2026. Sumber kebenaran: `spec/` di repo. File ini ringkasan operasional, bukan spesifikasi.

## Status Gerbang Rilis
- **Status Fase 0**: **DITUTUP dengan pengecualian tercatat pada 10 November 2026** (Tag: `v0.0.0-p0`, commit `819bcb4`; ADR 0014).
- **Status Fase 1**: **DITUTUP dengan pengecualian tercatat pada 11 November 2026** (Tag: `v0.1.0-p1`; ADR 0014).
- **Status Fase 2**: **DITUTUP pada 13 November 2026** (Tag: `v0.2.0-p2`; ADR 0016).
- **Pengesahan Golden Master**: `CartCounter.expected.js` telah DISAHKAN oleh pemilik proyek pada 10 November 2026; Kylat 6 lokal merujuk ADR 0014.
- **Keputusan Arsitektur Terkait**:
  - ADR 0006: Disetujui untuk Fase 1 (Opsi A: accessor getter).
  - ADR 0007: Ditunda ke Fase 3 (rujukan transaksi database outbox).
  - ADR 0008: Disetujui (KIL-203..205 ditunda ke v0.1; KIL-150 didaftarkan dan dipisahkan dari KIL-151). **KIL-130 diaktifkan kembali oleh ADR 0012.**
  - ADR 0009: **Tetap berstatus USULAN** (Spike S2 alien-signals v3.2.1; syarat uji mobile/JSC dan perangkat fisik belum terpenuhi).
  - ADR 0011: **DITERIMA** — closure/arrow function dan kontrol alur `if`/`foreach`/`for`/`return` didukung; `usort` ditunda ke v0.1 (KIL-110); `match` tetap ditunda (KIL-104). Menggantikan ADR 0010/KEP-38.
  - ADR 0012: **DITERIMA** — map memakai `Map` JS; IR v0 memakai semantic shell + `bodyCode`/`bodyLocations`; KIL-130 aktif.
  - ADR 0013: **DITERIMA** — bentuk `#[Computed]`/lifecycle v0 dan urutan DOM → OnMount → Effect.
  - ADR 0014: **DITERIMA** — STATUS adalah otoritas operasional; Fase 0/1 “ditutup dengan pengecualian tercatat”.
  - ADR 0015: **DIBUKA** — Fase 3 protokol/adapter; tugas pertama GET read/schema dan tipe protokol.
  - ADR 0016: **DITERIMA** — Fase 2 ditutup; enum/readonly ditunda ke v0.1.
  - ADR 0017: **DITERIMA** — kontrak GET read/schema, Problem Details stale build/rate limit, dan schema aksi.
  - ADR 0018: **DITERIMA** — rate limit Redis produksi, schema auth-only, cache publik 60 detik, database MySQL utama/PostgreSQL uji.
  - ADR 0019: **DITERIMA** — skema `kylat_idempotency_keys`/`kylat_outbox`, transaksi per panggilan, rollback penuh.

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
- **Deteksi database di `#[Client]` memakai aturan AST (risiko terbuka prioritas tinggi)**: pemanggilan langsung `scoped_call_expression` (static/class call) dan `member_call_expression` ditolak KIL-120; callback literal berbentuk array (`array_map([$this, 'query'], ...)`), string (`array_map('DB::table', ...)`), dan first-class callable juga dideteksi pada `array_map`/`array_filter`/`usort`. Residual yang belum tertangkap: callback yang disimpan di state/prop/variabel (`array_map($this->callback, ...)`) atau dibentuk secara dinamis. Ini bukan jaminan keamanan penuh.

---

## Ringkasan Progres

Fase 0 dan Fase 1 resmi ditutup. Baseline toolchain mencakup compiler, runtime sinyal, CLI, contoh referensi (`01-counter` SFC dan `04-cart` server action), serta adapter Laravel yang seluruhnya diverifikasi 100% lulus CI di Node 20/22 dan PHP 8.2/8.3.

### Fase 2 — Compiler (DITUTUP 13 November 2026)

Sudah diimplementasikan dan diuji:

- **Analisis tipe v0**: property, parameter, return, nullable, `list<T>`, `array<string,T>`, serta KIL-131 untuk tipe hilang dan konkatenasi titik non-string; KIL-130 aktif untuk array ambigu dan `array_filter` tanpa `array_values`.
- **IR terketik**: `parsedType` pada prop/state/parameter/return, `bodyCode` + `bodyLocations` untuk method, computed, dan lifecycle (ADR 0012).
- **Map PHP**: `array<string,T>` memakai `Map` JavaScript dengan helper chunk lokal; `array_filter` mempertahankan key dan `array_values` mengembalikan list.
- **Kontrol alur**: `if`/`elseif`/`else`, `foreach` (termasuk key map dan `continue`), `for`, `return` dini.
- **Closure/arrow function**: closure lokal, `use`, dan pemanggilan closure; `usort` tetap ditolak KIL-110.
- **Computed/lifecycle**: `#[Computed]` menjadi `createComputed`; urutan DOM → `#[OnMount]` → `#[Effect]`; cleanup dan server call dari OnMount ditunda ke v0.1 (ADR 0013).
- **Differential test**: 13 kasus PHP vs JavaScript untuk aritmetika, konkatenasi, ternary, null coalescing, UTF-8, string, dan array.
- **Source map v3**: `CompileResult.map` memetakan baris method/computed/lifecycle/templat ke baris `*.kylat.php`; template diagnostic diberi offset baris berkas.
- **Golden master**: `Counter.expected.js` dan `CartCounter.expected.js` tetap identik; output lama tidak berubah.
- **Verifikasi**: 134 tes compiler (132 lulus, 2 skip P8/P10); `pnpm typecheck` dan `pnpm test` monorepo lulus.

Pengecualian Fase 2:

- KIL-203, KIL-204, dan KIL-205 masih ditunda ke v0.1 sesuai ADR 0008.
- KIL-211 (siklus graf) dan KIL-401 (anggaran chunk) adalah pemeriksaan tingkat proyek, belum dijalankan compiler per berkas.
- Risiko callback database dinamis (`array_map($this->callback, ...)`) masih terbuka dan tetap prioritas tinggi.
- `match` ditunda (KIL-104); `usort` ditunda (KIL-110) sesuai ADR 0011.
- Enum dan readonly value object ditunda ke v0.1 sesuai ADR 0016.

## Repo

- `origin/main` sinkron dengan commit lokal.
- Branch `main` bersih, tanpa penumpukan perubahan working tree.
- Tag rilis Fase 0: `v0.0.0-p0`.
- Tag rilis Fase 1: `v0.1.0-p1`.
- Tag rilis Fase 2: `v0.2.0-p2`.
- PR #2 di-squash menjadi `cdf5f0f`; riwayat per-commit `30bc99b`..`90f3f26` hanya tersedia di PR #2 di GitHub, bukan di `git log main`.

## Komponen yang Berjalan dan Terverifikasi

- **Parser PHP**: Subset PHP via `web-tree-sitter` WASM (Spike S1).
- **Format Komponen**: Single-file `*.kylat.php` (KEP-34) dengan validasi KIL-214, 215, 216.
- **Template Engine**: Teks, interpolasi `{{ }}`, `@if/@elseif/@else`, `@foreach/@empty`, `key`, `on:click`, `bind:value`, `bind:checked`, atribut dinamis `:attr`, tag komponen anak `<x-nama>` dengan `#[Child]`, reaktivitas prop anak via accessor getter (KEP-35).
- **Taksonomi Galat**: 33 kode terdaftar di `spec/errors.md`; 28 kode aktif ditegakkan di `@kylat/compiler` (termasuk KIL-130 dan KIL-110 penolakan closure prop, pemisahan KIL-150 markup tak seimbang dan KIL-151 direktif tak didukung).
- **Codegen Langsung & Sinyal**: DOM codegen langsung + signals (`alien-signals` v3.2.1), keyed list reconciler, sanitasi skema URL & penegakan atribut ARIA (`bindAttr`).
- **Anggaran Runtime (P10)**: Runtime monolitik gzipped < 4 KB, chunk terkompilasi < 8 KB.
- **RPC Protokol**: Batch microtask client dispatcher dengan retry transient/in-progress, timeout, CSRF token, idempotency key unik (`createIdempotencyKey`).
- **Adapter Laravel**: Registry-only, method wajib `#[Server]`, otorisasi `authorize()` default-deny, kontrol batas body/batch/depth, Problem Details RFC 9457, proteksi race-condition idempotensi 24 jam.
- **CLI Toolchain**: `make:component`, `check`, `build` (manifest builder), `doctor`.
- **Contoh Aplikasi Referensi**:
  - `examples/01-counter/`: Komponen Single-File resmi (`Counter.kylat.php`), server demo, uji E2E Node, dan uji WebKit Playwright.
  - `examples/04-cart/`: Komponen referensi pemanggilan server action RPC (`CartActions::add`) dengan otorisasi dan prop `productId`.

---

## Fase 3 — Protokol dan Adapter

**Status: DITUTUP (ADR 0020). Semua gerbang ADR 0015 terpenuhi.**

Sudah ada: tipe `ReadResponse`/`SchemaResponse`/`SchemaAction`/`SchemaParam`, konstanta Problem Details, definisi `spec/protocol.schema.json`, route `GET /_kylat/read/{action}` dan `GET /_kylat/schema` di adapter Laravel, pemeriksaan `X-Kylat-Build` → 409 `urn:kylat:stale_build`, cache policy public/private, default-deny authorization, rate limit mutasi (Redis/Laravel RateLimiter; fallback phpredis-Lua; in-memory hanya test), schema auth-only, conformance test bentuk wire, migrasi `kylat_idempotency_keys`/`kylat_outbox` + `last_error`, `DatabaseIdempotencyStore` (PDO, transaksi, outbox) diuji SQLite + MySQL 8.4/PostgreSQL 18.4, integrasi controller lewat `KYLAT_IDEMPOTENCY_DRIVER`, `OutboxRelay` + `kylat:outbox:relay` (SKIP LOCKED, backoff, max attempts), `beginOptimistic`/`withOptimistic` + `RpcBatcher.optimistic`, `kylat types --check`, dan E2E keranjang CSP ketat (WebKit).

Sudah ada di CI: seluruh tes adapter PHP pada matrix Node/PHP, uji konkurensi + outbox relay MySQL 8.0/PostgreSQL 15, rate limit Redis multi-worker, serta job E2E WebKit untuk keranjang CSP.

Tidak ada item Fase 3 yang tersisa. Catatan operasional: outbox bersifat at-least-once (handler wajib idempotent), dan relay dijalankan lewat scheduler/supervisor (`kylat:outbox:relay`).

Baseline yang sudah ada: `POST /_kylat/call` batch, idempotency key, retry/timeout, CSRF, default-deny `authorize()`, Problem Details, batas body/batch/depth, dan cache idempotensi 24 jam.

Tugas berikutnya: Fase 4 (rendering dan DX).

## Fase 4 — Rendering dan DX

**Status: DIBUKA (ADR 0021); source map dev/strip produksi, baseline axe, plugin Vite, dan `kylat new` selesai; HMR granular/SSR/audit screen reader belum.**

Sudah ada: `kylat build` menghasilkan `.js.map` + `sourceMappingURL` dan `manifest.sourceMap`; `--production`/`--no-sourcemap` menghapus keduanya. Contoh keranjang CSP menjalankan axe-core WCAG 2 A/AA tanpa pelanggaran serius/kritis. `@kylat/vite-plugin` mengompilasi `*.kylat.php`, meneruskan source map, dan meng-invalidate modul saat file berubah (fallback full reload). `kylat new` menghasilkan proyek Vite minimal yang komponennya lolos kompilasi.

Belum ada: component-level HMR, prerender/SSR opsional + hydration mismatch, audit screen reader, dan pengujian perangkat fisik.

Tugas berikutnya: prerender/SSR opsional + hydration mismatch, lalu HMR granular.

## Backlog Fase Berikutnya

### Fase 2: Compiler
1. **KIL-203/204/205**: aktifkan konvensi/kompleksitas pada v0.1.
2. **KIL-211/KIL-401**: pemeriksaan graf komponen dan anggaran chunk di tingkat proyek.
3. **Callback database dinamis**: tutup residual `array_map($this->callback, ...)`.
4. **Penutupan Fase 2**: gate differential penuh, review, dan tag `v0.2.0-p2`.

### Fase 3: Protokol dan Adapter (SELESAI — ADR 0020)
1. GET read/schema, stale build, rate limit, Problem Details.
2. Optimistic update/rollback dan generator tipe + `--check`.
3. Conformance suite protokol.
4. Idempotensi database/outbox + `kylat:outbox:relay`.
5. Uji konkurensi MySQL/PostgreSQL/Redis (multi-worker).
6. Reset state Octane/FrankenPHP pada listener `RequestReceived`.
7. E2E keranjang CSP ketat (WebKit).

### Fase 4: Rendering dan DX
1. **Source map runtime** dan strip produksi.
2. **Prerender, SSR opsional, dan hydration mismatch test**.
3. **HMR, generator proyek, dan plugin Vite**.
4. **Pengujian fisik/mobile** Safari iOS, JSC, perangkat low-end.
5. **Audit aksesibilitas nyata** dengan screen reader.

### Fase 5: Performa, Dokumentasi, dan Rilis
1. **P8/P10**: uji adopsi 10 menit dan benchmark ukuran resmi.
2. **Audit keamanan independen**.
3. **Paket npm/Composer, checksum/provenance/SRI, kebijakan versi**.
4. **Konsistensi dokumentasi** dan uji usability pemula.
