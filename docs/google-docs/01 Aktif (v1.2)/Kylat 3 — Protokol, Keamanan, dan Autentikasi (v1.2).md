VERSI 1.2 — 30 Oktober 2026. Perubahan dari v1.1: penambahan 8 aturan normatif idempotensi mutasi pada §11.1 (kontrak protokol) sesuai spec/threat-model.md §3.1 tanpa detail database.

Kylat 3 — Protokol, Keamanan, dan Autentikasi

Status: draf konsolidasi v1.0. Kontrak ini wajib diimplementasikan ulang oleh setiap adapter backend. Katalog ancaman lengkap ada di dokumen perancangan bagian 19. Baris bertanda [U] belum ditinjau ahli keamanan.

1. Prinsip

Hanya JSON polos dengan skema ketat. Tidak ada unserialize, eval, refleksi, atau pembuatan objek dinamis dari input.

Server selalu otoritas. Client tidak pernah dipercaya, termasuk hasil validasi di client.

Default deny. Setiap aksi wajib punya otorisasi eksplisit.

Konfigurasi aman secara default. kylat doctor gagal di CI bila tidak aman.

2. Endpoint

POST /_kylat/call: aksi mutasi dan baca yang tidak di-cache. Batch.

GET /_kylat/read/{aksi}?args=...: hanya untuk aksi baca yang ditandai read: true. Bisa di-cache, tetapi hanya untuk data publik yang ditandai public: true.

GET /_kylat/schema: skema kontrak untuk sync dan tipe client.

3. Header wajib

Header

Fungsi

X-Kylat-Build

Build ID client. Server membalas STALE_BUILD bila tidak kompatibel

X-CSRF-Token

Wajib pada mode cookie untuk request mutasi

Idempotency-Key

Wajib untuk mutasi. Disimpan dengan TTL 24 jam, terikat ke pengguna dan aksi

Authorization

Bearer token pada mode token

4. Format batch

Request:{  "calls": [    { "id": "c1", "action": "ProductFilter.addToCart", "args": { "productId": "42" } }  ]}Response:{  "results": [    { "id": "c1", "ok": true, "data": { ... } },    { "id": "c2", "ok": false, "error": { "type": "kylat:validation", "errors": [...] } }  ]}

Batch maksimal 20 panggilan (lihat batas di bagian 7).

ID panggilan unik per batch. Client mendeduplikasi panggilan identik dalam jendela waktu pendek.

ID besar dikirim sebagai string. Uang dikirim sebagai integer unit terkecil atau string desimal.

5. Kode galat dan format error

Model kegagalan (menjawab K-02): kegagalan per panggilan dikembalikan di dalam hasil batch dengan HTTP 200 dan ok false. Kegagalan level request (autentikasi, format, ukuran body, CSRF, build tidak kompatibel, rate limit) memakai HTTP status dan RFC 9457 Problem Details. Kode tipe stabil:

kylat:validation (per panggilan, HTTP 200): daftar galat per field dengan JSON Pointer

kylat:unauthorized (401) dan kylat:forbidden (403)

kylat:stale_build (409): client harus reload dengan tenang

kylat:rate_limited (429)

kylat:server_error (500): pesan generik dengan ID korelasi, tanpa stack trace

Contoh validasi:

ok: false (HTTP 200, di dalam hasil panggilan)type: kylat:validationtitle: Validasi gagalerrors:  - pointer: /calls/0/args/qty    code: min    message: Minimal 1

6. Autentikasi: dua mode

Mode

Syarat

Kontrol wajib

Cookie

SPA dan API berbagi top-level domain (same-site)

Cookie HttpOnly, Secure, SameSite. Rotasi sesi saat login. Token CSRF. Cek Origin dan Sec-Fetch-Site. GET tidak pernah mengubah state

Token

Beda domain atau mobile

Access token umur 15 menit, refresh token dirotasi. Token tidak disimpan di localStorage secara default. Pilihan penyimpanan lain harus eksplisit dan terdokumentasi

