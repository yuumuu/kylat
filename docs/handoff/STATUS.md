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
- Penolakan kylat:idempotency_conflict dan kylat:in_progress saat lease aktif.
- markFailed menaikkan attempt dan melepas per-attempt lock atomik pada mock driver; retry langsung terbukti berhasil di tes (catatan: masih ada risiko duplikasi jika efek samping sudah tercommit sebelum exception).
- Runtime memisahkan budget retry kylat:in_progress (30 kali) dari budget 5xx transient (2 kali) dengan estimasi batas tunggu ~50 detik.
- Logika verifikasi versi PHP fail-closed untuk cabang minor tidak dikenal (catatan: pengujian saat ini baru menguji salinan logika di test suite).
- CI dengan action yang dipin ke SHA, lockfile beku, dan cek versi PHP fail-closed.
- Uji sabotase permanen atribut tombol dan null-check pada CartCounter golden contract lulus.

## Masalah terbuka (urut prioritas)

### Kritis
1. **Risiko eksekusi ganda jika efek samping tercommit sebelum error / retry (4ab2875, a2773c7)**: Jika mutasi database atau efek samping telah dijalankan namun terjadi exception sebelum respon selesai atau complete() ditolak karena lease habis, pemanggilan markFailed membuat retry klien mengeksekusi ulang efek samping. Solusi: bungkus efek samping dan status "completed" dalam satu transaksi database dengan tabel idempotensi unik; jangan panggil markFailed jika efek samping telah tercommit.
2. **Jalur Cache tidak atomik (a2773c7, 4ab2875)**: Operasi pada driver Cache di complete, heartbeat, markFailed, dan release masih menggunakan get lalu put tanpa atomic compare-and-set atau distributed lock.
3. **Batas waktu eksekusi aksi di PHP hanya CPU time (bc0fec9)**: set_time_limit hanya menghitung waktu CPU, bukan wall-clock time. Aksi yang terhambat I/O atau API eksternal tetap dapat melebihi lease 30 detik tanpa dihentikan prosesnya.
4. **Heartbeat belum otomatis (4ab2875)**: IdempotencyStore::heartbeat() saat ini harus dipanggil manual oleh pengembang. Tanpa pemanggilan berkala, aksi berdurasi lama akan kehilangan lease dan ditolak saat complete().
5. **Body golden CartCounter.expected.js belum ditulis ulang dari spesifikasi (ad5fe93)**: Commit ad5fe93 hanya mengubah komentar header (+7 −2) tanpa menulis ulang body JavaScript secara independen dari spesifikasi normatif.

### Tinggi
6. **Tes CI PHP menguji fungsi tiruan, bukan langkah CI sesungguhnya (4bf6ed5)**: Pengujian fail-closed saat ini menguji replika evaluatePhpVersion di PHP CLI; perlu diuji langsung pada environment CI dengan flag -d zend.assertions=1.
7. **Pengujian waktu berbasis usleep dan lease pendek (120 ms) rentan flaky (4ab2875)**: Perlu clock/timer yang dapat di-inject (mockable time) untuk stabilitas pengujian di lingkungan CI lambat.
8. **Mock Cache di test suite belum memvalidasi driver nyata (a2773c7)**: CacheDriverIdempotencyTest.php memakai mock in-memory, belum membuktikan atomisitas driver nyata (Redis/Database).

### Sedang
9. **State statis heartbeat rentan kebocoran antar-request (4ab2875)**: Static property $currentActiveKey dan $currentActiveHash di IdempotencyStore wajib di-reset per request pada runtime persistent (Laravel Octane, FrankenPHP).
10. **Batas total retry client runtime (~50 detik) belum terdokumentasi (ad247cb)**: Aksi yang memakan waktu melebihi batas retry client akan gagal di sisi frontend.
11. **Fallback in-memory IdempotencyStore hanya aman untuk single-process**: Perlu dokumentasi publik bahwa multi-worker wajib menggunakan distributed cache/database.
12. **Keputusan terbuka**: Keputusan fungsi usort (mutasi by-reference vs bool), berkas lisensi repo (LICENSE), dan verifikasi sinkronisasi Google Docs v1.1 terhadap spec/.

## Aturan kerja
- Commit kecil, satu perubahan per commit.
- Setiap klaim "lulus" harus disertai output test atau tautan run CI.
- Jangan mengubah golden file dengan menyalin output compiler.
- Jangan menambah fitur di luar v0.
- Setiap KIL baru wajib didaftarkan di spec/errors.md sebelum dipakai.
