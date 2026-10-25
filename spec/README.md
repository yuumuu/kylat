# spec/

Spesifikasi yang mengikat implementasi. Setiap perubahan di sini wajib diikuti test golden dan differential test — tanpa pengecualian, karena compiler dan runtime tidak boleh punya perilaku yang tidak tertulis.

| Berkas | Cakupan | Status |
|---|---|---|
| `template.md` | Grammar templat, direktif `bind:` dan `on:`, `#[OnMount]`, `#[Effect]`, navigasi, daftar konstruksi terlarang, kode KIL-151–KIL-158 | Ditulis di Drive, **belum dipindahkan ke sini** |
| `php-subset.md` | Subset PHP v0: tipe, operator, kontrol alur, allowlist fungsi, konstruksi yang ditolak | Belum. Untuk sementara seluruh isinya ada di Dokumen 2 bagian 2–5 |
| `ir.md` | Intermediate representation, bebas dari PHP | Belum — `[TERBUKA]`, tenggat akhir fase 2 |
| `errors.md` | Daftar lengkap kode KIL-xxx beserta pesan, lokasi, saran, dan contoh | Belum — `[TERBUKA]`, tenggat akhir fase 2 |
| `protocol.schema.json` | Skema kontrak aksi dan endpoint `/_kylat/*` | Belum; diturunkan dari Dokumen 3 |

## Dua hal yang belum disatukan

**1. Path `errors.md`.** Dokumen 4 §9 menaruh `spec/errors.md` di pohon repo, tetapi Dokumen 2 §9, Dokumen 2 §10, dan Dokumen 4 §12 merujuk `docs/reference/errors.md`. Belum diputuskan mana yang kanonik dan mana yang menjadi salinan pengguna. Selaraskan sebelum fase 1, karena setiap pesan error build menautkan ke path ini.

**2. Sumber kebenaran compiler terbelah.** Dokumen 2 menyebut dirinya "sumber kebenaran untuk compiler", tetapi grammar templat kini tinggal di `template.md`. Compiler mem-parse dua bahasa (PHP dan markup), jadi fase 2 tidak bisa dimulai hanya dengan Dokumen 2. Perlu satu kalimat di Dokumen 2 yang menyatakan bahwa `spec/template.md` adalah bagian dari spesifikasi compiler, bukan lampiran opsional.
