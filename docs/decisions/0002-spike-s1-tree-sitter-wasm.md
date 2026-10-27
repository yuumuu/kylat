# 0002: Spike S1 — Pemilihan Parser PHP Berbasis Tree-sitter WASM

- **ID Keputusan**: KEP-06 (0002) / Spike S1
- **Topik**: Mesin Parser PHP untuk Toolchain Node & Kompatibilitas Browser
- **Status**: **PUTUSAN**
- **Tanggal Evaluasi & Keputusan**: 25 Oktober 2026
- **Pemilik**: Reviewer Teknis
- **Target Tenggat**: Akhir Fase 0 (Tuntas)

---

## 1. Konteks dan Pertanyaan Riset

Toolchain compiler Kylat (`@kylat/compiler`) bertanggung jawab untuk mem-parse berkas komponen PHP (subset v0) langsung di lingkungan Node.js (CLI/CI) dan berpotensi berjalan di peramban web (*in-browser playground*, KEP-10).

> **Pertanyaan Riset Spike S1**:  
> Mesin parser PHP mana yang optimal, akurat, dan tidak membutuhkan instalasi binary runtime PHP pada mesin pengguna (Zero-PHP Dependency di frontend), serta mendukung penuh fitur-fitur PHP 8.2–8.5?

### Kriteria Kelulusan Spike S1
1. **Dukungan PHP 8 Modern Penuh**: Mampu mem-parse deklarasi `declare(strict_types=1)`, kelas `final`, atribut PHP 8 (`#[Uses]`, `#[Child]`, `#[Client]`, `#[Server]`, `#[Prop]`), *typed properties*, *union/intersection types*, dan *return types*.
2. **Diagnostik Presisi untuk `KIL-xxx`**: Menghasilkan AST dengan informasi posisi sumber (baris dan kolom) yang akurat untuk setiap token guna memenuhi Prinsip P3.
3. **Zero-PHP Dependency**: Dapat dijalankan 100% mandiri di Node.js tanpa membutuhkan runtime `php` CLI terinstal di mesin pengguna (KEP-03).
4. **Portabilitas Multi-Platform & Browser Ready**: Menggunakan binary WebAssembly (WASM) yang portabel lintas OS (Windows, macOS, Linux) tanpa kompilasi native binary C++ (`node-gyp`), serta dapat dimuat di browser web via WASM (KEP-10).

---

## 2. Kandidat yang Dievaluasi

### Kandidat A: `glayzzle/php-parser` (v3.7.0)
- **Arsitektur**: Parser JavaScript murni (*pure JS*).
- **Hasil Pengujian**:
  - Gagal mem-parse sintaks *typed properties* PHP 7.4+ (`public string $id;`) dan melempar `SyntaxError: unexpected 'string' (T_STRING), expecting T_VARIABLE`.
  - Ekosistem paket tidak aktif dipelihara dan tidak memiliki dukungan untuk atribut PHP 8 (`#[...]`).
- **Kesimpulan**: **DITOLAK**.

### Kandidat B: `web-tree-sitter` (WASM) + `tree-sitter-php.wasm`
- **Arsitektur**: Bindings WebAssembly dari parser Tree-sitter C grammar resmi untuk PHP.
- **Hasil Pengujian**:
  - **100% Lolos Parsing Subset v0**: Berhasil mem-parse `declare(strict_types=1)`, kelas `final`, PHP 8 attributes (`attribute_list`), *typed properties* (`public string $productId;`), dan *return types*.
  - **Lokasi Baris & Kolom**: Menghasilkan koordinat baris (0-indexed ke 1-indexed) dan kolom yang konsisten dan presisi untuk seluruh diagnosa `KIL-101` s/d `KIL-311`.
  - **Toleransi Kesalahan (*Error Recovery*)**: Algoritma parsing LR berstandar industri mampu melanjutkan pemindaian bahkan saat developer sedang mengetik syntax yang belum selesai (*incomplete syntax*).
  - **Portabilitas Tinggi**: Berkas `.wasm` berjalan identik di Node.js, CLI bundler (tsup/esbuild), maupun browser runtime.
- **Kesimpulan**: **LOLOS & DITERIMA**.

---

## 3. Keputusan Arsitektur

1. Mengesahkan **KEP-06**: `@kylat/compiler` secara definitif menggunakan **`web-tree-sitter`** dengan gramatika terkompilasi **`tree-sitter-php.wasm`** sebagai mesin parser resmi PHP subset v0.
2. Tidak menggunakan parser berbasis binary native `node-gyp` agar instalasi `npm install` atau `pnpm add` bersifat instan tanpa dependensi kompilator C++.
3. Hasil prototipe dan benchmark terdokumentasi serta dapat diuji ulang secara otomatis pada: [`packages/compiler/test/spike-s1.mjs`](../../packages/compiler/test/spike-s1.mjs).

---

## 4. Konsekuensi

- **Positif**:
  - Pengembang frontend tidak perlu menginstal PHP di mesin lokal hanya untuk menjalankan compiler Kylat.
  - Playground web interaktif dapat mengompilasi kode komponen langsung di browser pengguna tanpa server backend.
  - Diagnostik error `KIL-xxx` memiliki informasi baris dan kolom yang presisi.
- **Mitigasi**:
  - Inisialisasi parser bersifat asinkron (`await Parser.init()`); pemanggilan compiler dibungkus dalam fungsi asinkron `compile()`.
  - Ukuran file WASM (~1.5 MB) dioptimalkan melalui caching memori pada proses build berulang.