Cookie tidak mencegah caching. Set-Cookie tidak dianggap sebagai pembatas caching.

7. Batas runtime (default awal, dikalibrasi lewat beban nyata)

Batas

Nilai awal

Ukuran body

256 KB

Kedalaman JSON

16

Panggilan per batch

20

Elemen per array

1.000

Panjang string per field

10.000 karakter

Timeout aksi server

10 detik, lebih dari itu dipindah ke antrean

Rate limit mutasi

60 per menit per akun, 20 per menit per IP anonim

Umur idempotency key

24 jam

8. Validasi empat lapis

Skema tipe dari signature aksi. Wajib di server, opsional di client.

Aturan bisnis.

Otorisasi per objek dan per fungsi.

Invarian database (unique, foreign key).

Tanpa koersi implisit: string "1" bukan integer.

additionalProperties: false. Null hanya bila tipe nullable.

Tolak NaN dan Infinity. String harus UTF-8 valid dan dinormalisasi NFC.

Enum tertutup. Tanggal hanya RFC 3339.

Validasi ganda: aturan subset dikompilasi ke client untuk umpan balik instan, tetapi server selalu memvalidasi ulang dan menjadi otoritas.

9. Aturan keamanan yang tidak boleh dilanggar

Tidak ada eval, new Function, unserialize, atau refleksi dinamis atas input.

Server selalu otoritas. Client tidak pernah dipercaya.

Setiap aksi punya otorisasi eksplisit, validasi skema, batas, dan idempotency untuk mutasi.

Default deny.

Tidak ada rahasia di client. Hanya variabel berawalan PUBLIC_ yang di-embed.

Respons terautentikasi atau personal tidak pernah di-cache bersama (private atau no-store).

DOM hanya ditulis lewat API aman. HTML mentah hanya lewat Trusted Types dengan sanitizer terawat.

Dependensi runtime minimum, di-pin, dan tanpa install script.

Konfigurasi aman secara default. kylat doctor gagal di CI bila tidak aman.

Setiap temuan keamanan menghasilkan satu uji regresi.

10. Cache dan web cache deception

Respons personal atau terautentikasi: Cache-Control: private, no-store.

Vary: Cookie bukan batas otorisasi.

Path endpoint baca tidak boleh berakhiran ekstensi statis.

Error dan redirect punya kebijakan cache eksplisit.

Aturan ini mengikuti OWASP Web Cache Security Cheat Sheet.

11. Katalog ancaman ringkas

ID

Ancaman

Kontrol utama

A1

Deserialisasi tak aman (pola Livewire CVE-2025-54068, React2Shell)

JSON polos, skema ketat, tanpa unserialize

A2

Prototype pollution

Tolak __proto__, constructor, prototype. Map untuk data dinamis

A3

Payload bomb dan ReDoS

Batas di bagian 7, regex dari daftar aman

A4

Replay dan klik ganda

Idempotency key (wajib 8–128 karakter, 8 aturan normatif di §11.1)

A5

Mass assignment (OWASP API3)

DTO eksplisit, serialisasi allowlist

B1

BOLA (OWASP API1)

authorize per objek, kylat check gagal bila tidak ada

B2

BFLA (OWASP API5)

Default deny per aksi dan per peran

B3

Pencurian sesi atau token, session fixation

Flag cookie, rotasi, token pendek

B4

CSRF

Token, cek Origin dan Sec-Fetch-Site

B5

Brute force dan bisnis sensitif (OWASP API6)

Rate limit per aksi, akun, dan IP

C1

DOM XSS

textContent dan setAttribute. Trusted Types, require-trusted-types-for 'script' (Baseline 2026)

C2

XSS lewat URL dan atribut

Allowlist skema URL. Atribut on* tidak dinamis

C3

Injeksi template dari input

Kompilasi hanya saat build. CSP tanpa unsafe-eval

D1

Web cache deception dan poisoning

Lihat bagian 10

D2

CORS salah

Allowlist origin eksplisit

D3

SSRF (OWASP API7)

Helper HTTP aman, blokir IP privat dan metadata cloud

D4

