ARSIP — non-normatif. Hasil konversi otomatis dari .docx.

# VERSI 1.1 (revisi P0, 25 Oktober 2026). Perubahan dari v1.0: ditambahkan status prinsip non-negosiasi di bagian akhir.

# Kylat 6 — Roadmap, Keputusan, Risiko, dan Gerbang

**Status:** draf konsolidasi v1.0. Ini dokumen yang dipakai untuk mengelola pekerjaan. Setiap keputusan [TERBUKA] punya pemilik dan tenggat.

## 1. Pemilik dan peran

* **Pemilik proyek:** Haidar. Memutuskan ruang lingkup, nama, dan prioritas.
* **Reviewer teknis:** ditunjuk sebelum fase 1. Mereview compiler dan runtime.
* **Reviewer keamanan:** ahli independen, dijadwalkan sebelum fase 3 selesai.
* **Penguji pemula:** lima orang, dijadwalkan sebelum 1.0.

## 2. Fase dan kriteria selesai

| Fase | Isi | Selesai bila |
| --- | --- | --- |
| 0. Fondasi | Spesifikasi PHP subset v0, IR, protokol, repo, CI, harness benchmark, spec/template.md, spike S1 dan S3, threat model, verifikasi nama | Spike S1 dan S3 lolos kriteria. Spesifikasi dan template.md ditinjau reviewer teknis. Nama terverifikasi dan bukti dilampirkan |
| 1. Runtime | Signals, scheduler, DOM, list berkunci, template cloning, komponen tulis tangan di JS | Anggaran ukuran terpenuhi. Benchmark runtime dilaporkan. Spike S2 lolos. Test aksesibilitas dasar lolos |
| 2. Compiler | Parser, analisis tipe, IR, codegen, golden test, differential test | Subset v0 lolos differential test. Konstruksi terlarang menghasilkan KIL-xxx |
| 3. Protokol dan adapter | Batch, idempotency, optimistic update, rollback, generator tipe, adapter Laravel | Spike S4 dan S5 lolos. Test konformansi lolos. Skenario keranjang lolos e2e dengan CSP ketat |
| 4. Rendering dan DX | Prerender, SSR opsional, HMR, generator proyek, kylat doctor | Test hydration mismatch lolos. Doctor lolos di proyek contoh |
| 5. Bukti performa | Seluruh benchmark, publikasi, keputusan resumability atau local-first | Laporan publik dengan skrip yang bisa diulang orang lain |
| 6. Mode B (bersyarat) | Adaptor OpenAPI untuk backend apa pun | Hanya jika gerbang G1 sampai G5 terpenuhi |

## 3. Definition of ready dan definition of done

**Ready (sebelum fitur dikerjakan):** spesifikasi tertulis di dokumen 2, 3, atau 4. Threat model fitur sudah diisi. Test yang akan dibuat sudah didaftar. Anggaran ukuran dan performa relevan sudah ditetapkan.

**Done (setelah fitur selesai):** spesifikasi diperbarui. Semua test hijau. Anggaran terpenuhi. Contoh di examples/ berjalan. Dokumentasi pengguna ditulis. Tidak ada TODO tanpa issue. Lint, format, dan tipe lolos. Untuk fitur keamanan, ada uji regresi.

## 4. Spike wajib: S1 dan S3 di fase 0, S2 di fase 1, S4 dan S5 di fase 3

| ID | Pertanyaan | Kriteria lolos |
| --- | --- | --- |
| S1 | Parser PHP mana yang dipakai di toolchain Node? | Mem-parse seluruh subset v0 dengan benar. Menghasilkan AST yang bisa dianalisis tipe. Tidak butuh PHP terpasang |
| S2 | Inti signals mana: alien-signals atau @solidjs/signals? | Ukuran gzip inti tercatat. Benchmark counter dan tabel 1.000 baris dalam satu harness. Pilih yang menang di ukuran dan kecepatan, dengan catatan stabilitas API |
| S3 | Bentuk sintaks deklarasi aksi server (interface atau atribut) | Dua prototipe diuji tipenya dengan PHPStan. Dipilih yang lebih sederhana untuk pemula |
| S4 | Biaya kernel minimal PSR-15 dibanding boot Laravel per request | Diukur di PHP-FPM dengan opcache. Dilaporkan p50 dan p95 |
| S5 | Round-trip optimistic update dan rollback di satu komponen | Rollback hanya menyentuh node terdampak. Uji dengan kegagalan server simulasi |

