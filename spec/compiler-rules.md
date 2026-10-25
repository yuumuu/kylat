# spec/compiler-rules.md

Aturan yang ditegakkan compiler **di luar** sintaks bahasa dan templat. Dipindahkan dari Dokumen 4 §8 (revisi P0), sesuai keputusan D1 audit ulang 25 Oktober 2026.

Setiap aturan wajib punya: kode stabil, lokasi di PHP, penjelasan satu kalimat, saran perbaikan, dan tautan dokumentasi — format di Dokumen 2 §9.

| Kode | Aturan | Cakupan |
|---|---|---|
| KIL-102 | `declare(strict_types=1)` wajib | Bahasa |
| KIL-103 | Tanpa `static`, `global`, atau singleton di komponen | Bahasa |
| KIL-201 | Satu komponen per file; nama file sama dengan nama kelas | Struktur |
| KIL-203 | Urutan anggota: konstanta, `#[Prop]`, state, computed, `#[Client]`, `#[Server]` | Konvensi |
| KIL-204 | Method `#[Client]` pendek; batas lunak 40 baris, nesting maksimal 3 (peringatan) | Konvensi |
| KIL-205 | Templat hanya ekspresi sederhana; logika masuk computed | Konvensi |
| KIL-211 | Tidak ada dependensi sirkular antar komponen | Struktur |
| KIL-212 | Tag `<x-nama>` wajib dideklarasikan lewat `#[Child(Nama::class)]` di komponen induk | Struktur |
| KIL-310 | Aksi dengan parameter ID wajib punya `authorize` | Keamanan |
| KIL-311 | Nama aksi unik per kontrak | Kontrak |
| KIL-401 | Anggaran ukuran chunk per komponen (usulan 8 KB gzip) | Anggaran |

Rentang sah: `1xx` bahasa, `2xx` konvensi dan struktur, `3xx` keamanan dan kontrak, `4xx` aksesibilitas dan anggaran.

---

## Catatan per aturan

**KIL-201.** Kelas harus `final`. Satu file satu komponen memudahkan pemetaan sumber ke output dan membuat source map deterministik.

**KIL-102.** `strict_types` bukan preferensi gaya: tanpa itu, semantik koersi PHP diam-diam masuk ke kode yang akan dikompilasi ke JS, dan differential test tidak punya jawaban tunggal.

**KIL-103.** Yang dilarang adalah **static property**, **variabel global**, dan **singleton** — keadaan yang hidup lebih lama dari satu komponen. Enum case dan konstanta kelas bukan static property dan tidak terkena aturan ini. Perbedaan ini perlu ditulis eksplisit agar analyzer tidak menolak enum yang sah (audit D6).

**KIL-211.** Siklus dependensi adalah masalah **graf**, bukan masalah sintaks: `A` memakai `B`, `B` memakai `A`, dan tidak ada urutan build yang sah. Kode ini dulu dipakai juga untuk "komponen anak tanpa deklarasi" di `template.md` §7 — dua kegagalan yang tidak berhubungan, dan pesan errornya tidak bisa benar untuk keduanya. Sejak E-01, arti itu pindah ke KIL-212.

**KIL-212.** Kewajiban deklarasi `#[Child]` bersifat **struktur**, karena yang diperiksa adalah daftar dependensi komponen, bukan bentuk templat. Kode ini tetap muncul di `template.md` §8 karena lokasi pelanggarannya adalah tag `<x-nama>` di templat — nomor kode menyatakan jenis masalah, bukan berkas tempat pesan dicetak. `#[Uses]` dipakai untuk kontrak aksi server dan tidak membuka izin merender komponen. Aturan tag: kebab-case dari nama kelas, dua kelas yang memetakan ke tag sama menggagalkan build, dan `<x-...>` tidak boleh muncul di DOM hasil.

**KIL-311.** Kode ini menggantikan KIL-210. Keunikan nama aksi adalah masalah **kontrak**, bukan struktur file: dua komponen sah masing-masing dapat mendeklarasikan aksi bernama sama, dan bentrokannya baru terlihat saat kontrak digabung.

**KIL-310.** Saat ini hanya berlaku untuk aksi yang punya parameter ID. Dokumen 3 §9.3 mewajibkan otorisasi eksplisit untuk **setiap** aksi. Selisih ini belum diputuskan (audit S-07); jangan perluas tanpa keputusan, karena memperluas berarti aksi yang sekarang lolos akan gagal di CI.

**KIL-401.** Angka 8 KB masih usulan dan belum disetujui (audit S-10). Anggaran total runtime — yang di Dokumen 1 §2 disebut "diukur relatif terhadap inti signals" — belum punya angka sama sekali. Angka final menunggu spike S2.

---

## Renumber 25 Oktober 2026

Tiga kode yang melanggar rentang sudah dipindahkan. Tidak ada kode lama yang boleh dipakai lagi; tabel ini adalah satu-satunya pemetaan resmi sampai `spec/errors.md` memuat daftar lengkapnya.

| Lama | Baru | Alasan |
|---|---|---|
| KIL-202 | **KIL-102** | `strict_types` adalah batasan bahasa, bukan konvensi struktur |
| KIL-206 | **KIL-103** | Larangan `static`/`global`/singleton adalah batasan bahasa |
| KIL-210 | **KIL-311** | Keunikan nama aksi adalah masalah kontrak aksi |

Kode yang **tidak** berubah: KIL-201, KIL-203, KIL-204, KIL-205, KIL-211, KIL-212, KIL-310, KIL-401. Rentang `1xx`, `2xx`, `3xx`, dan `4xx` kini konsisten dengan jenis masalahnya, sehingga nomor bisa dipakai untuk menebak kelas kesalahan sebelum pesan dibaca.

Riwayat: keputusan ini diambil sebelum fase 0 dimulai, saat belum ada CI, pesan error, atau dokumentasi pengguna yang merujuk kode lama. Renumber setelah itu akan memutus rujukan dan tidak boleh dilakukan tanpa tabel migrasi di `errors.md`.
