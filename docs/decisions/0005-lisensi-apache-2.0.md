# ADR 0005: Pemilihan Lisensi Kode Apache-2.0 dan Tata Kelola Atribusi

- **Status**: PUTUSAN (disetujui pemilik proyek, tanggal: 28 Oktober 2026) (KEP-14)
- **Tanggal Usulan**: 28 Oktober 2026
- **Tanggal Keputusan**: 28 Oktober 2026
- **Pengusul**: Rekomendasi perancangan (Claude / Agent)
- **Pemilik Keputusan**: Pemilik Proyek (haidaryuum)
- **Target Tenggat**: Fase 0
- **Dokumen Terkait**: [KEP-14](README.md), [`LICENSE`](../../LICENSE), [`NOTICE`](../../NOTICE)

---

## 1. Konteks

Proyek Kylat memerlukan lisensi open-source resmi untuk seluruh basis kode (compiler, runtime, protokol RPC, CLI pengembang, dan adapter framework backend). Lisensi harus memenuhi kriteria:
1. Perlindungan eksplisit terhadap paten perangkat lunak baik dari kontributor maupun pengguna.
2. Kompatibilitas penuh dengan dependensi open-source yang digunakan (seperti `web-tree-sitter`, `tree-sitter-wasms`, `alien-signals`, `typescript`, yang berlisensi MIT, Unlicense, atau Apache-2.0).
3. Penerimaan yang luas di lingkungan enterprise dan industri perangkat lunak.
4. Kejelasan atribusi dan pelaporan kontribusi yang dibantu kecerdasan buatan (AI coding tools).

---

## 2. Usulan

1. **Lisensi Kode**: Mengusulkan lisensi **Apache License, Version 2.0 (Apache-2.0)** untuk seluruh basis kode repositori Kylat.
2. **Berkas Atribusi (`NOTICE`)**: Menyediakan berkas `NOTICE` di root repositori yang mencantumkan hak cipta pemilik proyek dan kontributor (menunggu konfirmasi nama pemilik), serta pernyataan transparansi bahwa bagian kode dirancang dan diimplementasikan dengan bantuan asisten AI.
3. **Penerapan Multi-Paket**:
   - Seluruh paket npm monorepo (`@kylat/compiler`, `@kylat/runtime`, `@kylat/protocol`, `@kylat/cli`, contoh aplikasi, dan spike) mendeklarasikan `"license": "Apache-2.0"` pada `package.json`.
   - Seluruh pustaka Composer (`kylat/laravel` adapter dan spike) mendeklarasikan `"license": "Apache-2.0"` pada `composer.json`.
4. **Kebijakan Kontribusi**: Menggunakan Developer Certificate of Origin (DCO) dengan pesan commit `Signed-off-by` untuk kontributor independen.

---

## 3. Rationale (Alasan Pemilihan)

1. **Klausul Paten Eksplisit**:
   Tidak seperti lisensi MIT yang tidak memuat klausul lisensi paten, Apache-2.0 secara eksplisit memberikan lisensi paten timbal balik dari kontributor dan mencabut lisensi paten jika pihak pengguna menggugat pelanggaran paten terhadap proyek. Untuk proyek toolchain kompilasi dan runtime reaktif, klausul ini memberikan kepastian hukum yang sangat penting.
2. **Kompatibilitas Dependensi**:
   Dependensi eksternal Kylat berlisensi permisif (MIT, Unlicense, dan Apache-2.0). Lisensi Apache-2.0 kompatibel penuh untuk mengagregasi dan mendistribusikan pustaka-pustaka tersebut.
3. **Pemberian Hak Nama/Merek**:
   Lisensi Apache-2.0 secara tegas menyatakan tidak memberikan hak atas merek dagang (*trademark*) proyek kepada pengguna. Nama "Kylat" tetap berada di bawah kendali pemilik proyek dan dapat didaftarkan secara independen di DJKI/WIPO.

---

## 4. Hasil Audit Dependensi Lengkap Workspace

Audit menyeluruh dependensi dilakukan pada seluruh paket pnpm workspace dan Composer:

### Dependensi Eksternal (Per-Paket):
1. **`packages/compiler`**:
   - `web-tree-sitter` (v0.25.1): **MIT**
   - `tree-sitter-wasms` (v0.1.13): **Unlicense** (Domain publik / permisif)
   - `@types/node` (v26.6.5): **MIT**
2. **`packages/runtime`**:
   - `alien-signals` (v3.2.1): **MIT**
3. **`packages/protocol` & `packages/cli`**:
   - Tidak memiliki dependensi eksternal runtime pihak ketiga selain paket internal `@kylat/*`.
4. **`bench/spikes/s2-signals`**:
   - `alien-signals`: **MIT**
   - `@solidjs/signals`: **MIT**
   - `solid-js`: **MIT**
5. **Root Monorepo**:
   - `typescript` (v7.0.2): **Apache-2.0**
   - `@types/node` (v26.6.5): **MIT**
6. **Composer**:
   - `packages/adapter-laravel`: Hanya bergantung pada `php ^8.2` (tanpa dependensi paket luar pihak ketiga).
   - `bench/spikes/s3-action-declaration`: `phpstan/phpstan` (v1.12.34): **MIT**.

> *Catatan audit teknis*: Pemindaian awal `license-checker` di root repo hanya memunculkan 2 paket karena pnpm mengisolasi dependensi tiap paket di subfolder/symlink `.pnpm/`. Pemeriksaan langsung per paket workspace membuktikan seluruh pustaka runtime di atas hadir dan 100% berlisensi permisif (MIT, Unlicense, Apache-2.0) tanpa ada pustaka berlisensi GPL/copyleft.

---

## 5. Konsekuensi

- Setiap berkas rilis dan distribusi paket menyertakan rujukan ke salinan `LICENSE` dan `NOTICE`.
- Pengesahan: PUTUSAN (disetujui pemilik proyek, tanggal: 28 Oktober 2026).