## 5. Register keputusan

| Topik | Status | Tenggat | Pemilik |
| --- | --- | --- | --- |
| Nama proyek Kylat | PUTUSAN. Pemeriksaan registry dan DJKI dilaporkan aman, bukti belum dilampirkan | Akhir fase 0 | Pemilik proyek |
| Ruang lingkup Mode A dulu | PUTUSAN | — | Pemilik proyek |
| Toolchain berjalan di Node (TypeScript) | PUTUSAN | — | Reviewer teknis |
| Komponen hanya deklarasi aksi, implementasi di kelas Action | PUTUSAN | — | Reviewer teknis |
| Tidak menulis runtime reaktif sendiri | PUTUSAN | — | Reviewer teknis |
| Parser PHP di toolchain | TERBUKA, lewat S1 | Akhir fase 0 | Reviewer teknis |
| Inti signals | TERBUKA, lewat S2 | Akhir fase 1 | Reviewer teknis |
| Sintaks deklarasi aksi | TERBUKA, lewat S3 | Akhir fase 0 | Pemilik proyek |
| Binary CLI atau paket npm saja | TERBUKA | Akhir fase 0 | Pemilik proyek |
| Compiler di browser untuk playground | TERBUKA | Akhir fase 0 | Pemilik proyek |
| Nilai batas runtime dan konkurensi PHP-FPM | TERBUKA, lewat S4 dan beban nyata | Akhir fase 3 | Reviewer teknis |
| Istilah island versus partial, aksi versus action | TERBUKA | Akhir fase 0 | Pemilik proyek |
| Lisensi dan tata kelola | TERBUKA | Sebelum rilis 1.0 | Pemilik proyek |
| Kebijakan versi dan deprecation (SemVer, jendela dukungan) | TERBUKA | Sebelum rilis 1.0 | Reviewer teknis |
| Mode B | TERBUKA, bersyarat | Setelah gerbang G1 sampai G5 | Pemilik proyek |

## 6. Gerbang Mode B (G1 sampai G5)

* **G1:** Mode A stabil. Dua rilis minor berturut-turut tanpa regresi anggaran dan tanpa temuan keamanan kritis terbuka.
* **G2:** Ada kebutuhan nyata. Minimal dua proyek atau pengguna butuh backend non-PHP.
* **G3:** Spesifikasi OpenAPI untuk kasus tersebut ada dan lolos lint.
* **G4:** Minimal tiga developer PHP menyelesaikan tugas yang sama (daftar, filter, aksi tulis) dengan Kylat Mode B setara atau lebih cepat dibanding Svelte, TanStack Query, dan openapi-typescript.
* **G5:** Estimasi biaya Mode B tidak lebih dari seperempat kapasitas pengembangan per kuartal dan tidak menggeser roadmap Mode A.

**No-go:** bila G1 belum tercapai, tidak ada kasus nyata dua kuartal setelah Mode A stabil, G4 menunjukkan Kylat lebih lambat atau membingungkan, atau biaya pemeliharaan Mode B mendekati Mode A.

## 7. Gerbang rilis 1.0

* Semua gerbang CI hijau: lint, tipe, golden, differential, ukuran, e2e dengan CSP ketat, kontrak, keamanan, dependensi, benchmark.
* Tinjauan keamanan independen selesai. Semua temuan kritis dan tinggi ditutup.
* Audit aksesibilitas WCAG 2.2 AA dengan uji pembaca layar (NVDA, VoiceOver, TalkBack).
* Uji usability pemula: minimal empat dari lima penguji menyelesaikan tutorial tingkat 1 dan 2 tanpa bantuan. Target pantauan: komponen pertama berjalan dalam 10 menit dari mesin bersih (P8). Bukan gerbang rilis 1.0.
* Laporan benchmark publik dengan skrip yang bisa diulang.
* Lisensi, kebijakan versi, dan SECURITY.md terbit.

