# docs/decisions/ — Register Keputusan Arsitektur (ADR)

Status: Disahkan (Sinkron dengan Dokumen 6 Revisi E, 25 Oktober 2026).

Dokumen ini memuat daftar keputusan arsitektur proyek Kylat yang telah diputuskan (`PUTUSAN`) maupun yang masih dalam pembahasan terbuka (`TERBUKA`).

Setiap keputusan memiliki ID unik (`KEP-xx`), status, tenggat pencapaian, dan pemilik tanggung jawab.

---

## Tabel Register Keputusan (KEP-01 – KEP-47)

| ID | Topik & Ringkasan Keputusan | Status | Tenggat | Pemilik |
|---|---|---|---|---|
| **KEP-01** | **Nama proyek Kylat**: namespace `Kylat\`, CLI `kylat`, adapter `kylat/laravel`. Pemeriksaan registry, DJKI, dan WIPO diverifikasi aman pada 27 Okt 2026 ([`0001-nama-proyek.md`](0001-nama-proyek.md)). | **PUTUSAN** | Akhir fase 0 | Pemilik proyek |
| **KEP-02** | **Ruang lingkup**: Fokus pada Mode A (backend PHP + RPC Kylat) terlebih dahulu; Mode B (OpenAPI) ditunda. | **PUTUSAN** | — | Pemilik proyek |
| **KEP-03** | **Toolchain**: Compiler dan CLI berjalan di atas ekosistem Node (TypeScript). Parser PHP di frontend tidak boleh membutuhkan runtime PHP terpasang. | **PUTUSAN** | — | Reviewer teknis |
| **KEP-04** | **Pemisahan Komponen & Aksi**: Komponen hanya mendeklarasikan aksi server; implementasi logika bisnis dan otorisasi hidup di kelas Action server. | **PUTUSAN** | — | Reviewer teknis |
| **KEP-05** | **Runtime Reaktif**: Tidak menulis runtime sinyal sendiri; menggunakan lapisan tipis di atas pustaka signals pihak ketiga yang teruji. | **PUTUSAN** | — | Reviewer teknis |
| **KEP-06** | **Pilihan Parser PHP**: Ditetapkan menggunakan `web-tree-sitter` (WASM) + `tree-sitter-php.wasm`. Lolos evaluasi Spike S1 ([`0002-spike-s1-tree-sitter-wasm.md`](0002-spike-s1-tree-sitter-wasm.md)). | **PUTUSAN** | — | Reviewer teknis |
| **KEP-07** | **Pilihan Inti Signals**: Evaluasi komparatif `alien-signals` vs `@solidjs/signals` ([`0009-spike-s2-evaluasi-inti-signals.md`](0009-spike-s2-evaluasi-inti-signals.md)). Catatan: `alien-signals@3.2.1` digunakan sebagai kandidat implementasi aktif di runtime; status tetap Usulan hingga pengujian JavaScriptCore dan perangkat mobile tuntas. | **USULAN** (Kandidat: `alien-signals@3.2.1`, menunggu uji mobile/JSC) | Fase 1 | Reviewer teknis |
| **KEP-08** | **Sintaks Deklarasi Aksi**: Ditetapkan menggunakan interface kontrak PHP (`#[Uses(NamaKontrak::class)]` + `$this->server(...)`). Lolos evaluasi Spike S3 ([`0003-spike-s3-server-action-contracts.md`](0003-spike-s3-server-action-contracts.md)). | **PUTUSAN** | — | Pemilik proyek |
| **KEP-09** | **Distribusi Binary CLI**: Keputusan apakah CLI didistribusikan sebagai binary tunggal mandiri atau paket npm murni. | `[TERBUKA]` | Akhir fase 0 | Pemilik proyek |
| **KEP-10** | **Compiler di Browser**: Kebutuhan build WASM compiler untuk playground interaktif di peramban web. | `[TERBUKA]` | Akhir fase 0 | Pemilik proyek |
| **KEP-11** | **Batas Runtime & Konkurensi**: Nilai batas timeout dan konkurensi worker PHP-FPM. Diputuskan lewat spike S4 dan uji beban nyata. | `[TERBUKA]` | Akhir fase 3 | Reviewer teknis |
| **KEP-12** | **Istilah Island vs Partial**: Istilah "island" digunakan secara definitif (`data-island`); istilah "partial" tidak dipakai di v0. | **PUTUSAN** | — | Pemilik proyek |
| **KEP-13** | **Istilah Aksi vs Action**: Penyeragaman istilah di dokumentasi pengguna. | `[TERBUKA]` | Akhir fase 0 | Pemilik proyek |
| **KEP-14** | **Lisensi & Tata Kelola Proyek**: Menetapkan lisensi **Apache-2.0** untuk kode dengan berkas `NOTICE` (hak cipta haidaryuum) dan DCO ([`0005-lisensi-apache-2.0.md`](0005-lisensi-apache-2.0.md)). | **PUTUSAN** | — | Pemilik proyek |
| **KEP-15** | **Kebijakan Versi & Deprecations**: Skema SemVer dan jendela masa dukungan dependensi. | `[TERBUKA]` | Sebelum rilis 1.0 | Reviewer teknis |
| **KEP-16** | **Implementasi Mode B**: Dukungan endpoint OpenAPI/JSON non-PHP. | `[TERBUKA]` (Bersyarat) | Setelah gerbang G1–G5 | Pemilik proyek |
| **KEP-17** | **Format ID Wire & Signature**: ID dikirim sebagai string di wire protokol dan signature method PHP (K-03). Tidak ada integer untuk ID publik. | **PUTUSAN** | — | Pemilik proyek |
| **KEP-18** | **Allowlist Manipulasi String**: Allowlist hanya mengizinkan `mb_*` dan fungsi setara UTF-8 valid. Fungsi `trim`, `strtolower`, `strtoupper` dihapus dari v0 (K-04). | **PUTUSAN** | — | Pemilik proyek |
| **KEP-19** | **Sintaks Templat Komponen**: Mengadopsi sintaks mirip Blade dengan atribut `bind:` dan `on:` yang diatur di `spec/template.md` (K-01). | **PUTUSAN** | — | Pemilik proyek |
| **KEP-20** | **Model Kegagalan Batch RPC**: Kegagalan per panggilan ditampung di payload HTTP 200; kegagalan tingkat transport/request menggunakan Problem Details RFC 9457 (K-02). | **PUTUSAN** | — | Pemilik proyek |
| **KEP-21** | **Target Waktu Adopsi 10 Menit**: Target 10 menit ke komponen pertama berfungsi sebagai metrik pantauan, bukan gerbang pemblokir rilis 1.0 (P8). | **PUTUSAN** | — | Pemilik proyek |
| **KEP-22** | **Kriteria Exit Spike Fase 0**: Fase 0 selesai hanya dengan spike S1 (parser) dan S3 (sintaks aksi). Spike S2 ditunda ke fase 1; S4 & S5 ke fase 3 (K-05). | **PUTUSAN** | — | Pemilik proyek |
| **KEP-23** | **Penomoran Prinsip Desain**: Penomoran prinsip diseragamkan sebagai P1 sampai P12 di seluruh dokumen perancangan dan spesifikasi (K-06). | **PUTUSAN** | — | Pemilik proyek |
| **KEP-24** | **Komposisi Komponen Anak**: Komponen anak dirender lewat tag `<x-nama>`. Tidak ada slot markup di v0; konten dikirim lewat props ter-escape (E-02). | **PUTUSAN** | — | Pemilik proyek |
| **KEP-25** | **Tiga Kelas Nilai Atribut Templat**: Pemisahan tegas antara ekspresi polos, interpolasi `{{ }}`, dan atribut dinamis `:attr`. Pelanggaran menghasilkan KIL-159 dan KIL-160 (E-03). | **PUTUSAN** | — | Pemilik proyek |
| **KEP-26** | **Serialisasi data-props**: JSON hex-escaped, di-escape sekali untuk atribut HTML, batas pagu 16 KB per atribut, subset tipe aman tanpa objek/ORM (E-04). | **PUTUSAN** | — | Pemilik proyek |
| **KEP-27** | **Penundaan Prerender & SSR**: CSR murni adalah satu-satunya mode rendering di v0. Prerender dan SSR ditunda ke fase 4 (E-06). | **PUTUSAN** | — | Pemilik proyek |
| **KEP-28** | **Pemetaan Pointer Galat Server**: Galat validasi server dipetakan ke field form melalui pembuangan prefiks `/calls/{n}/args/` dan pengubahan path berpemisah titik ke atribut `error` (E-08). | **PUTUSAN** | — | Pemilik proyek |
| **KEP-29** | **Pemisahan Kode KIL-211 & KIL-212**: KIL-211 khusus untuk dependensi sirkular; KIL-212 untuk tag `<x-nama>` tanpa deklarasi atribut (E-01). | **PUTUSAN** | — | Pemilik proyek |
| **KEP-30** | **Path Normatif Kode Galat**: Kode galat adalah kontrak normatif compiler di `spec/errors.md`. `docs/reference/errors.md` menaut ke sana. | **PUTUSAN** | — | Pemilik proyek |
| **KEP-31** | **Renumber Kode Galat**: KIL-202 → KIL-102 (aturan bahasa), KIL-206 → KIL-103 (aturan bahasa), KIL-210 → KIL-311 (kontrak aksi). Dilakukan sebelum fase 0. | **PUTUSAN** | — | Pemilik proyek |
| **KEP-32** | **Pemisahan Atribut `#[Uses]` dan `#[Child]`**: `#[Uses(CartActions::class)]` khusus kontrak aksi server; `#[Child(Counter::class)]` khusus izin render komponen anak `<x-counter>`. Quickstart counter tidak perlu `#[Child]`. | **PUTUSAN** | — | Pemilik proyek |
| **KEP-33** | **Allowlist `array_values`**: `array_values` disahkan masuk allowlist fungsi PHP v0 tanpa syarat sementara, sebagai prasyarat teknis pemenuhan aturan `array_filter` (D5). | **PUTUSAN** | — | Pemilik proyek |
| **KEP-34** | **Format Komponen Single-File (`*.kylat.php`)**: Menetapkan berkas tunggal `*.kylat.php` dengan bagian PHP (`<?php ... ?>`) dan bagian templat HTML/Kylat setelahnya ([`0004-single-file-component.md`](0004-single-file-component.md)). | **PUTUSAN** | Akhir fase 0 | Pemilik proyek |
| **KEP-35** | **Reaktivitas Prop Komponen Anak**: Menetapkan semantik signal accessor getter untuk komposisi `<x-child :prop="$state">` ([`0006-reaktivitas-prop-komponen-anak.md`](0006-reaktivitas-prop-komponen-anak.md)). | **DISETUJUI untuk Fase 1** (Opsi A: accessor getter). Belum diimplementasikan. | Fase 1 | Arsitek Toolchain |
| **KEP-36** | **Idempotensi Atomik Database & Outbox**: Menetapkan skema tabel transaksi database untuk menggantikan cache interim pada produksi ([`0007-idempotensi-atomik-database-outbox.md`](0007-idempotensi-atomik-database-outbox.md)). | **DITUNDA ke Fase 3** (Arah Opsi A disetujui sebagai rujukan Fase 3). | Fase 3 | Arsitek Backend |
| **KEP-37** | **Penataan Status Kode Galat (KIL-130, 203..205) dan Semantik KIL-151**: Menunda KIL-130, 203..205 ke v0.1 dan memisahkan galat markup tak seimbang ke KIL-150 ([`0008-penataan-kode-galat-v0-dan-sintaks-templat.md`](0008-penataan-kode-galat-v0-dan-sintaks-templat.md)). KIL-130 diaktifkan kembali oleh KEP-40. | **PUTUSAN** (Opsi B untuk kedua masalah; KIL-130 diubah oleh ADR 0012) | Fase 0 | Arsitek Compiler |
| **KEP-38** | **Status Closure dan `usort` di `#[Client]`/`#[Computed]`**: Ditutup oleh ADR 0011. Closure/arrow function didukung; `usort` ditunda ke v0.1 dan ditolak KIL-110 ([`0010-usulan-closure-usort-subset-v0.md`](0010-usulan-closure-usort-subset-v0.md), [`0011-rekonsiliasi-subset-v0.md`](0011-rekonsiliasi-subset-v0.md)). | **DIGANTIKAN** | Fase 2 | Pemilik proyek |
| **KEP-39** | **Rekonsiliasi subset v0**: `match` tetap ditunda (KIL-104), `usort` ditunda (KIL-110), closure/arrow dan kontrol alur `if`/`foreach`/`for`/`return` didukung ([`0011-rekonsiliasi-subset-v0.md`](0011-rekonsiliasi-subset-v0.md)). | **PUTUSAN** | Fase 2 | Arsitek Toolchain |
| **KEP-40** | **Map JavaScript, IR eksekutabel, dan KIL-130 aktif**: Map memakai `Map` JS; IR v0 memakai semantic shell + `bodyCode`/`bodyLocations`; KIL-130 ditegakkan ([`0012-map-ir-eksekutabel-dan-kil-130.md`](0012-map-ir-eksekutabel-dan-kil-130.md)). | **PUTUSAN** | Fase 2 | Arsitek Toolchain |
| **KEP-41** | **Bentuk `#[Computed]`/lifecycle v0**: computed murni tanpa parameter; urutan DOM → OnMount → Effect; cleanup dan server call dari OnMount ditunda ke v0.1 ([`0013-computed-lifecycle-v0.md`](0013-computed-lifecycle-v0.md)). | **PUTUSAN** | Fase 2 | Arsitek Toolchain |
| **KEP-42** | **Rekonsiliasi gerbang Fase 0/1**: STATUS adalah otoritas operasional; Fase 0/1 “ditutup dengan pengecualian tercatat”; fase 2 belum ditutup ([`0014-rekonsiliasi-gerbang-fase-0-1.md`](0014-rekonsiliasi-gerbang-fase-0-1.md)). | **PUTUSAN** | Fase 2 | Arsitek Toolchain |
| **KEP-43** | **Pembukaan Fase 3**: ruang lingkup protokol/adapter, urutan GET read/schema → conformance → optimistic/rollback → idempotensi database/outbox → generator tipe → e2e CSP ([`0015-pembukaan-fase-3.md`](0015-pembukaan-fase-3.md)). | **DIBUKA** | Fase 3 | Arsitek Toolchain |
| **KEP-44** | **Penutupan Fase 2**: compiler, Map, KIL-130, lifecycle, differential, dan source map selesai; enum/readonly ditunda ke v0.1 ([`0016-penutupan-fase-2.md`](0016-penutupan-fase-2.md)). | **PUTUSAN** | Fase 2 | Arsitek Toolchain |
| **KEP-45** | **Kontrak GET read/schema**: bentuk respons, encoding `args`, Problem Details `stale_build`/`rate_limited`, dan schema aksi ([`0017-kontrak-get-read-schema.md`](0017-kontrak-get-read-schema.md)). | **PUTUSAN** | Fase 3 | Arsitek Toolchain |
| **KEP-46** | **Operasional Fase 3**: rate limit Redis di produksi, schema auth-only, cache read publik 60 detik dengan Vary/private, database MySQL utama + PostgreSQL uji ([`0018-operasional-fase-3-rate-limit-schema-cache-database.md`](0018-operasional-fase-3-rate-limit-schema-cache-database.md)). | **PUTUSAN** | Fase 3 | Pemilik proyek |
| **KEP-47** | **Skema idempotensi/outbox**: tabel `kylat_idempotency_keys` dengan PK `(user_id,key)` dan `kylat_outbox`; transaksi per panggilan, rollback penuh, outbox dalam transaksi ([`0019-skema-idempotensi-outbox.md`](0019-skema-idempotensi-outbox.md)). | **PUTUSAN** | Fase 3 | Arsitek Backend |

