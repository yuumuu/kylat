ARSIP — non-normatif. Hasil konversi otomatis dari .docx.

# VERSI 1.1 (revisi P0, 25 Oktober 2026). Perubahan dari v1.0: pemetaan Livewire (bagian 8) harus dicek ulang ke dokumentasi Livewire 4 terbaru sebelum dipublikasikan.

# Kylat 5 — Panduan Adopsi, CLI, dan Migrasi dari Livewire

**Status:** draf konsolidasi v1.0. Ditujukan untuk pengguna dan tim yang mengadopsi Kylat. Angka performa adalah target yang harus diukur, bukan janji.

## 1. Empat jalur instalasi

| Jalur | Untuk siapa | Cara | Build step |
| --- | --- | --- | --- |
| A. CDN | Prototipe, halaman statis | script module dengan versi di URL dan SRI | Tidak untuk menulis komponen |
| B. npm | Proyek Vite, Svelte, React, Vue | npm install kylat, plugin Vite | Ya, lewat plugin |
| C. Composer | Backend Laravel atau framework PHP lain | composer require kylat/laravel | Tidak untuk PHP. Aset lewat Vite |
| D. GitHub | Tim dengan kebijakan ketat, offline | Unduh rilis bertanda tangan, salin dist/ | Tergantung |

## 2. Jalur A: CDN

* Versi wajib di URL. Tanpa latest.
* Wajib integrity (SRI) dan crossorigin.
* Header cache immutable untuk aset ber-hash.
* CSP contoh: script-src dengan host CDN spesifik, tanpa unsafe-eval.
* Menulis komponen tetap membutuhkan compiler. Compiler di browser hanya untuk playground, karena ukurannya bertentangan dengan tujuan ringan. **[TERBUKA]** Keputusan di fase 0.
* Tidak ada biaya server untuk bundle. Data tetap dari backend. Konten publik statis bisa diprerender dan dihosting seluruhnya di CDN.

## 3. Jalur B: npm dan Vite

* Plugin Vite membaca file .php di folder komponen, menjalankan compiler, dan memasukkan hasilnya ke graph Vite.
* Interop: komponen Kylat bisa dipasang di dalam React, Vue, atau Svelte lewat mount(el, props). Sebaliknya, komponen React atau Vue tidak bisa dipakai di dalam Kylat tanpa adaptor.
* Tanpa Vite: kylat build menghasilkan modul ESM untuk bundler lain.

## 4. Jalur C: Composer

* Adapter Laravel menambah service provider, route /\_kylat/call, Blade directive, dan integrasi policy.
* Inti server bergantung pada PSR-7, PSR-15, dan PSR-17. Adapter untuk framework lain adalah paket terpisah dengan test konformansi yang sama.
* Mode Octane didukung karena handler aksi stateless.
* Konfigurasi PHP minimum dan kylat doctor tercantum di README paket.

## 5. Jalur D: GitHub

* Setiap rilis menyertakan dist/, checksums.txt, dan provenance. Dokumentasi memberi perintah verifikasi.
* Tidak ada instalasi dari branch main. Hanya tag rilis.
* Jalur ini melewati resolusi versi otomatis. Pantau update lewat SECURITY.md.

## 6. CLI

npm create kylat@latest my-app scaffold repo FE, tanpa PHP
cd my-app && npm run dev kylat dev, HMR
kylat make:component Counter buat src/components/Counter.php
kylat make:action AddToCart buat stub aksi di backend
kylat check lint subset PHP, tipe, KIL-xxx
kylat build [--cdn] build produksi, opsional artefak CDN
kylat doctor cek keamanan dan konfigurasi
kylat sync-contract [--check] sinkron kontrak dengan backend

Untuk Laravel: composer require kylat/laravel, lalu php artisan kylat:install. Perintah ini menambah provider, config, dan contoh aksi, serta mencetak langkah berikutnya.

**[PUTUSAN]** CLI utama dipasang lewat npm dengan Node 20 ke atas. Mesin frontend tidak perlu PHP.

**[TERBUKA]** Apakah ada binary tunggal lintas platform, dan apakah create juga menawarkan template monolit Laravel. Keduanya diputuskan di fase 0, bersama keputusan parser (dokumen 2).

## 7. Ekspektasi performa dengan PHP-FPM

Interaksi #[Client] tidak melibatkan PHP sama sekali, jadi performanya tidak bergantung pada PHP-FPM. Untuk aksi #[Server], ada tiga pengungkit yang bisa dikendalikan:

