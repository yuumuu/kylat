ARSIP — non-normatif. Hasil konversi otomatis dari .docx.

# Kylat 2 — Spesifikasi Bahasa

**Status:** draf konsolidasi v1.0. Sumber kebenaran untuk compiler. Setiap perubahan di sini wajib diikuti test golden dan differential test.

## 1. Prinsip

* Subset kecil dan eksplisit. Konstruksi di luar subset ditolak saat build, dengan kode galat dan lokasi, bukan diterjemahkan diam-diam.
* Tipe wajib. Tanpa tipe jelas, compiler tidak tahu apakah sebuah array adalah list atau map.
* Semantik PHP dipertahankan. Perbedaan dengan JavaScript ditangani secara eksplisit (bagian 4).

## 2. Yang didukung di #[Client] (v0)

* **Tipe:** int, float, string, bool, null, list<T>, array<string, T>, enum sederhana, readonly value object.
* **Operator:** aritmetika, logika, perbandingan strict (===, !==, <, >, <=, >=), null coalescing, ternary.
* **Kontrol alur:** if/else, match, foreach, for, return dini.
* **Closure dan arrow function.**
* **Fungsi bawaan (allowlist):** count, str\_contains, str\_starts\_with, array\_map, array\_filter, array\_slice, usort, implode, explode, trim, strtolower, strtoupper. Setiap fungsi punya implementasi JS terdokumentasi dan diuji differential.

## 3. Ditolak saat build

| Kode | Konstruksi |
| --- | --- |
| KIL-101 | Perbandingan longgar == dan != |
| KIL-110 | Kelas atau fungsi di luar allowlist |
| KIL-120 | I/O, database, filesystem, atau sesi di #[Client] |
| KIL-130 | Array tanpa tipe jelas (list vs map ambigu) |
| — | Variabel dinamis, eval, include, referensi (&), global, static property |

## 4. Perbedaan semantik PHP dan JavaScript

| Topik | PHP | JavaScript | Keputusan |
| --- | --- | --- | --- |
| List vs map | Satu tipe array | Array dan object terpisah | Wajib tipe list<T> atau array<string,T>. Map memakai Map JS, bukan object |
| Integer | 64-bit | Number (double) | int di luar rentang aman ditolak atau dikirim sebagai string. intdiv terpisah dari / |
| Perbandingan | == longgar punya banyak aturan | Berbeda | Hanya strict, == ditolak |
| String | Byte string | UTF-16 | Hanya fungsi mb\_\* yang didukung. Fungsi byte-level ditolak |
| Urutan key | Urutan penyisipan | Key numerik di object berbeda | Gunakan Map untuk data berurutan |

## 5. Aturan tipe dan nullable

* Setiap property, parameter, dan return wajib bertipe. Array memakai docblock generik (list<Product>).
* Nullable hanya bila tipe ditulis nullable secara eksplisit.
* **[TERBUKA]** Daftar lengkap fungsi allowlist dan aturan kasus tepi nullable masih harus ditutup lewat spike pertama fase 2.

## 6. Toolchain dan parser

**[PUTUSAN]** Compiler dan runtime berjalan di Node (TypeScript). Parser PHP di toolchain FE tidak boleh membutuhkan PHP terpasang.

**[TERBUKA]** Pilihan parser: parser PHP berbasis JS (misalnya berbasis tree-sitter-php atau paket parser PHP di npm) atau parser Rust/WASM. Keputusan lewat spike S1 (dokumen 6). nikic/PHP-Parser hanya dipakai di adapter sisi PHP untuk membuat kontrak, bukan di compiler.

## 7. Intermediate representation (IR)

* IR bebas dari PHP: node untuk komponen, state, computed, aksi, ekspresi, dan kontrol alur, masing-masing dengan tipe yang sudah dianotasi.
* Spesifikasi lengkap ada di spec/ir.md. **[TERBUKA]** Berkas ini belum ditulis.
* Codegen menghasilkan operasi DOM langsung yang terikat ke signal, bukan virtual DOM.

## 8. Source map dan debugging

Setiap error runtime dan stack trace menunjuk ke baris PHP asli melalui source map. Source map hanya untuk dev dan staging, tidak dipublikasikan di produksi.

## 9. Format pesan error

Setiap error build memiliki kode stabil, lokasi di PHP, penjelasan satu kalimat, saran perbaikan, dan tautan ke dokumentasi. Contoh:

KIL-120 Method #[Client] tidak boleh mengakses database
 --> src/components/Cart.php:34:17
Bantuan: pindahkan ke aksi server, lalu panggil
 $this->server(CartActions::class)->items();
Dokumen: docs/reference/errors.md#KIL-120

## 10. Ringkasan rentang kode galat

* KIL-1xx: bahasa dan subset PHP
* KIL-2xx: konvensi dan struktur proyek
* KIL-3xx: keamanan dan kontrak aksi
* KIL-4xx: aksesibilitas dan anggaran ukuran

**[TERBUKA]** Daftar lengkap kode beserta pesan dan contohnya masih harus dilengkapi di docs/reference/errors.md.
