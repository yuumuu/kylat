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
| KIL-214 | Bagian PHP hanya boleh berisi `declare`, `namespace`, `use`, dan satu class | Struktur |
| KIL-215 | Nama class harus sama dengan nama berkas dalam PascalCase | Struktur |
| KIL-216 | `?>` wajib ada, dan tidak boleh ada kode PHP setelahnya | Struktur |
| KIL-310 | Setiap aksi `#[Server]` wajib punya `authorize()` eksplisit | Keamanan |
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

**KIL-214.** Bagian PHP pada komponen single-file `*.kylat.php` hanya boleh berisi `declare(strict_types=1);`, `namespace`, pernyataan `use`, dan tepat satu definisi kelas komponen. Dilarang keras menempatkan pernyataan di luar tubuh kelas (*top-level statements*), fungsi mandiri, atau variabel di luar kelas.

**KIL-215.** Nama kelas komponen wajib persis sama dengan nama berkas dalam format PascalCase (misal: berkas `Counter.kylat.php` wajib mendefinisikan `class Counter`). Perbedaan kapitalisasi atau nama yang tidak seragam menggagalkan build demi kepastian pemetaan rujukan dan tag island.

**KIL-216.** Tag penutup PHP `?>` wajib ada setelah definisi kelas komponen untuk menutup bagian PHP. Tidak boleh ada tag PHP pembuka (`<?php` atau `<?=`) di dalam bagian templat setelahnya. Bagian kedua diperlakukan sepenuhnya sebagai templat HTML/Kylat.

**KIL-311.** Kode ini menggantikan KIL-210. Keunikan nama aksi adalah masalah **kontrak**, bukan struktur file: dua komponen sah masing-masing dapat mendeklarasikan aksi bernama sama, dan bentrokannya baru terlihat saat kontrak digabung.

**KIL-310.** Berlaku untuk **setiap** aksi `#[Server]`, bukan hanya aksi berparameter ID. PUTUSAN 9 November 2026 memilih threat model yang lebih ketat: aksi tanpa `authorize()` ditolak saat build, saat registrasi kontrak, dan saat runtime (default-deny). `kylat check` memeriksa kontrak/kelas aksi; adapter menolak registrasi kontrak yang tidak mendeklarasikan `authorize()`.

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

---

## Pemetaan konstruksi ke kode

| Konstruksi PHP | Kode KIL | Nama Tes |
|---|---|---|
| Berkas tanpa `declare(strict_types=1)` | KIL-102 | mendeteksi KIL-102 jika declare(strict_types=1) tidak ada |
| Pernyataan `global` / variabel global | KIL-103 | mendeteksi KIL-103 jika menggunakan global statement |
| Properti `static` pada komponen | KIL-103 | belum ada |
| Pola singleton pada kelas komponen | KIL-103 | belum ada |
| Ekspresi `match` | KIL-104 | mendeteksi KIL-104 jika menggunakan ekspresi match |
| Generator `yield` | KIL-104 | belum ada |
| Pernyataan `goto` | KIL-104 | belum ada |
| Evaluasi dinamis `eval()` | KIL-104 | belum ada |
| Argumen aksi server non-state/non-prop | KIL-104 | mendeteksi KIL-104 jika argumen aksi server berupa literal angka atau string |
| Instansiasi objek sembarang (`new X`) di method client | KIL-110 | menolak instansiasi kelas dengan KIL-110 |
| Properti atau prop bertipe `Closure` / `callable` | KIL-110 | menolak tipe properti closure atau callable dengan KIL-110 |
| Pemanggilan fungsi di luar allowlist | KIL-110 | belum ada |
| Pemanggilan I/O filesystem di method `#[Client]` | KIL-120 | menolak I/O di client dengan KIL-120 |
| Akses variabel superglobal di method `#[Client]` | KIL-120 | menolak superglobal dengan KIL-120 |
| Akses database / ORM di method `#[Client]` | KIL-120 | belum ada |
| Fungsi manipulasi string byte-level (`strlen`, `substr`, dll.) | KIL-140 | menolak fungsi string byte-level dengan KIL-140 |

