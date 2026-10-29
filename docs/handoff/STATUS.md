# STATUS — Kylat

Diperbarui: 29 Oktober 2026. Status Fase 0: Belum Tuntas. Sumber kebenaran: spec/ di repo. File ini hanya ringkasan.

## Repo
- Publik: https://github.com/yuumuu/kylat, branch main
- HEAD terakhir terverifikasi: 8e82029

## Hierarki normatif (dari spec/README.md)
1. spec/php-subset.md
2. spec/template.md
3. spec/compiler-rules.md
- spec/errors.md adalah daftar kode galat resmi. Setiap KIL-xxx yang dipakai compiler wajib terdaftar.
- Ruang lingkup v0: Mode A saja (backend PHP). Mode B ditunda.

## Keputusan yang sudah ditetapkan
- Nama: Kylat. Paket npm dan Composer: kylat. Pemeriksaan registry dan DJKI dilaporkan aman, namun bukti di docs/decisions/0001-nama-proyek.md merupakan pelaporan mandiri yang belum diverifikasi independen.
- Format komponen single-file (*.kylat.php) disahkan (ADR 0004 / KEP-34) sebagai format standar komponen Kylat. Target tenggat: Fase 0.
- Salinan repo sudah v1.2. Google Docs asli di Drive belum diperbarui.
- Lisensi proyek disahkan Apache-2.0 dengan berkas NOTICE (hak cipta haidaryuum) dan DCO (ADR 0005 / KEP-14). Target tenggat: Fase 0.
- ID di wire dan di signature PHP: string.
- Fungsi string: mb_* dan fungsi yang setara untuk UTF-8 valid. trim, strtolower, strtoupper dihapus dari v0.
- Templat: sintaks mirip Blade, atribut on: dan bind:, <x-nama> untuk komposisi tanpa slot.
- Prop dipetakan ke prop_x, state ke x(). Variabel lokal dan properti tak terdeklarasi ditolak (KIL-104).
- Mutasi adalah default. Baca hanya lewat #[Server(read: true)].
- Mutasi wajib Idempotency-Key dengan panjang 8 sampai 128.
- Batas versi PHP per cabang minor: 8.2.35, 8.3.36, 8.4.27, 8.5.12 (PHP2Shell, CVE-2026-109618 dan CVE-2026-109619). Sumber sekunder, perlu verifikasi ke php.net.
- #[Uses] untuk kontrak aksi server, #[Child] untuk komponen anak.

## Status Evaluasi Prinsip Non-Negosiasi (P1 – P12)
- **P1 (Sintaks PHP standar tanpa DSL)**: **Terpenuhi**. Subset v0 diparsing via Tree-sitter WASM; construct di luar subset (misal keyword `global`) digagalkan dengan KIL-103.
- **P2 (Satu konsep untuk memulai / counter)**: **Terpenuhi**. Quickstart counter (class komponen tunggal + templat) terkompilasi instan tanpa konfigurasi bundler rumit.
- **P3 (Kesalahan build jelas + lokasi + rujukan)**: **Terpenuhi**. Katalog 32 kode galat di `spec/errors.md`; 12 kode compiler aktif memuat nomor baris, kolom, pesan deskriptif, dan tautan rujukan perbaikan.
- **P4 (Tanpa virtual DOM, direct DOM binding)**: **Terpenuhi**. Runtime reaktivitas mengikat mutasi sinyal langsung ke node DOM riil via `bindText` dan `bindAttr` tanpa rekonsiliasi VDOM.
- **P5 (Server otoritas data, mutasi via RPC)**: **Terpenuhi di compiler/protokol wire**, namun **belum tuntas di adapter**. Kompiler membelokkan mutasi ke `callServerAction` dengan Idempotency-Key, tetapi penjaminan transaksi database atomik pada adapter Laravel masih dalam perbaikan.
- **P6 (Aman secara default, bebas eval, tolak raw HTML)**: **Terpenuhi**. Kompiler dan runtime bebas dari `eval`, `new Function`, dan `innerHTML`. Template dengan raw HTML `{!! !!}` digagalkan dengan KIL-152.
- **P7 (Protokol RPC netral bahasa)**: **Terpenuhi**. Skema wire batch RPC divalidasi JSON Schema (`spec/protocol.schema.json`) mendukung BatchRequest, BatchResponse, dan RFC 9457 Problem Details.
- **P8 (Waktu adopsi < 10 menit)**: **Belum diukur**. Merupakan metrik pantauan adopsi (KEP-21). Latensi kompilasi sub-detik tercapai (< 200 ms), namun uji coba ketercapaian waktu adopsi oleh developer pemula belum dilakukan di Fase 0.
- **P9 (Dokumentasi sejalan dengan implementasi)**: **Terpenuhi untuk Counter**. Contoh `Counter.php` dan `CartCounter.php` diverifikasi 100% identik dengan golden contract di CI.
- **P10 (Anggaran ukuran bundle runtime minimal & terukur)**: **Belum diukur**. Pagu unminified dev lolos (< 30 KB), namun batas anggaran resmi rilis produksi minified+gzipped belum diukur di harness benchmark resmi (dijadwalkan di Fase 1 dan Fase 2).
- **P11 (Aksesibilitas bawaan WCAG 2.2 AA)**: **Terpenuhi**. Tombol pemicu mutasi server otomatis dipasangi `aria-busy`, `data-pending`, `disabled`, serta live region `aria-live="polite"` untuk pengumuman galat server.
- **P12 (Kompatibel CSP ketat tanpa unsafe-eval)**: **Terpenuhi**. Reaktivitas signals dan binding DOM berjalan murni tanpa dependensi evaluasi kode dinamis.

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
6. **Body golden CartCounter.expected.js menunggu review manusia**: Body telah ditulis ulang secara manual dari spesifikasi normatif (spec/template.md, spec/ir.md, spec/threat-model.md §3.1) dan lolos uji sabotase; menunggu pengesahan review manusia.