## 8. Register risiko

| Risiko | Dampak | Mitigasi | Pemilik |
| --- | --- | --- | --- |
| Transpiler PHP ke JS memakan waktu dan beda semantik | Tinggi | Subset sempit, differential test, gagal keras saat build | Reviewer teknis |
| Authoring PHP membingungkan (terlihat server, jalan di browser) | Sedang | Atribut #[Client] wajib, lint, pesan error jelas, dokumentasi | Pemilik proyek |
| Sulit mengalahkan Solid dan Svelte secara mentah | Tinggi | Targetkan setara di render. Menang di DX dan integrasi PHP. Ukur, jangan klaim | Pemilik proyek |
| Dependensi pada komponen beta (signals, parser, Solid 2.0) | Sedang | Pin versi, bungkus di balik interface, pantau advisory | Reviewer teknis |
| Konflik state saat optimistic update gagal | Sedang | Mulai dari satu komponen. Aturan rollback eksplisit. Spike S5 | Reviewer teknis |
| Nilai tambah dibanding Livewire 4 dan Alpine belum jelas | Tinggi | Ukur di skenario yang sama. Pertahankan Mode B sebagai gerbang, bukan janji | Pemilik proyek |
| Supply chain npm atau Composer | Tinggi | Dependensi minimum, minimumReleaseAge, tanpa install script, provenance | Reviewer keamanan |
| Kerentanan PHP runtime (PHP2Shell) | Tinggi | kylat doctor, kebijakan versi minimum, restart worker | Pengguna backend |
| Ekosistem dan adopsi lambat | Tinggi | Adapter Laravel yang bagus dan contoh nyata lebih dulu | Pemilik proyek |
| Nama bentrok dengan proyek lain | Sedang | Cadangan kylat-php, kylatjs, kilau. Pemeriksaan dicatat | Pemilik proyek |

## 9. Keputusan terkait dokumen ini

* Dokumen perancangan asli tetap menjadi riwayat. Revisi di sini adalah sumber kebenaran operasional.
* Penggantian istilah lama (Kilat, Sfurana) ke Kylat dilakukan di dokumen perancangan saat revisi berikutnya.
* Angka benchmark dan klaim yang belum diukur dianggap hipotesis sampai harness menghasilkan bukti.
* Status prinsip non-negosiasi (v1.1)
* Masuk: P1 sampai P7 dan P10 sampai P12 (lihat dokumen 1).
* Separuh: P8 (dari nol ke komponen pertama dalam 10 menit, diukur di uji usability fase 5) dan P9 (dokumentasi sejalan dengan kode, hanya quick start yang diuji di CI). Kenaikan status diputuskan setelah uji usability.
* Tambahan register keputusan: kedua prinsip separuh tidak menjadi gerbang rilis 1.0 sampai ada keputusan tertulis.
* Keputusan revisi P0 (25 Oktober 2026), menjawab audit K-01 sampai K-06.
* PUTUSAN ID: string di wire dan di signature PHP. Tidak ada int untuk ID publik (K-03).
* PUTUSAN String: allowlist hanya mb\_\* dan fungsi yang setara untuk UTF-8 valid. trim, strtolower, dan strtoupper dihapus dari v0 (K-04).
* PUTUSAN Templat: sintaks mirip Blade dengan atribut on dan bind. Lihat spec/template.md (K-01).
* PUTUSAN Model kegagalan batch: kegagalan per panggilan di dalam hasil HTTP 200, kegagalan level request memakai Problem Details (K-02).
* PUTUSAN Target 10 menit: target pantauan, bukan gerbang rilis 1.0 (P8).
* PUTUSAN Exit fase 0: spike S1 dan S3 (K-05). S2 di fase 1. S4 dan S5 di fase 3.
* Penomoran: prinsip dirujuk sebagai P1 sampai P12 di semua dokumen (K-06).
