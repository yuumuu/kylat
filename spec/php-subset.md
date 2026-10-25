# spec/php-subset.md

Subset PHP v0 yang dikompilasi menjadi JavaScript. **Normatif.**

Diturunkan dari Dokumen 2 §2–§5 (revisi P0, 25 Oktober 2026), dengan tiga perubahan dari audit ulang D2, D3, dan D5. Setiap perubahan di sini wajib diikuti test golden dan differential test.

## 1. Prinsip

- **Subset kecil dan eksplisit.** Konstruksi di luar subset ditolak saat build, dengan kode galat dan lokasi — bukan diterjemahkan diam-diam.
- **Tipe wajib.** Tanpa tipe jelas, compiler tidak tahu apakah sebuah array adalah `list` atau `map`.
- **Semantik PHP dipertahankan.** Perbedaan dengan JavaScript ditangani eksplisit di bagian 4.

## 2. Yang didukung di `#[Client]` (v0)

- **Tipe:** `int`, `float`, `string`, `bool`, `null`, `list<T>`, `array<string, T>`, enum sederhana, readonly value object.
- **Operator:** aritmetika, logika, perbandingan strict (`===`, `!==`, `<`, `>`, `<=`, `>=`), null coalescing, ternary.
- **Kontrol alur:** `if`/`else`, `match`, `foreach`, `for`, `return` dini.
- **Closure dan arrow function.**
- **Fungsi bawaan (allowlist):** `count`, `str_contains`, `str_starts_with`, `mb_strlen`, `mb_substr`, `mb_strtolower`, `mb_strtoupper`, `array_map`, `array_filter`, `array_slice`, `array_values`, `usort`, `implode`, `explode`.

`str_contains`, `str_starts_with`, `implode`, dan `explode` hanya diizinkan karena terbukti setara untuk UTF-8 valid lewat differential test. `trim`, `strtolower`, dan `strtoupper` sengaja tidak ada: semantiknya berbeda untuk karakter non-ASCII.

> `array_values` ditambahkan sebagai konsekuensi aturan `array_filter` di bagian 4. Tanpa fungsi itu, aturan tersebut tidak bisa dipatuhi. Butuh konfirmasi.

Setiap fungsi punya implementasi JS terdokumentasi dan diuji differential.

## 3. Ditolak saat build

| Kode | Konstruksi |
|---|---|
| KIL-101 | Perbandingan longgar `==` dan `!=` |
| **KIL-110** | Memanggil fungsi di luar allowlist, atau membuat instance kelas di luar allowlist (`new X`) |
| KIL-120 | I/O, database, filesystem, atau sesi di `#[Client]` |
| KIL-130 | Array tanpa tipe jelas (list vs map ambigu) |
| **KIL-131** | Tipe hilang pada property, parameter, atau return |
| KIL-140 | Fungsi byte-level di luar daftar kesetaraan UTF-8 |
| `[TERBUKA]` | Variabel dinamis, `eval`, `include`, referensi (`&`), `global`, static property — kode belum dialokasikan |

### Kenapa KIL-110 dipersempit (D3)

Rumusan lama, "Kelas atau fungsi di luar allowlist", menolak contoh resmi di Dokumen 4 §2 yang memakai `Component`, `CartActions`, `ServerAction`, dan `User`. Yang berbahaya bukan menyebut nama kelas, melainkan **menjalankan** kode yang tidak dikenal.

Karena itu yang dilarang hanya:

- memanggil fungsi di luar allowlist, dan
- membuat instance kelas di luar allowlist (`new X`).

Yang tetap diizinkan: referensi tipe di signature dan docblock, `use`, `extends`, `implements`, dan atribut. Daftar kelas yang boleh disentuh tetap perlu ditulis di `compiler-rules.md` saat diputuskan.

### KIL-131 terpisah dari KIL-130 (D2)

Dua kegagalan berbeda: **tidak ada tipe** (KIL-131) versus **tipe ada tetapi ambigu antara list dan map** (KIL-130). Menggabungkannya membuat pesan error dan tautan dokumentasi tidak bisa benar untuk keduanya.

## 4. Perbedaan semantik PHP dan JavaScript

| Topik | PHP | JavaScript | Keputusan |
|---|---|---|---|
| List vs map | Satu tipe array | Array dan object terpisah | Wajib `list<T>` atau `array<string,T>`. Map memakai `Map` JS, bukan object |
| Integer | 64-bit | Number (double) | `int` di luar rentang aman ditolak atau dikirim sebagai string. `intdiv` terpisah dari `/` |
| Perbandingan | `==` longgar punya banyak aturan | Berbeda | Hanya strict; `==` ditolak |
| String | Byte string | UTF-16 | Hanya `mb_*` dan fungsi yang setara untuk UTF-8 valid. Byte-level ditolak dengan KIL-140 |
| **`array_filter`** | **Mempertahankan key; hasil bisa berlubang** | **`filter` menghasilkan array rapat** | **Hasil dianggap `array<int\|string,T>` sampai dibungkus `array_values`. Tanpa `array_values`, pemakaian sebagai `list<T>` menghasilkan KIL-130** |
| Urutan key | Urutan penyisipan | Key numerik di object berbeda | Gunakan `Map` untuk data berurutan |
| `usort` | Memutasi by reference, mengembalikan `bool` | `sort` memutasi dan mengembalikan array | **Belum diputuskan** — lihat bagian 6 |

### Kenapa `array_filter` diatur eksplisit (D5)

`array_filter([1,2,3], fn($x) => $x % 2 === 1)` menghasilkan `[0 => 1, 2 => 3]` di PHP — key dipertahankan, array berlubang. Di JS, `filter` menghasilkan `[1,3]` yang rapat. Keduanya "benar" menurut bahasanya masing-masing, tetapi hanya satu yang bisa menjadi hasil Kylat.

Aturan di atas memilih hasil PHP sebagai sumber kebenaran: key dipertahankan, dan hasilnya dipromosikan menjadi `array<int|string,T>` agar tidak diam-diam diperlakukan sebagai list. `array_values` adalah satu-satunya jalan kembali ke `list<T>`.

## 5. Tipe dan nullable

- Setiap property, parameter, dan return wajib bertipe — pelanggaran menghasilkan **KIL-131**.
- Array memakai docblock generik: `list<Product>`, `array<string, Product>`.
- Nullable hanya bila tipe ditulis nullable secara eksplisit.
- Aturan kasus tepi nullable masih `[TERBUKA]`; ditutup lewat differential test fase 2.

## 6. Yang belum diputuskan

| Butir | Status | Kenapa penting |
|---|---|---|
| Semantik `usort` | `[TERBUKA]` | Mutasi by reference dan nilai balik `bool` tidak punya padanan langsung di JS |
| Kode untuk enam konstruksi terlarang | `[TERBUKA]` | Bagian 3 masih memakai tanda "—", padahal setiap error build wajib punya kode stabil |
| Bentuk kelas yang diizinkan (konstruktor, promotion, visibility, `readonly`, enum case vs static) | `[TERBUKA]` | `enum sederhana` dan `readonly value object` didukung tanpa aturan bentuknya (audit D6) |
| Kesetaraan `str_contains`/`explode` untuk UTF-8 | Diasumsikan setara | Harus dibuktikan lewat differential test, bukan argumen |

## 7. Rujukan

- Templat dan direktif: `template.md` (KIL-151–158)
- Aturan build di luar sintaks: `compiler-rules.md`
- Daftar kode galat lengkap: `errors.md` (belum ditulis)
