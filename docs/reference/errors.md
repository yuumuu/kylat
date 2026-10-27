# Referensi Diagnosa & Kode Galat Kylat

Halaman ini adalah panduan pengguna untuk membaca, memahami, dan memperbaiki galat build yang dilaporkan oleh toolchain Kylat.

> [!IMPORTANT]
> **Sumber kebenaran normatif untuk kode galat adalah [`spec/errors.md`](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md).**
> Seluruh kode error, pemicu presisi, dan aturan perbaikan compiler didefinisikan secara mengikat di berkas spesifikasi tersebut. Halaman referensi ini menautkan langsung ke definisi normatif masing-masing kode.

---

## Membaca Diagnosa Compiler

Ketika kompilasi komponen Kylat menemukan pelanggaran aturan bahasa, templat, atau arsitektur, CLI akan menampilkan pesan terstruktur:

```text
error[KIL-xxx]: [Ringkasan Kesalahan]
 --> [Lokasi Berkas]:[Baris]:[Kolom]
    |
 [Nomor Baris] | [Potongan Kode Sumber]
    |   ^^^^^ [Penjelasan Titik Pelanggaran]
    |
    = bantuan: [Langkah Perbaikan Konkret]
    = dokumen: spec/errors.md#KIL-xxx
```

Komponen pesan:
1. **Kode Galat (`KIL-xxx`)**: Pengenal stabil yang merujuk pada kelas dan jenis masalah tertentu.
2. **Lokasi Presisi**: Baris dan kolom berkas sumber PHP asli (berkat source map deterministik).
3. **Bantuan**: Saran langkah yang dapat langsung diambil untuk memperbaiki kode Anda.
4. **Tautan Spesifikasi**: Tautan menuju kontrak normatif di `spec/errors.md`.

---

## Indeks Cepat Kode Galat

### 1. Aturan Bahasa & Subset PHP (`1xx`)
Aturan yang berkaitan dengan konstruksi sintaks PHP yang didukung pada sisi klien:

- [KIL-101 (Perbandingan Longgar)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-101): Penggunaan `==` atau `!=` ditolak. Wajib menggunakan `===` atau `!==`.
- [KIL-102 (Strict Types Wajib)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-102): Setiap berkas komponen wajib diawali `declare(strict_types=1);`.
- [KIL-103 (Larangan State Statis/Global)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-103): Dilarang menggunakan `static` property, variabel `global`, atau singleton.
- [KIL-110 (Fungsi/Kelas di Luar Allowlist)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-110): Pemanggilan fungsi atau instansiasi objek (`new X`) di luar allowlist v0.
- [KIL-120 (Akses I/O di Client)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-120): Method `#[Client]` dilarang mengakses database, filesystem, atau sesi.
- [KIL-130 (Tipe Array Ambigu)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-130): Array tanpa docblock generik (`list<T>` vs `map`), atau hasil `array_filter` tanpa `array_values`.
- [KIL-131 (Tipe Hilang / Operator Titik)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-131): Property/parameter/return tanpa tipe, atau operator `.` dipakai pada non-string.
- [KIL-140 (Fungsi String Byte-Level)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-140): Pemakaian fungsi byte (`substr`, `strlen`) alih-alih `mb_*`.

### 2. Sintaks & Direktif Templat (`15x–16x`)
Aturan penulisan markup dan direktif di dalam komponen:

