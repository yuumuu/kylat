# STATUS — Kylat

Diperbarui: 26 Oktober 2026. Sumber kebenaran: spec/ di repo. File ini hanya ringkasan.

## Repo
- Publik: https://github.com/yuumuu/kylat, branch main
- HEAD terakhir terverifikasi: 52ce47b

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
- Runtime dengan backoff eksponensial dan jitter, retry hanya 502, 503, 504.
- CI dengan action yang dipin ke SHA, lockfile beku, dan cek versi PHP.
- Uji sabotase permanen untuk CartCounter.

## Masalah terbuka (urut prioritas)
1. Lease 30 detik tidak dilindungi terhadap aksi yang berjalan lebih lama. set_time_limit hanya menghitung waktu CPU. Perlu heartbeat atau batas waktu nyata.
2. markFailed belum terbukti menaikkan attempt atau melepas lock. Perlu tes: gagal lalu retry langsung harus berhasil.
3. Budget retry kylat:in_progress terlalu kecil (2 kali, sekitar 450 ms) dibanding lease 30 detik. Perlu dipisah dari budget 5xx.
4. Cek versi PHP gagal-terbuka untuk cabang minor yang tidak dikenal. Harus gagal-tertutup.
5. CartCounter.expected.js masih mirip output compiler. Perlu ditulis ulang tanpa melihat output, lalu direview manusia.
6. Fallback memori idempotensi hanya untuk satu proses. Perlu dicatat di dokumentasi publik.
7. Keputusan terbuka: usort (mutasi by-reference dan balikan bool), dan lisensi repo. Repo publik belum punya LICENSE.
8. Verifikasi isi Google Docs versi 1.1 terhadap spec/ di repo. Dokumen di Drive bukan sumber kebenaran.

## Aturan kerja
- Commit kecil, satu perubahan per commit.
- Setiap klaim "lulus" harus disertai output test atau tautan run CI.
- Jangan mengubah golden file dengan menyalin output compiler.
- Jangan menambah fitur di luar v0.
- Setiap KIL baru wajib didaftarkan di spec/errors.md sebelum dipakai.
