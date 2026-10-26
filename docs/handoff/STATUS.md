# STATUS — Kylat

Diperbarui: 26 Oktober 2026. Sumber kebenaran: spec/ di repo. File ini hanya ringkasan.

## Repo
- Publik: https://github.com/yuumuu/kylat, branch main
- HEAD terakhir terverifikasi: ad5fe93

## Hierarki normatif (dari spec/README.md)
1. spec/php-subset.md
2. spec/template.md
3. spec/compiler-rules.md
- spec/errors.md adalah daftar kode galat resmi. Setiap KIL-xxx yang dipakai compiler wajib terdaftar.
- Ruang lingkup v0: Mode A saja (backend PHP). Mode B ditunda.

## Keputusan yang sudah ditetapkan
- Nama: Kylat. Paket npm dan Composer: kylat. Status pemeriksaan registry dan DJKI: dilaporkan aman, bukti belum dilampirkan.
- ID di wire dan di signature PHP: string.
- Fungsi string: mb_* dan fungsi yang setara untuk UTF-8 valid. trim, strtolower, strtoupper dihapus dari v0.
- Templat: sintaks mirip Blade, atribut on: dan bind:, <x-nama> untuk komposisi tanpa slot.
- Prop dipetakan ke prop_x, state ke x(). Variabel lokal dan properti tak terdeklarasi ditolak (KIL-104).
- Mutasi adalah default. Baca hanya lewat #[Server(read: true)].
- Mutasi wajib Idempotency-Key dengan panjang 8 sampai 128.
- Batas versi PHP per cabang minor: 8.2.35, 8.3.36, 8.4.27, 8.5.12 (PHP2Shell, CVE-2026-109618 dan CVE-2026-109619). Sumber sekunder, perlu verifikasi ke php.net.
- #[Uses] untuk kontrak aksi server, #[Child] untuk komponen anak.

## Yang sudah terbukti di repo
- Parser template berbasis stack, bindText hanya di elemen daun.
- Argumen aksi server dipetakan dari AST.
- IdempotencyStore dengan Cache::add, lease 30 detik, dan kanonikalisasi JSON.
- Penolakan kylat:idempotency_conflict dan kylat:in_progress.
- markFailed menaikkan attempt dan melepas per-attempt lock atomik; panggilan gagal lalu retry langsung terbukti berhasil dieksekusi.
- IdempotencyStore::heartbeat() memperpanjang lease waktu nyata selama aksi berjalan, dan complete() memverifikasi keabsahan lease untuk mencegah eksekusi ganda.
- Runtime memisahkan budget retry kylat:in_progress (30 kali, mencakup lease 30s) dari budget 5xx transient (2 kali).
- Verifikasi versi PHP di CI dan test suite gagal-tertutup (fail-closed) untuk cabang minor yang tidak dikenal.
- CI dengan action yang dipin ke SHA, lockfile beku, dan cek versi PHP fail-closed.
- CartCounter.expected.js ditulis ulang secara manual berdasarkan spesifikasi. Uji sabotase permanen lulus.

## Masalah terbuka (urut prioritas)
1. Fallback memori idempotensi hanya untuk satu proses. Perlu dicatat di dokumentasi publik.
2. Keputusan terbuka: usort (mutasi by-reference dan balikan bool), dan lisensi repo. Repo publik belum punya LICENSE.
3. Verifikasi isi Google Docs versi 1.1 terhadap spec/ di repo. Dokumen di Drive bukan sumber kebenaran.
4. Review manusia untuk berkas manual golden CartCounter.expected.js.

## Aturan kerja
- Commit kecil, satu perubahan per commit.
- Setiap klaim "lulus" harus disertai output test atau tautan run CI.
- Jangan mengubah golden file dengan menyalin output compiler.
- Jangan menambah fitur di luar v0.
- Setiap KIL baru wajib didaftarkan di spec/errors.md sebelum dipakai.