1. **Jumlah request.** Batch, dedup, dan debounce mengurangi panggilan ke PHP-FPM. Pembacaan publik bisa di-cache di CDN.
2. **Biaya per request.** Endpoint /\_kylat/call tidak boot seluruh framework. Adapter menyediakan kernel minimal PSR-15 yang hanya memuat service yang dibutuhkan. Opcache dan preload direkomendasikan.
3. **Konkurensi.** pm.max\_children dan antrean untuk aksi lambat dihitung dari target throughput. Aksi lebih dari 10 detik dipindah ke antrean, client menerima status pending.

Yang tidak bisa dijanjikan: angka throughput absolut. Itu bergantung perangkat keras, konfigurasi PHP-FPM, dan beban nyata. Yang ditetapkan adalah target yang diukur: misalnya p95 latensi aksi server pada skenario keranjang di konkurensi tertentu, dibandingkan dengan Livewire 4 pada skenario yang sama. FrankenPHP dan Octane memberi keuntungan tambahan, tetapi bukan syarat, karena hasil yang ada belum konsisten.

## 8. Migrasi dari Livewire 4

Tujuan ganda: memudahkan adopsi, dan menjadi uji realistis bahwa Kylat memang lebih mudah. Jika migrasi nyata sulit, itu sinyal desain perlu diperbaiki.

| Livewire 4 | Kylat | Catatan |
| --- | --- | --- |
| public $prop | State, atau #[Prop] bila dari server | Kylat tidak mengirim snapshot. Data sensitif pindah ke aksi |
| wire:model | bind | Dua arah, validasi instan dari subset aturan |
| wire:click tanpa logic berat | on:click ke aksi #[Client] | Tanpa round-trip |
| wire:click yang menyentuh database | on:click ke aksi #[Server] | Tambah authorize dan skema |
| #[Computed] | computed | Di-cache di client |
| mount() | Prop dan onMount | Data dari server, inisialisasi di client |
| updated() hooks | effect | Efek tidak boleh mengakses state global tersembunyi |
| $this->dispatch() | Event internal atau store kecil | Dibatasi agar tidak menjadi state global |
| wire:navigate | Router Kylat | Navigasi tanpa muat ulang penuh |
| wire:poll | poll dengan interval minimal, berhenti saat tab tidak aktif | Default hemat |
| WithFileUploads | Aksi #[Server] dengan tipe berkas | Batas ukuran dari konfigurasi |
| wire:loading | aria-busy dan kelas pending otomatis | Memenuhi aksesibilitas |
| Alpine x-data | State lokal island | Tidak perlu Alpine terpisah |

**[TERBUKA]** Pemetaan ini perlu dicek ulang ke dokumentasi Livewire 4 terbaru sebelum dipublikasikan.

## 9. Langkah migrasi

1. **Inventaris.** Hitung komponen, property publik, aksi, dan query per komponen.
2. **Kelompokkan.** Tandai komponen murni UI (kandidat #[Client]), yang menyentuh data (kandidat #[Server]), dan yang memakai fitur khusus (keputusan manual).
3. **Coexistence.** Komponen Livewire dan Kylat boleh berdampingan di satu halaman. Migrasi per komponen.
4. **Konversi sebagian otomatis.** kylat migrate:livewire memberi saran untuk pola sederhana dan menandai sisanya dengan TODO(kylat). Tidak ada transformasi yang menulis ulang tanpa review.
5. **Uji perilaku.** Setiap komponen diuji dengan skenario yang sama. HTML dibandingkan dengan golden test pada kondisi awal dan setelah tiap aksi.
6. **Verifikasi keamanan.** Pindahkan data sensitif dari property publik ke aksi. kylat doctor menandai komponen yang masih menyimpan data sensitif di prop.
7. **Ukur.** Bandingkan ukuran bundle, jumlah request, dan latensi sebelum dan sesudah pada komponen yang sama.

## 10. Yang tidak dimigrasi otomatis

* Logika yang bergantung pada siklus hidup request PHP penuh atau middleware khusus per komponen.
* Pemanggilan $this->js() dengan string JavaScript. Kylat tidak menjalankan string JS dari PHP.
* Nested component yang bergantung pada urutan hydration Livewire.

## 11. Ukuran keberhasilan migrasi

Tiga dari lima komponen contoh bisa dimigrasi tanpa menulis ulang logika bisnis, dan waktu migrasi per komponen sederhana lebih cepat daripada menulis ulang dari nol. Diuji dengan pengguna nyata sebelum 1.0.

## 12. Checklist deployment

* Versi PHP sudah ter-patch sesuai daftar minimum (PHP2Shell).
* CSP terpasang, termasuk Trusted Types bila memungkinkan.
* Endpoint personal memakai Cache-Control private atau no-store.
* CORS memakai allowlist origin eksplisit.
* Source map tidak dipublikasikan di produksi.
* kylat doctor lolos di CI.
* Revisi P0: padanan bind, on:click, onMount, effect, dan router sekarang didefinisikan di spec/template.md (K-01), bukan hanya di tabel migrasi ini.
