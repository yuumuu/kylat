# ADR 0005: Pemilihan Lisensi Kode Apache-2.0 dan Tata Kelola Atribusi

- **Status**: PUTUSAN (KEP-14)
- **Tanggal Keputusan**: 28 Oktober 2026
- **Pemilik Keputusan**: Pemilik Proyek (Haidar)
- **Dokumen Terkait**: [KEP-14](README.md), [`LICENSE`](../../LICENSE), [`NOTICE`](../../NOTICE)

---

## 1. Konteks

Proyek Kylat memerlukan lisensi open-source resmi untuk seluruh basis kode (compiler, runtime, protokol RPC, CLI pengembang, dan adapter framework backend). Lisensi harus memenuhi kriteria:
1. Perlindungan eksplisit terhadap paten perangkat lunak baik dari kontributor maupun pengguna.
2. Kompatibilitas penuh dengan dependensi open-source yang digunakan (seperti `web-tree-sitter`, `tree-sitter-php`, `alien-signals`, `typescript`, yang sebagian besar berlisensi MIT atau Apache-2.0).
3. Penerimaan yang luas di lingkungan enterprise dan industri perangkat lunak.
4. Kejelasan atribusi dan pelaporan kontribusi yang dibantu kecerdasan buatan (AI coding tools).

---

## 2. Keputusan

1. **Lisensi Kode**: Menetapkan lisensi **Apache License, Version 2.0 (Apache-2.0)** untuk seluruh basis kode repositori Kylat.
2. **Berkas Atribusi (`NOTICE`)**: Menyediakan berkas `NOTICE` di root repositori yang mencantumkan hak cipta pemilik proyek dan kontributor, serta pernyataan transparansi bahwa bagian kode dirancang dan diimplementasikan dengan bantuan asisten AI.
3. **Penerapan Multi-Paket**:
   - Seluruh paket npm monorepo (`@kylat/compiler`, `@kylat/runtime`, `@kylat/protocol`, `@kylat/cli`, contoh aplikasi, dan spike) mendeklarasikan `"license": "Apache-2.0"` pada `package.json`.
   - Seluruh pustaka Composer (`kylat/laravel` adapter dan spike) mendeklarasikan `"license": "Apache-2.0"` pada `composer.json`.
4. **Kebijakan Kontribusi**: Menggunakan Developer Certificate of Origin (DCO) dengan pesan commit `Signed-off-by` untuk kontributor independen.

---

## 3. Rationale (Alasan Pemilihan)

1. **Klausul Paten Eksplisit**:
   Tidak seperti lisensi MIT yang tidak memuat klausul lisensi paten, Apache-2.0 secara eksplisit memberikan lisensi paten timbal balik dari kontributor dan mencabut lisensi paten jika pihak pengguna menggugat pelanggaran paten terhadap proyek. Untuk proyek toolchain kompilasi dan runtime reaktif, klausul ini memberikan kepastian hukum yang sangat penting.
2. **Kompatibilitas Dependensi**:
   Dependensi eksternal Kylat berlisensi permisif (MIT dan Apache-2.0). Lisensi Apache-2.0 kompatibel penuh untuk mengagregasi dan mendistribusikan pustaka-pustaka tersebut.
3. **Pemberian Hak Nama/Merek**:
   Lisensi Apache-2.0 secara tegas menyatakan tidak memberikan hak atas merek dagang (*trademark*) proyek kepada pengguna. Nama "Kylat" tetap berada di bawah kendali pemilik proyek dan dapat didaftarkan secara independen di DJKI/WIPO.

---

## 4. Hasil Audit Dependensi

Pemeriksaan dependensi aktual dilakukan menggunakan `npx license-checker` dan `composer licenses`:

```text
npx license-checker --summary:
├─ MIT: 1 (@types/node)
├─ Apache-2.0: 1 (typescript)
└─ UNLICENSED: 1 (workspace root private)

composer licenses (packages/adapter-laravel):
Licenses: Apache-2.0
Dependencies: None (hanya php ^8.2)

composer licenses (bench/spikes/s3-action-declaration):
Dependencies: phpstan/phpstan (MIT)
```

**Kesimpulan Audit**: Seluruh dependensi 100% kompatibel tanpa kontaminasi copyleft atau lisensi GPL.

---

## 5. Konsekuensi

- Setiap berkas rilis dan distribusi paket wajib menyertakan atau merujuk ke salinan `LICENSE` dan `NOTICE`.
- Kontributor luar yang mengirimkan PR menyetujui persyaratan kontribusi Apache-2.0 dan DCO.