- [KIL-151 (Direktif Tidak Didukung)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-151): Pemakaian direktif Blade di dalam berkas komponen (misal `@include`, `@php`).
- [KIL-152 (HTML Mentah Ditolak)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-152): Larangan `{!! !!}` dan penyelundupan markup HTML via props string.
- [KIL-153 (Handler Event Tidak Sah)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-153): Target `on:<event>` bukan method `#[Client]`/`#[Server]`, atau event di luar daftar v0.
- [KIL-154 (Target bind:value Ilegal)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-154): Target two-way binding harus state lokal, bukan prop atau ekspresi.
- [KIL-155 (@foreach Tanpa key)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-155): Perulangan `@foreach` wajib menyertakan atribut `key` unik.
- [KIL-156 (Path error Bukan State)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-156): Atribut penampil validasi `error="..."` harus berakar pada state valid.
- [KIL-157 (Effect Memanggil Server)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-157): Lifecycle `#[Effect]` dilarang memanggil aksi `#[Server]`.
- [KIL-158 (Skema URL Ilegal)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-158): URL harus menggunakan allowlist (`https`, `http`, `mailto`, `tel`) atau path relatif.
- [KIL-159 (Interpolasi Kurung di Atribut Direktif/Dinamis)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-159): Dilarang menulis `{{ }}` di dalam `bind:`, `on:`, atau `:attr`.
- [KIL-160 (Interpolasi Kurung pada style/on*)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-160): Dilarang menggunakan `{{ }}` pada atribut `style` atau event bawaan `on*`.

### 3. Struktur & Konvensi Komponen (`2xx`)
Aturan struktur berkas, hierarki komponen, dan konvensi:

- [KIL-201 (Satu Komponen per Berkas)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-201): Berkas harus memuat satu kelas komponen `final` dengan nama sama.
- [KIL-203 (Urutan Anggota Kelas)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-203): Urutan wajib: konstanta → `#[Prop]` → state → computed → `#[Client]` → `#[Server]`.
- [KIL-204 (Batas Kompleksitas Method Client)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-204): Peringatan untuk method `#[Client]` > 40 baris atau nesting > 3.
- [KIL-205 (Logika Kompleks di Templat)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-205): Pindahkan kalkulasi berat dari templat ke computed property.
- [KIL-211 (Dependensi Sirkular)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-211): Deteksi dependensi melingkar antar-komponen anak.
- [KIL-212 (Komponen Anak Tanpa #[Child])](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-212): Tag `<x-nama>` wajib dideklarasikan di kelas induk dengan atribut `#[Child]`.
- [KIL-213 (Serialisasi data-props Melebihi 16 KB)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-213): Payload awal wadah island melebihi pagu 16 KB.
- [KIL-214 (Statement PHP di Luar Class Dilarang)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-214): Bagian PHP hanya boleh berisi `declare`, `namespace`, `use`, dan satu class.
- [KIL-215 (Nama Class Tidak Cocok dengan Berkas)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-215): Nama class harus sama dengan nama berkas dalam PascalCase.
- [KIL-216 (Tag Penutup ?> Wajib dan Tanpa PHP Setelahnya)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-216): Tag `?>` wajib ada setelah class, dan tidak boleh ada kode PHP setelahnya.

### 4. Keamanan & Kontrak Aksi (`3xx`)
Aturan RPC dan otorisasi:

- [KIL-310 (Aksi Berparameter ID Wajib Otorisasi)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-310): Aksi server berparameter ID wajib memiliki method `authorize()`.
- [KIL-311 (Nama Aksi Bentrok)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-311): Nama aksi server wajib unik di dalam satu kontrak gabungan.

### 5. Aksesibilitas & Anggaran Performa (`4xx`)
Batasan performa dan kualitas:

- [KIL-401 (Anggaran Ukuran Chunk)](file:///c:/Users/haidaryuum/source/kylat/spec/errors.md#kil-401): Ukuran chunk JS hasil kompilasi komponen melebihi pagu (maks. 8 KB gzip).

---

## Riwayat Perubahan Kode (Renumber 25 Okt 2026)

Jika Anda melihat dokumentasi lawas atau catatan commit awal yang merujuk kode lama:
- `KIL-202` telah dipindahkan menjadi **`KIL-102`**
- `KIL-206` telah dipindahkan menjadi **`KIL-103`**
- `KIL-210` telah dipindahkan menjadi **`KIL-311`**
