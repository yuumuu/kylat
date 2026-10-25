# spec/

Spesifikasi normatif. Jika `spec/` bertentangan dengan dokumen perancangan di Drive, **`spec/` yang berlaku** — dokumen perancangan adalah alasan dan riwayat, bukan hukum.

## Urutan prioritas

Untuk pertanyaan "apakah kode ini sah", berlaku urutan ini:

1. **`php-subset.md`** — konstruksi PHP, tipe, operator, kontrol alur, allowlist fungsi.
2. **`template.md`** — sintaks templat, direktif, atribut.
3. **`compiler-rules.md`** — aturan build di luar sintaks: struktur file, konvensi, keamanan kontrak, anggaran ukuran.

Aturan turunannya:

- Spesifikasi yang lebih spesifik menang. Konstruksi yang sah di `php-subset.md` masih bisa ditolak `compiler-rules.md` bila dipakai di dalam komponen — bukan karena bahasanya salah, tetapi karena tempatnya salah.
- Kode galat mengikuti rentang Dokumen 2 §10: `1xx` bahasa, `2xx` konvensi dan struktur, `3xx` keamanan dan kontrak aksi, `4xx` aksesibilitas dan anggaran ukuran.
- **Daftar kode galat yang mengikat ada di `spec/errors.md`.** Setiap kode baru wajib terdaftar di sana — dengan pemicu, pesan, contoh salah, dan contoh benar — sebelum dipakai di pesan compiler mana pun. Kode lama yang sudah dipensiunkan (KIL-202, KIL-206, KIL-210) hanya boleh muncul di tabel pemetaan.
- Bila dua spesifikasi bertentangan tanpa penyelesaian yang jelas, **berhenti dan putuskan** — jangan menebak. Setiap pertentangan yang ditemukan dicatat, bukan diselesaikan diam-diam oleh implementasi.

## Status artefak

| Berkas | Cakupan | Status |
|---|---|---|
| `php-subset.md` | Subset PHP v0: tipe, operator (termasuk `.`), kontrol alur, allowlist, semantik PHP vs JS | Draf, diport dari Dokumen 2 §2–§5 + D2/D3/D5 |
| `compiler-rules.md` | Aturan build: KIL-102 sampai KIL-401, termasuk KIL-211 (siklus) dan KIL-212 (`#[Child]`) | Draf, dipindahkan dari Dokumen 4 §8 + E-01 + renumber |
| `template.md` | Grammar templat, tiga kelas atribut, `<x-nama>` + `#[Child]`, serialisasi `data-props`, `bind:`, `on:`, `#[OnMount]`, `#[Effect]`, navigasi, KIL-151–160 + KIL-212, hubungan dengan Blade (§10) | Ada — disahkan 25 Okt 2026, direvisi untuk E-02/E-03/E-04 |
| `ir.md` | Intermediate representation, bebas dari PHP | Draf — disahkan 25 Okt 2026, spesifikasi typed AST & signals |
| `errors.md` | Daftar lengkap kode KIL-xxx + pesan + contoh | Ada — disahkan 25 Okt 2026, memuat KIL-101 sampai KIL-401 + tabel renumber |
| `protocol.schema.json` | Skema kontrak aksi dan endpoint `/_kylat/*` | Ada — disahkan 25 Okt 2026, skema batch RPC + RFC 9457 |
| `threat-model.md` | Model ancaman, mitigasi katalog A1–D3, matriks uji | Ada — disahkan 25 Okt 2026, kontrol OWASP & CSP |

## Path `errors.md`: `spec/errors.md`

Kode galat adalah kontrak normatif yang dirujuk compiler, CLI, dan dokumen lain. Karena itu daftar lengkapnya tinggal di `spec/errors.md`, bukan `docs/reference/errors.md`.

`docs/reference/` tetap memuat penjelasan panjang dan tutorial. Semua halaman itu menaut ke `spec/errors.md`, bukan sebaliknya.

## Yang tidak lagi dipakai sebagai sumber

Dokumen 4 §8 dulu memuat aturan build. Aturan itu kini tinggal di `compiler-rules.md`; Dokumen 4 cukup merujuk. Dokumen 2 dulu mengklaim "sumber kebenaran untuk compiler"; klaim itu sekarang dipegang `spec/` sebagai satu kesatuan.
