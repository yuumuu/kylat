# ADR 0008: Penataan Status Kode Galat (KIL-130, 203..205) dan Semantik KIL-151

- **Status**: Usulan (Candidate)
- **Tanggal**: 10 November 2026
- **Penulis**: Antigravity & Tim Pengembang
- **Konteks**: Audit Kepatuhan Kode Galat Spesifikasi v0

---

## 1. Konteks dan Masalah

Berdasarkan audit konsistensi terhadap `spec/errors.md` (total 32 kode) dan kode sumber `@kylat/compiler` (26 kode aktif), teridentifikasi dua hal yang memerlukan keputusan arsitektur tertulis:

1. **Empat Kode Galat Tanpa Pemicu di Compiler v0**:
   - `KIL-130` (*Tipe array ambigu antara list dan map*)
   - `KIL-203` (*Urutan anggota kelas komponen tidak sesuai konvensi*)
   - `KIL-204` (*Method client melebihi batas kompleksitas*)
   - `KIL-205` (*Logika kompleks di dalam templat*)
   Keempat kode ini ada di katalog spesifikasi, tetapi compiler v0 belum memiliki pemicu pindaian AST untuk kode-kode tersebut.

2. **Kesenjangan Semantik KIL-151**:
   - Di `spec/errors.md`, judul resmi KIL-151 adalah: *"Direktif tidak didukung atau tidak dikenal, termasuk direktif Blade di dalam komponen"*.
   - Di `packages/compiler/src/template-parser.ts`, KIL-151 saat ini juga dipakai sebagai penanganan kegagalan cepat (*fail-fast*) untuk galat sintaks templat umum (seperti tag HTML tidak tertutup atau kurung kurawal ganda tidak tertutup).

---

## 2. Pilihan Keputusan

### Masalah 1: Empat Kode Galat (KIL-130, 203..205)

- **Opsi A (Implementasi Cepat di v0)**:
  Menambahkan aturan parsing AST di `analyzer.ts` untuk memicu KIL-130 (tipe array campuran), KIL-203 (linter urutan member), KIL-204 (hitung baris method > 40), dan KIL-205 (ekspresi bersarang di templat).
  *Kelemahan*: Menambah kompleksitas compiler v0 yang seharusnya ramping dan berfokus pada subset inti.

- **Opsi B (Tandai "Ditunda ke v0.1" di `spec/errors.md` - Direkomendasikan)**:
  Mempertahankan definisi kode di `spec/errors.md` namun menambahkan catatan status normatif: `Status: Ditunda ke v0.1`.
  *Alasan*: Subset v0 secara sengaja mengadopsi array flat, konvensi gaya tidak memblokir build, dan kompleksitas method client dibatasi secara alami oleh larangan I/O dan loop closure.

### Masalah 2: Semantik KIL-151

- **Opsi A (Ubah Judul KIL-151 di Spesifikasi)**:
  Mengubah judul KIL-151 menjadi *"Galat sintaks templat atau direktif Blade tidak didukung"*.
  *Kelemahan*: Menggabungkan dua kelas galat (sintaks HTML/templat tidak valid vs direktif Blade yang sengaja ditolak).

- **Opsi B (Pemisahan Kode: Buat KIL-150 untuk Galat Sintaks Templat - Direkomendasikan)**:
  1. Menambahkan kode baru `KIL-150` (*Sintaks markup atau tag templat tidak seimbang/tidak ditutup*) pada `spec/errors.md`.
  2. Mengembalikan fokus `KIL-151` murni untuk *Direktif tidak didukung atau direktif Blade di dalam komponen*.
  3. Memperbarui `template-parser.ts` untuk melempar KIL-150 pada kasus tag/interpolasi tidak ditutup, dan KIL-151 khusus pada direktif `@...` asing.

---

## 3. Rekomendasi Tindakan

1. Menetapkan Masalah 1 ke **Opsi B**: Tandai KIL-130, KIL-203, KIL-204, dan KIL-205 sebagai `Ditunda ke v0.1` di `spec/errors.md`.
2. Menetapkan Masalah 2 ke **Opsi B**: Mengalokasikan KIL-150 untuk galat sintaks templat umum dan mengembalikan KIL-151 untuk direktif tidak dikenal.
3. Menunggu persetujuan pengesahan formal dari Tech Lead / Reviewer sebelum mengubah berkas spesifikasi `spec/errors.md` dan kode parser.

