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
- Kontrak protokol mitigasi A4 (idempotensi mutasi) disahkan di spec/threat-model.md §3.1 dengan 8 aturan normatif netral-bahasa (RFC 8785, pasangan identitas pemanggil + key, replay deterministik, atomisitas efek samping).
- IdempotencyStore dengan Cache::add, lease 30 detik, dan kanonikalisasi JSON.
- Penolakan kylat:idempotency_conflict dan kylat:in_progress saat lease aktif.
- markFailed menaikkan attempt dan melepas per-attempt lock atomik pada mock driver; retry langsung terbukti berhasil di tes (catatan: masih ada risiko duplikasi jika efek samping sudah tercommit sebelum exception pada adapter).
- Runtime memisahkan budget retry kylat:in_progress (30 kali) dari budget 5xx transient (2 kali) dengan estimasi batas tunggu ~50 detik.
- Logika verifikasi versi PHP fail-closed untuk cabang minor tidak dikenal (catatan: pengujian saat ini baru menguji salinan logika di test suite).
- CI dengan action yang dipin ke SHA, lockfile beku, dan cek versi PHP fail-closed.
- Uji sabotase permanen atribut tombol dan null-check pada CartCounter golden contract lulus.

## Masalah terbuka & Prioritas Roadmap

### 1. Penutupan Fase 0 (Fondasi & Verifikasi)
1. **Bukti nama kylat**: Lampirkan bukti pemeriksaan nama di registry npm, Packagist, GitHub, dan DJKI beserta tanggal dan tautan.
2. **Dokumentasi Spike S1 & S3**: Catat hasil dan keputusan tertulis untuk Spike S1 (Parser Tree-sitter WASM) dan S3 (Interface kontrak aksi server) di docs/decisions/.
3. **Golden CartCounter ditulis manual**: Tulis ulang body CartCounter.expected.js secara manual dari spesifikasi normatif (spec/template.md, spec/ir.md), independen tanpa menyalin output compiler, dan ajukan review manusia.
4. **Verifikasi Gate P1 sampai P12**: Tulis uji otomatis (fail-on-violation test) di compiler dan runtime untuk masing-masing prinsip P1–P12.
5. **Demo End-to-End**: Sediakan satu aplikasi contoh sederhana (counter dengan 1 mutasi) yang berjalan end-to-end dengan langkah reproduksi yang dapat diulang.

### 2. Adapter Backend & Konformansi Protokol
6. **Dokumentasi detail database adapter**: Pindahkan detail implementasi database (tabel kylat_idempotency_keys, transaksi ACID, lock timeout, pruning) ke docs/adapters/laravel/idempotency.md sebagai referensi non-normatif.
7. **Implementasi jaminan atomisitas mutasi adapter**: Pastikan adapter backend menjamin efek samping mutasi terjadi paling banyak sekali untuk pasangan (identitas pemanggil, key) dan mengembalikan respons yang sama tanpa duplikasi.
8. **Test vector RFC 8785 & tes konkurensi database**: Uji konformansi kanonikalisasi RFC 8785 di protokol test suite dan tes konkurensi di MySQL / PostgreSQL sungguhan (via Docker di CI).
9. **Tes CI PHP langkah sesungguhnya**: Jalankan verifikasi versi PHP langsung terhadap langkah workflow CI dengan flag -d zend.assertions=1.
10. **Keputusan terbuka**: Berkas lisensi repo (LICENSE), fungsi usort (mutasi by-reference vs bool), dan verifikasi sinkronisasi Google Docs v1.1 terhadap spec/.

## Aturan kerja
- Commit kecil, satu perubahan per commit.
- Setiap klaim "lulus" harus disertai output test atau tautan run CI.
- Jangan mengubah golden file dengan menyalin output compiler.
- Jangan menambah fitur di luar v0.
- Setiap KIL baru wajib didaftarkan di spec/errors.md sebelum dipakai.