---

## Pengesahan Berkas Golden Master (Fase 0)

- `packages/compiler/test/fixtures/CartCounter.expected.js`: **DISAHKAN oleh pemilik proyek pada 10 November 2026** sebagai kontrak kebenaran resmi pengujian aksi server CartCounter.

---

## Prinsip Non-Negosiasi (P1 – P12)

1. **P1**: Sintaks PHP standar yang dikenal developer, tanpa DSL atau ekstensi compiler yang aneh.
2. **P2**: Satu konsep untuk memulai (*quick start counter* langsung jalan tanpa konfigurasi rumit).
3. **P3**: Kesalahan build memiliki pesan yang jelas, lokasi baris akurat, dan tautan panduan perbaikan.
4. **P4**: Tidak ada virtual DOM di client; reaktivitas langsung mengikat mutasi sinyal ke node DOM riil.
5. **P5**: Server adalah otoritas kebenaran data; client tidak pernah dipercaya tanpa validasi.
6. **P6**: Aman secara default (*secure by default*) — bebas evaluasi runtime dinamis (`eval`, `new Function`), escape ganda dihindari.
7. **P7**: Protokol RPC netral bahasa (`/_kylat/call`) yang kompatibel dengan backend apa pun.
8. **P8**: Waktu dari instalasi hingga komponen pertama berjalan kurang dari 10 menit (metrik pantauan).
9. **P9**: Dokumentasi dan contoh kode selalu diverifikasi dan sejalan dengan implementasi aktual.
10. **P10**: Anggaran ukuran bundle JavaScript runtime minimal dan terukur ketat.
11. **P11**: Dukungan aksesibilitas (a11y) bawaan memenuhi standar WCAG 2.2 AA.
12. **P12**: Kompatibel penuh dengan kebijakan keamanan konten (CSP) ketat tanpa `unsafe-eval`.
