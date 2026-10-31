ARSIP — non-normatif. Hasil konversi otomatis dari .docx.

# VERSI 1.1 (revisi P0, 25 Oktober 2026). Perubahan dari v1.0: ditambahkan bagian prinsip non-negosiasi (ringkas di bawah), status prinsip 8 dan 9 ditandai separuh.

# Kylat 1 — Visi dan Ruang Lingkup

**Status:** draf konsolidasi v1.0 (dari dokumen perancangan v0.6). Bahasa: Indonesia teknis. Audiens: developer, tech lead, dan agen AI yang mengimplementasikan.

## 1. Ringkasan

Kylat adalah toolchain frontend yang memungkinkan komponen ditulis dengan sintaks PHP bergaya Livewire, lalu dikompilasi menjadi JavaScript dengan reaktivitas fine-grained (signals) yang berjalan di browser. Server hanya dipanggil untuk hal yang memang membutuhkan server (data, penyimpanan, otorisasi) melalui protokol RPC yang netral bahasa.

Hasilnya adalah frontend yang bisa berdiri sendiri (di-host statis di CDN) dan berbicara dengan backend mana pun yang mengimplementasikan kontrak protokol: Laravel, Symfony, Go, Node, atau lainnya.

## 2. Tujuan terukur

* Interaksi UI murni (klik, toggle, filter lokal, validasi form) tidak memanggil server: 0 request per interaksi.
* Aksi server dikirim dalam batch. Pembacaan publik bisa di-cache.
* Ukuran runtime diukur relatif terhadap inti signals yang dipilih, dengan anggaran yang dijaga CI.
* Tidak ada eval atau new Function di runtime. Kompatibel dengan CSP ketat tanpa unsafe-eval.
* Setiap klaim performa wajib lolos harness benchmark yang bisa diulang. Tidak ada klaim tanpa angka.

## 3. Non-goals

* Bukan menerjemahkan seluruh PHP ke JavaScript. Hanya subset PHP yang terdefinisi (lihat dokumen 2).
* Bukan sync engine local-first penuh pada versi awal.
* Tidak menjanjikan performa sempurna. Batas teoretisnya adalah vanilla JS tulisan tangan; target kami mendekati kelompok Solid, Svelte 5, dan Vue Vapor, lalu diukur.

## 4. Keputusan ruang lingkup

* **[PUTUSAN]** Fokus Mode A dulu: backend PHP dengan RPC Kylat.
* **[PUTUSAN]** Mode B (backend apa pun via OpenAPI) ditunda menjadi fase 6 bersyarat. Tidak ada kode Mode B sebelum gerbang G1 sampai G5 (dokumen 6) terpenuhi.
* **[PUTUSAN]** Sambungan yang dikerjakan sekarang: lapisan DataSource sebagai interface, keluaran OpenAPI/JSON Schema, model error RFC 9457, mode auth netral, dan path endpoint dari konfigurasi.

## 5. Nama

**[PUTUSAN]** Nama proyek: **Kylat** (dari kata Indonesia "kilat" dengan ejaan yang dibedakan). Nama paket dan perintah CLI: kylat. Namespace PHP: Kylat\. Adapter Laravel: kylat/laravel.

**[TERBUKA]** Pemeriksaan merek dan registry. Pemilik proyek melaporkan hasil aman untuk registry, GitHub, dan DJKI, tetapi bukti belum dilampirkan. Tenggat: sebelum fase 0 ditutup. Cadangan jika bentrok: kylat-php, kylatjs, atau kilau. Riwayat nama lain tercatat di dokumen perancangan.

## 6. Mode distribusi

* **A. CDN:** untuk halaman statis dan prototipe. Versi wajib di URL, SRI wajib. Hanya memuat komponen yang sudah dikompilasi.
* **B. npm:** untuk proyek Vite, Svelte, React, atau Vue. Komponen dikompilasi lewat plugin Vite.
* **C. Composer:** untuk backend Laravel atau framework PHP lain. Inti server bergantung pada PSR-15, bukan Laravel.
* **D. Manual dari GitHub:** hanya dari tag rilis bertanda tangan dengan checksum.

Detail ada di dokumen 5.

## 7. Glosarium ringkas

* **Komponen:** satu file .php yang mendeklarasikan state, computed, dan aksi untuk satu bagian UI.
* **Prop:** data dari server saat komponen dimuat (#[Prop]). Dianggap publik.
* **Signal:** wadah nilai reaktif. Computed adalah nilai turunan yang di-cache.
* **Aksi:** method yang dipanggil dari UI. #[Client] jalan di browser; #[Server] dikirim ke backend.
* **Island:** komponen interaktif yang dihidrasi sendiri di tengah HTML statis.
* **Batch:** beberapa aksi server dalam satu request HTTP.
* **Build ID:** pengenal build aktif untuk mendeteksi client yang tertinggal setelah deploy.
* **Kontrak:** gabungan skema, daftar aksi, dan kode galat yang disepakati client dan server.

Glosarium lengkap dan istilah yang belum disepakati ada di dokumen 2 dan dokumen 4.

## 8. Definisi selesai untuk dokumen ini

Dokumen ini dianggap final bila tiga pihak (pemilik proyek, reviewer teknis, reviewer keamanan) menyetujui ruang lingkup, nama, dan keputusan di dokumen 6.

10 prinsip non-negosiasi, label P1 sampai P7 dan P10 sampai P12 (masuk, wajib): sintaks sama dengan PHP biasa; satu konsep untuk memulai; error bisa dipahami tanpa membaca compiler; tidak ada magic tersembunyi; kode mudah dibaca; keamanan default aman; komponen kecil dan terpisah; hasil sama di PHP dan browser; tidak terikat satu vendor atau runtime; perubahan kecil tidak merusak aplikasi.

Separuh, label P8 dan P9 (target diukur, belum gerbang rilis): dari nol ke komponen pertama dalam 10 menit; dokumentasi sejalan dengan kode (hanya contoh quick start yang diuji di CI).

Rincian dan cara penegakan: dokumen perancangan bagian 33.