### Tinggi
7. **Tes CI PHP menguji fungsi tiruan, bukan langkah CI sesungguhnya (4bf6ed5)**: Pengujian fail-closed saat ini menguji replika evaluatePhpVersion di PHP CLI; perlu diuji langsung pada environment CI dengan flag -d zend.assertions=1.
8. **Pengujian waktu berbasis usleep dan lease pendek (120 ms) rentan flaky (4ab2875)**: Perlu clock/timer yang dapat di-inject (mockable time) untuk stabilitas pengujian di lingkungan CI lambat.
9. **Mock Cache di test suite belum memvalidasi driver nyata (a2773c7)**: CacheDriverIdempotencyTest.php memakai mock in-memory, belum membuktikan atomisitas driver nyata (Redis/Database).
10. **State statis heartbeat rentan kebocoran antar-request di Octane/FrankenPHP (4ab2875)**: Static property $currentActiveKey dan $currentActiveHash di IdempotencyStore wajib di-reset per request pada runtime persistent.

### Sedang
11. **Batas total retry client runtime (~50 detik) belum terdokumentasi publik (ad247cb)**: Aksi yang memakan waktu melebihi batas retry client akan gagal di sisi frontend.
12. **Fallback in-memory IdempotencyStore hanya aman untuk single-process**: Perlu dokumentasi publik bahwa multi-worker wajib menggunakan distributed cache/database.

## Status Penutupan Fase 0: Belum Tuntas (Prasyarat Tertunda)
1. **Bukti nama kylat**: Hasil pencarian nama di registry npm, Packagist, GitHub, DJKI, dan WIPO masih pelaporan mandiri dari pengembang di docs/decisions/0001-nama-proyek.md dan belum diverifikasi secara independen dengan tangkapan layar/nomor pendaftaran resmi.
2. **Google Docs asli di Drive**: Dokumen asli di Google Drive belum dimutakhirkan ke v1.2 (hanya salinan lokal non-normatif di docs/google-docs/ yang sudah disinkronkan).
3. **P8 dan P10 belum diukur secara formal**: Metrik waktu adopsi < 10 menit (P8) dan anggaran ukuran bundle minified+gzipped di benchmark harness resmi (P10) ditandai belum diukur pada Fase 0.
4. **Review manusia CartCounter.expected.js**: Body golden file menunggu konfirmasi akhir reviewer manusia.
5. **Jaminan transaksi atomik adapter Laravel**: Poin kritis 1–3 di atas harus diselesaikan di database nyata sebelum adapter dianggap siap produksi.

## Aturan kerja
- Commit kecil, satu perubahan per commit.
- Setiap klaim "lulus" harus disertai output test lengkap atau tautan run CI. Ringkasan saja tidak diterima.
- Jangan mengubah golden file dengan menyalin output compiler.
- Jangan menambah fitur di luar v0.
- Setiap KIL baru wajib didaftarkan di spec/errors.md sebelum dipakai.
