# Laporan Spike S1: Pilihan Parser PHP di Node

- **ID Spike**: S1
- **Topik Terkait**: KEP-06 (Parser PHP di toolchain Node)
- **Status**: **Lolos & Ditutup**
- **Tanggal**: 25 Oktober 2026
- **Pemilik**: Reviewer Teknis / Pemilik Proyek

---

## 1. Pertanyaan Riset & Kriteria Lolos

> **Pertanyaan**: Parser PHP mana yang dipakai di toolchain Node/TypeScript?  
> **Kriteria Lolos**:
> 1. Mem-parse seluruh subset v0 dengan benar (termasuk `declare(strict_types=1)`, kelas `final`, atribut PHP 8 `#[...]`, typed properties, dan return types).
> 2. Menghasilkan AST yang bisa dianalisis tipe dengan informasi lokasi (baris & kolom) presisi untuk diagnosa `KIL-xxx`.
> 3. Tidak membutuhkan PHP terpasang (berjalan mandiri di Node.js).
> 4. Kompatibel dengan peramban (*browser*) untuk playground online (KEP-10).

---

## 2. Kandidat yang Diuji

### Kandidat A: `glayzzle/php-parser` (v3.7.0)
- **Kelebihan**: Berbasis Pure JavaScript murni.
- **Kelemahan & Temuan**:
  - Gagal mem-parse sintaks *typed properties* PHP 7.4+ (`public string $id;`) dan menghasilkan `SyntaxError: unexpected 'string' (T_STRING), expecting T_VARIABLE`.
  - Ekosistem paket sudah lama tidak diperbarui untuk fitur-fitur modern PHP 8.1–8.3.
- **Hasil**: **DITOLAK**.

### Kandidat B: `web-tree-sitter` + `tree-sitter-php.wasm`
- **Kelebihan**:
  - **Dukungan PHP 8 Penuh**: Berhasil 100% mem-parse deklarasi `declare(strict_types=1)`, kelas `final`, atribut PHP 8 (`#[Uses]`, `#[Child]`, `#[Client]`, `#[Server]`), *typed properties* (`public string $productId;`), dan *return types*.
  - **Lokasi Baris & Kolom**: Menghasilkan posisi presisi untuk pelaporan error `KIL-xxx`.
  - **Toleransi Kesalahan (*Error Recovery*)**: Menggunakan parser LR Tree-sitter berstandar industri dengan kemampuan sintaksis adaptif.
  - **Portabilitas & Browser Support**: Berbasis WebAssembly (WASM), berjalan identik di Node.js (CLI/CI) maupun langsung di browser (Playground / KEP-10) tanpa dependensi native binary `node-gyp`.
- **Hasil**: **LOLOS & DITERIMA**.

---

## 3. Keputusan

Spike S1 resmi **ditutup**. Toolchain `@kylat/compiler` menetapkan **Tree-sitter (via `web-tree-sitter` dan `tree-sitter-php.wasm`)** sebagai mesin parser PHP subset v0.

Uji prototipe terdokumentasi dan dapat diulang pada: [`packages/compiler/test/spike-s1.mjs`](../../packages/compiler/test/spike-s1.mjs).
