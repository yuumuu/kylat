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
- Bila dua spesifikasi bertentangan tanpa penyelesaian yang jelas, **berhenti dan putuskan** — jangan menebak. Setiap pertentangan yang ditemukan dicatat, bukan diselesaikan diam-diam oleh implementasi.

## Status artefak

| Berkas | Cakupan | Status |
|---|---|---|
| `php-subset.md` | Subset PHP v0: tipe, operator, kontrol alur, allowlist, semantik PHP vs JS | Draf, diport dari Dokumen 2 §2–§5 + D2/D3/D5 |
| `compiler-rules.md` | Aturan build: KIL-201 sampai KIL-401 | Draf, dipindahkan dari Dokumen 4 §8 |
| `template.md` | Grammar templat, `bind:`, `on:`, `#[OnMount]`, `#[Effect]`, navigasi, KIL-151–158 | **Belum ada di repo** — sudah ditulis di Drive, menunggu izin atau tempelan isi |
| `ir.md` | Intermediate representation, bebas dari PHP | Belum — `[TERBUKA]`, tenggat akhir fase 2 |
| `errors.md` | Daftar lengkap kode KIL-xxx + pesan + contoh | Belum — `[TERBUKA]`, tenggat akhir fase 2 |
| `protocol.schema.json` | Skema kontrak aksi dan endpoint `/_kylat/*` | Belum, diturunkan dari Dokumen 3 |

## Path `errors.md` belum diputuskan

Dokumen 4 §9 menaruh `spec/errors.md` di pohon repo, tetapi Dokumen 2 §9–§10 dan Dokumen 4 §12 merujuk `docs/reference/errors.md`. Setiap pesan error build menautkan ke path ini, jadi harus diputuskan sebelum fase 1 — sebelum pesan error pertama ditulis.

## Yang tidak lagi dipakai sebagai sumber

Dokumen 4 §8 dulu memuat aturan build. Aturan itu kini tinggal di `compiler-rules.md`; Dokumen 4 cukup merujuk. Dokumen 2 dulu mengklaim "sumber kebenaran untuk compiler"; klaim itu sekarang dipegang `spec/` sebagai satu kesatuan.
