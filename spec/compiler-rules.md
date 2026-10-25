# spec/compiler-rules.md

Aturan yang ditegakkan compiler **di luar** sintaks bahasa dan templat. Dipindahkan dari Dokumen 4 §8 (revisi P0), sesuai keputusan D1 audit ulang 25 Oktober 2026.

Setiap aturan wajib punya: kode stabil, lokasi di PHP, penjelasan satu kalimat, saran perbaikan, dan tautan dokumentasi — format di Dokumen 2 §9.

| Kode | Aturan | Cakupan |
|---|---|---|
| KIL-201 | Satu komponen per file; nama file sama dengan nama kelas | Struktur |
| KIL-202 | `declare(strict_types=1)` wajib | Bahasa |
| KIL-203 | Urutan anggota: konstanta, `#[Prop]`, state, computed, `#[Client]`, `#[Server]` | Konvensi |
| KIL-204 | Method `#[Client]` pendek; batas lunak 40 baris, nesting maksimal 3 (peringatan) | Konvensi |
| KIL-205 | Templat hanya ekspresi sederhana; logika masuk computed | Konvensi |
| KIL-206 | Tanpa `static`, `global`, atau singleton di komponen | Bahasa |
| KIL-210 | Nama aksi unik per kontrak | Kontrak |
| KIL-211 | Tidak ada dependensi sirkular antar komponen | Struktur |
| KIL-310 | Aksi dengan parameter ID wajib punya `authorize` | Keamanan |
| KIL-401 | Anggaran ukuran chunk per komponen (usulan 8 KB gzip) | Anggaran |

Rentang sah: `1xx` bahasa, `2xx` konvensi dan struktur, `3xx` keamanan dan kontrak, `4xx` aksesibilitas dan anggaran.

---

## Catatan per aturan

**KIL-201.** Kelas harus `final`. Satu file satu komponen memudahkan pemetaan sumber ke output dan membuat source map deterministik.

**KIL-202.** `strict_types` bukan preferensi gaya: tanpa itu, semantik koersi PHP diam-diam masuk ke kode yang akan dikompilasi ke JS, dan differential test tidak punya jawaban tunggal.

**KIL-206.** Yang dilarang adalah **static property**, **variabel global**, dan **singleton** — keadaan yang hidup lebih lama dari satu komponen. Enum case dan konstanta kelas bukan static property dan tidak terkena aturan ini. Perbedaan ini perlu ditulis eksplisit agar analyzer tidak menolak enum yang sah (audit D6).

**KIL-310.** Saat ini hanya berlaku untuk aksi yang punya parameter ID. Dokumen 3 §9.3 mewajibkan otorisasi eksplisit untuk **setiap** aksi. Selisih ini belum diputuskan (audit S-07); jangan perluas tanpa keputusan, karena memperluas berarti aksi yang sekarang lolos akan gagal di CI.

**KIL-401.** Angka 8 KB masih usulan dan belum disetujui (audit S-10). Anggaran total runtime — yang di Dokumen 1 §2 disebut "diukur relatif terhadap inti signals" — belum punya angka sama sekali. Angka final menunggu spike S2.

---

## Penyimpangan rentang yang belum diperbaiki

Tiga kode melanggar rentang yang dideklarasikan di atas (audit D4). Tidak saya renumber di sini karena perubahan nomor memutus rujukan di Dokumen 2, Dokumen 4, dan pesan error yang sudah ditulis:

| Kode | Rentang sekarang | Seharusnya |
|---|---|---|
| KIL-202 | 2xx (konvensi/struktur) | 1xx (aturan bahasa) |
| KIL-206 | 2xx (konvensi/struktur) | 1xx (aturan bahasa) |
| KIL-210 | 2xx (konvensi/struktur) | 3xx (kontrak aksi) |

Keputusan yang dibutuhkan: renumber sekarang selagi belum ada kode yang bergantung padanya, atau biarkan dan terima bahwa rentang tidak lagi bisa dipakai untuk menebak jenis masalah. Rekomendasi: renumber sekarang — biayanya nol selama fase 0 belum mulai.