DoS dan denial of wallet (OWASP API4)

Rate limit, batas batch, timeout, antrean

E1

Paket npm atau Composer dikompromikan (Shai-Hulud, Mini Shai-Hulud)

Dependensi minimum, pin, minimumReleaseAge, tanpa install script

E2

Rilis Kylat dibajak

Rilis dari CI terisolasi dengan OIDC, 2FA, review dua orang

F1

Kerentanan runtime PHP (PHP2Shell, patch 21 Oktober 2026)

kylat doctor memeriksa versi minimum. Restart worker setelah patch. WAF bukan pengganti patch

G1

Perbedaan validasi client dan server

Server otoritas. Differential test

G9

Prompt injection pada agen AI pengembang

Agen tidak menjalankan instruksi dari data. Perubahan keamanan wajib review manusia

Katalog lengkap (sekitar 40 ancaman) ada di dokumen perancangan bagian 19.

11.1 Idempotensi mutasi (kontrak protokol)

Kontrak ini normatif untuk semua implementasi Kylat. Cara penjaminannya ditentukan oleh adapter dan didokumentasikan sebagai referensi non-normatif.

1. Setiap panggilan mutasi wajib membawa `Idempotency-Key` dengan panjang 8 sampai 128 karakter.
2. Identitas idempotensi adalah pasangan (identitas pemanggil, key). Key yang sama dari pemanggil lain tidak boleh berbagi hasil.
3. Hash permintaan adalah SHA-256 atas representasi JSON kanonikal (RFC 8785) dari `action` dan `args`. Key yang sama dengan hash berbeda ditolak dengan `kylat:idempotency_conflict`.
4. Permintaan ulang dengan key dan hash yang sama, untuk mutasi yang sudah berhasil, mengembalikan hasil yang sama tanpa mengeksekusi ulang.
5. Adapter wajib menjamin bahwa efek samping mutasi terjadi paling banyak sekali untuk satu pasangan identitas dan key, termasuk saat terjadi crash atau retry paralel.
6. Hasil yang dikembalikan tidak boleh berisi rahasia atau kredensial.
7. Key berlaku 24 jam. Setelah itu boleh dipakai ulang, dan klien tidak boleh mengirim key yang lebih tua dari itu.
8. Hasil mutasi yang tidak dapat dijamin tersimpan untuk replay tidak boleh dianggap berhasil. Dalam kondisi itu, adapter wajib membatalkan mutasi dan membalas galat.

12. Pelajaran dari insiden

Livewire CVE-2025-54068 (v3 hingga 3.6.3, diperbaiki 3.6.4, CVSS 9.8, masuk daftar KEV CISA): hydration properti yang bisa dimanipulasi. Tanda tangan APP_KEY tidak cukup sebagai pertahanan. Pelajaran: tipe ditegakkan persis, tanpa hydration generik.

React2Shell CVE-2025-55182 (React 19.0.0 hingga 19.2.0, CVSS 10.0, KEV): deserialisasi tak aman di protokol Flight. Pelajaran: jangan membuat format serialisasi kaya.

PHP2Shell CVE-2026-109618 dan CVE-2026-109619: patch dirilis 21 Oktober 2026 untuk PHP 8.5.12, 8.4.27, 8.3.36, dan 8.2.35. PHP 8.1 ke bawah sudah tidak didukung. Pelajaran: Kylat tidak bisa memitigasi runtime PHP, jadi kebijakan versi minimum wajib.

Shai-Hulud dan Mini Shai-Hulud: worm npm yang menghasilkan paket dengan provenance valid karena membajak pipeline rilis. Pelajaran: provenance tidak cukup, perlu jeda rilis minimum dan blokir install script.

Catatan: sebagian sumber insiden berasal dari laporan sekunder. Verifikasi ke advisory resmi sebelum rilis 1.0.

Revisi P0: contoh batch dan kode galat disesuaikan dengan model kegagalan di atas (K-02). Bila ID dikirim sebagai string, skema parameter ID wajib string (K-03, lihat dokumen 4 bagian 2).