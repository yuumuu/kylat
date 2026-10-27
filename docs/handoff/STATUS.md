# STATUS — Kylat

Diperbarui: 27 Oktober 2026. Sumber kebenaran: spec/ di repo. File ini hanya ringkasan.

## Repo
- Publik: https://github.com/yuumuu/kylat, branch main
- HEAD terakhir terverifikasi: 504782a

## Hierarki normatif (dari spec/README.md)
1. spec/php-subset.md
2. spec/template.md
3. spec/compiler-rules.md
- spec/errors.md adalah daftar kode galat resmi. Setiap KIL-xxx yang dipakai compiler wajib terdaftar.
- Ruang lingkup v0: Mode A saja (backend PHP). Mode B ditunda.

## Keputusan yang sudah ditetapkan
- Nama: Kylat. Paket npm dan Composer: kylat. Status pemeriksaan registry, DJKI, dan WIPO: aman dan terverifikasi pada 27 Okt 2026 (bukti di docs/decisions/0001-nama-proyek.md).
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
- Draf kontrak protokol mitigasi A4 (idempotensi mutasi) telah disusun di spec/threat-model.md §3.1 dengan 8 aturan normatif netral-bahasa, menunggu pengesahan reviewer teknis dan keamanan (Dok 6).
- IdempotencyStore dengan Cache::add, lease 30 detik, dan kanonikalisasi JSON.
- Penolakan kylat:idempotency_conflict dan kylat:in_progress saat lease aktif.
- markFailed menaikkan attempt dan melepas per-attempt lock atomik pada mock driver; retry langsung terbukti berhasil di tes (catatan: masih ada risiko duplikasi jika efek samping sudah tercommit sebelum exception pada adapter).
- Runtime memisahkan budget retry kylat:in_progress (30 kali) dari budget 5xx transient (2 kali) dengan estimasi batas tunggu ~50 detik.
- Logika verifikasi versi PHP fail-closed untuk cabang minor tidak dikenal (catatan: pengujian saat ini baru menguji salinan logika di test suite).
- CI dengan action yang dipin ke SHA, lockfile beku, dan cek versi PHP fail-closed.
- Uji sabotase permanen atribut tombol dan null-check pada CartCounter golden contract lulus.

## Masalah terbuka (urut prioritas)

### Kritis
1. **Adapter belum memenuhi §3.1 aturan 5 dan 8**: Implementasi adapter Laravel saat ini (`packages/adapter-laravel`) masih memakai logika in-memory / cache facade dan belum menjamin bahwa efek samping terjadi paling banyak sekali saat crash atau retry paralel. Tuntas hanya setelah migrasi ke jaminan atomisitas (transaksi database) dan tes konkurensi lulus di MySQL atau PostgreSQL sungguhan.
2. **markFailed dan risiko duplikasi jika efek samping sudah tercommit (4ab2875, a2773c7)**: Jika mutasi database telah dieksekusi namun terjadi exception sebelum respons selesai, pemanggilan markFailed membuat retry klien mengeksekusi ulang efek samping.
3. **Jalur Cache tidak atomik (a2773c7, 4ab2875)**: Operasi pada driver Cache di complete, heartbeat, markFailed, dan release masih menggunakan get lalu put tanpa atomic compare-and-set atau distributed lock.
4. **Batas waktu eksekusi aksi di PHP hanya CPU time (bc0fec9)**: set_time_limit hanya menghitung waktu CPU, bukan wall-clock time. Aksi yang terhambat I/O atau API eksternal tetap dapat melebihi lease 30 detik tanpa dihentikan prosesnya.
5. **Heartbeat harus dipanggil manual (4ab2875)**: IdempotencyStore::heartbeat() saat ini harus dipanggil manual oleh pengembang; tanpa pemanggilan berkala, aksi berdurasi lama akan kehilangan lease dan ditolak saat complete().
6. **Body golden CartCounter.expected.js belum ditulis ulang dari spesifikasi (ad5fe93)**: Commit ad5fe93 hanya mengubah komentar header (+7 −2) tanpa menulis ulang body JavaScript secara independen dari spesifikasi normatif.

### Tinggi
7. **Tes CI PHP menguji fungsi tiruan, bukan langkah CI sesungguhnya (4bf6ed5)**: Pengujian fail-closed saat ini menguji replika evaluatePhpVersion di PHP CLI; perlu diuji langsung pada environment CI dengan flag -d zend.assertions=1.
8. **Pengujian waktu berbasis usleep dan lease pendek (120 ms) rentan flaky (4ab2875)**: Perlu clock/timer yang dapat di-inject (mockable time) untuk stabilitas pengujian di lingkungan CI lambat.
9. **Mock Cache di test suite belum memvalidasi driver nyata (a2773c7)**: CacheDriverIdempotencyTest.php memakai mock in-memory, belum membuktikan atomisitas driver nyata (Redis/Database).
10. **State statis heartbeat rentan kebocoran antar-request di Octane/FrankenPHP (4ab2875)**: Static property $currentActiveKey dan $currentActiveHash di IdempotencyStore wajib di-reset per request pada runtime persistent.

### Sedang
11. **Batas total retry client runtime (~50 detik) belum terdokumentasi publik (ad247cb)**: Aksi yang memakan waktu melebihi batas retry client akan gagal di sisi frontend.
12. **Fallback in-memory IdempotencyStore hanya aman untuk single-process**: Perlu dokumentasi publik bahwa multi-worker wajib menggunakan distributed cache/database.
13. **Keputusan terbuka**: Berkas lisensi repo (LICENSE), fungsi usort (mutasi by-reference vs bool), dan verifikasi sinkronisasi Google Docs v1.1 terhadap spec/.

## Roadmap Penutupan Fase 0 (Blocker Utama)
1. **Bukti nama kylat** [SELESAI]: Bukti pemeriksaan nama di registry npm, Packagist, GitHub, DJKI, dan WIPO beserta tanggal 27 Okt 2026 dan tautan resmi telah diarsipkan di docs/decisions/0001-nama-proyek.md.
2. **Dokumentasi Spike S1 & S3**: Catat hasil dan keputusan tertulis untuk Spike S1 (Parser Tree-sitter WASM) dan S3 (Interface kontrak aksi server) di docs/decisions/.
3. **Golden CartCounter ditulis manual**: Tulis ulang body CartCounter.expected.js secara manual dari spesifikasi normatif (spec/template.md, spec/ir.md), independen tanpa menyalin output compiler, dan ajukan review manusia.
4. **Verifikasi Gate P1 sampai P12**: Tulis uji otomatis (fail-on-violation test) di compiler dan runtime untuk masing-masing prinsip P1–P12.
5. **Demo End-to-End**: Sediakan satu aplikasi contoh sederhana (counter dengan 1 mutasi) yang berjalan end-to-end dengan langkah reproduksi yang dapat diulang.

## Aturan kerja
- Commit kecil, satu perubahan per commit.
- Setiap klaim "lulus" harus disertai output test lengkap atau tautan run CI. Ringkasan saja tidak diterima.
- Jangan mengubah golden file dengan menyalin output compiler.
- Jangan menambah fitur di luar v0.
- Setiap KIL baru wajib didaftarkan di spec/errors.md sebelum dipakai.
