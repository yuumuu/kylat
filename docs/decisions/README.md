# docs/decisions/ — Register Keputusan Arsitektur (ADR)

Status: Disahkan (Sinkron dengan Dokumen 6 Revisi E, 25 Oktober 2026).

Dokumen ini memuat daftar keputusan arsitektur proyek Kylat yang telah diputuskan (`PUTUSAN`) maupun yang masih dalam pembahasan terbuka (`TERBUKA`).

Setiap keputusan memiliki ID unik (`KEP-xx`), status, tenggat pencapaian, dan pemilik tanggung jawab.

---

## Tabel Register Keputusan (KEP-01 – KEP-34)

| ID | Topik & Ringkasan Keputusan | Status | Tenggat | Pemilik |
|---|---|---|---|---|
| **KEP-01** | **Nama proyek Kylat**: namespace `Kylat\`, CLI `kylat`, adapter `kylat/laravel`. Pemeriksaan registry, DJKI, dan WIPO diverifikasi aman pada 27 Okt 2026 ([`0001-nama-proyek.md`](0001-nama-proyek.md)). | **PUTUSAN** | Akhir fase 0 | Pemilik proyek |
| **KEP-02** | **Ruang lingkup**: Fokus pada Mode A (backend PHP + RPC Kylat) terlebih dahulu; Mode B (OpenAPI) ditunda. | **PUTUSAN** | — | Pemilik proyek |
| **KEP-03** | **Toolchain**: Compiler dan CLI berjalan di atas ekosistem Node (TypeScript). Parser PHP di frontend tidak boleh membutuhkan runtime PHP terpasang. | **PUTUSAN** | — | Reviewer teknis |
| **KEP-04** | **Pemisahan Komponen & Aksi**: Komponen hanya mendeklarasikan aksi server; implementasi logika bisnis dan otorisasi hidup di kelas Action server. | **PUTUSAN** | — | Reviewer teknis |
| **KEP-05** | **Runtime Reaktif**: Tidak menulis runtime sinyal sendiri; menggunakan lapisan tipis di atas pustaka signals pihak ketiga yang teruji. | **PUTUSAN** | — | Reviewer teknis |
| **KEP-06** | **Pilihan Parser PHP**: Ditetapkan menggunakan `web-tree-sitter` (WASM) + `tree-sitter-php.wasm`. Lolos evaluasi Spike S1 ([`0002-spike-s1-tree-sitter-wasm.md`](0002-spike-s1-tree-sitter-wasm.md)). | **PUTUSAN** | — | Reviewer teknis |
| **KEP-07** | **Pilihan Inti Signals**: Ditetapkan menggunakan `alien-signals`. Lolos evaluasi Spike S2 (ukuran ultra-ringkas 1.8 KB gzip, kecepatan 4.8 juta ops/detik, arsitektur push-pull monomorfik stabil). | **PUTUSAN** | — | Reviewer teknis |
| **KEP-08** | **Sintaks Deklarasi Aksi**: Ditetapkan menggunakan interface kontrak PHP (`#[Uses(NamaKontrak::class)]` + `$this->server(...)`). Lolos evaluasi Spike S3 ([`0003-spike-s3-server-action-contracts.md`](0003-spike-s3-server-action-contracts.md)). | **PUTUSAN** | — | Pemilik proyek |
| **KEP-09** | **Distribusi Binary CLI**: Keputusan apakah CLI didistribusikan sebagai binary tunggal mandiri atau paket npm murni. | `[TERBUKA]` | Akhir fase 0 | Pemilik proyek |
| **KEP-10** | **Compiler di Browser**: Kebutuhan build WASM compiler untuk playground interaktif di peramban web. | `[TERBUKA]` | Akhir fase 0 | Pemilik proyek |
| **KEP-11** | **Batas Runtime & Konkurensi**: Nilai batas timeout dan konkurensi worker PHP-FPM. Diputuskan lewat spike S4 dan uji beban nyata. | `[TERBUKA]` | Akhir fase 3 | Reviewer teknis |
| **KEP-12** | **Istilah Island vs Partial**: Istilah "island" digunakan secara definitif (`data-island`); istilah "partial" tidak dipakai di v0. | **PUTUSAN** | — | Pemilik proyek |
| **KEP-13** | **Istilah Aksi vs Action**: Penyeragaman istilah di dokumentasi pengguna. | `[TERBUKA]` | Akhir fase 0 | Pemilik proyek |
| **KEP-14** | **Lisensi & Tata Kelola Proyek**: Menetapkan lisensi **Apache-2.0** untuk kode dengan berkas `NOTICE` dan DCO ([`0005-lisensi-apache-2.0.md`](0005-lisensi-apache-2.0.md)). | **PUTUSAN** | — | Pemilik proyek |
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
| **KEP-34** | **Format Komponen Single-File (`*.kylat.php`)**: Menetapkan berkas tunggal `*.kylat.php` dengan bagian PHP (`<?php ... ?>`) dan bagian templat HTML/Kylat setelahnya ([`0004-single-file-component.md`](0004-single-file-component.md)). | `Diusulkan` | Akhir fase 0 | Pemilik proyek |

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
