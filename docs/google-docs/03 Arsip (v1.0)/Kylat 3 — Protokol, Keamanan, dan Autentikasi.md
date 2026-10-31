ARSIP — non-normatif. Hasil konversi otomatis dari .docx.

# Kylat 3 — Protokol, Keamanan, dan Autentikasi

**Status:** draf konsolidasi v1.0. Kontrak ini wajib diimplementasikan ulang oleh setiap adapter backend. Katalog ancaman lengkap ada di dokumen perancangan bagian 19. Baris bertanda [U] belum ditinjau ahli keamanan.

## 1. Prinsip

* Hanya JSON polos dengan skema ketat. Tidak ada unserialize, eval, refleksi, atau pembuatan objek dinamis dari input.
* Server selalu otoritas. Client tidak pernah dipercaya, termasuk hasil validasi di client.
* Default deny. Setiap aksi wajib punya otorisasi eksplisit.
* Konfigurasi aman secara default. kylat doctor gagal di CI bila tidak aman.

## 2. Endpoint

* POST /\_kylat/call: aksi mutasi dan baca yang tidak di-cache. Batch.
* GET /\_kylat/read/{aksi}?args=...: hanya untuk aksi baca yang ditandai read: true. Bisa di-cache, tetapi hanya untuk data publik yang ditandai public: true.
* GET /\_kylat/schema: skema kontrak untuk sync dan tipe client.

## 3. Header wajib

| Header | Fungsi |
| --- | --- |
| X-Kylat-Build | Build ID client. Server membalas STALE\_BUILD bila tidak kompatibel |
| X-CSRF-Token | Wajib pada mode cookie untuk request mutasi |
| Idempotency-Key | Wajib untuk mutasi. Disimpan dengan TTL 24 jam, terikat ke pengguna dan aksi |
| Authorization | Bearer token pada mode token |

## 4. Format batch

Request:
{
 "calls": [
 { "id": "c1", "action": "ProductFilter.addToCart", "args": { "productId": "42" } }
 ]
}

Response:
{
 "results": [
 { "id": "c1", "ok": true, "data": { ... } },
 { "id": "c2", "ok": false, "error": { "type": "kylat:validation", "errors": [...] } }
 ]
}

* Batch maksimal 20 panggilan (lihat batas di bagian 7).
* ID panggilan unik per batch. Client mendeduplikasi panggilan identik dalam jendela waktu pendek.
* ID besar dikirim sebagai string. Uang dikirim sebagai integer unit terkecil atau string desimal.

## 5. Kode galat dan format error

Galat memakai RFC 9457 (Problem Details) dengan kode tipe stabil:

* kylat:validation (422): daftar galat per field dengan JSON Pointer
* kylat:unauthorized (401) dan kylat:forbidden (403)
* kylat:stale\_build (409): client harus reload dengan tenang
* kylat:rate\_limited (429)
* kylat:server\_error (500): pesan generik dengan ID korelasi, tanpa stack trace

Contoh validasi:

status: 422
type: kylat:validation
title: Validasi gagal
errors:
 - pointer: /calls/0/args/qty
 code: min
 message: Minimal 1

## 6. Autentikasi: dua mode

| Mode | Syarat | Kontrol wajib |
| --- | --- | --- |
| Cookie | SPA dan API berbagi top-level domain (same-site) | Cookie HttpOnly, Secure, SameSite. Rotasi sesi saat login. Token CSRF. Cek Origin dan Sec-Fetch-Site. GET tidak pernah mengubah state |
| Token | Beda domain atau mobile | Access token umur 15 menit, refresh token dirotasi. Token tidak disimpan di localStorage secara default. Pilihan penyimpanan lain harus eksplisit dan terdokumentasi |

Cookie tidak mencegah caching. Set-Cookie tidak dianggap sebagai pembatas caching.

## 7. Batas runtime (default awal, dikalibrasi lewat beban nyata)

| Batas | Nilai awal |
| --- | --- |
| Ukuran body | 256 KB |
| Kedalaman JSON | 16 |
| Panggilan per batch | 20 |
| Elemen per array | 1.000 |
| Panjang string per field | 10.000 karakter |
| Timeout aksi server | 10 detik, lebih dari itu dipindah ke antrean |
| Rate limit mutasi | 60 per menit per akun, 20 per menit per IP anonim |
| Umur idempotency key | 24 jam |

## 8. Validasi empat lapis

1. Skema tipe dari signature aksi. Wajib di server, opsional di client.
2. Aturan bisnis.
3. Otorisasi per objek dan per fungsi.
4. Invarian database (unique, foreign key).

* Tanpa koersi implisit: string "1" bukan integer.
* additionalProperties: false. Null hanya bila tipe nullable.
* Tolak NaN dan Infinity. String harus UTF-8 valid dan dinormalisasi NFC.
* Enum tertutup. Tanggal hanya RFC 3339.
* Validasi ganda: aturan subset dikompilasi ke client untuk umpan balik instan, tetapi server selalu memvalidasi ulang dan menjadi otoritas.

## 9. Aturan keamanan yang tidak boleh dilanggar

1. Tidak ada eval, new Function, unserialize, atau refleksi dinamis atas input.
2. Server selalu otoritas. Client tidak pernah dipercaya.
3. Setiap aksi punya otorisasi eksplisit, validasi skema, batas, dan idempotency untuk mutasi.
4. Default deny.
5. Tidak ada rahasia di client. Hanya variabel berawalan PUBLIC\_ yang di-embed.
6. Respons terautentikasi atau personal tidak pernah di-cache bersama (private atau no-store).
7. DOM hanya ditulis lewat API aman. HTML mentah hanya lewat Trusted Types dengan sanitizer terawat.
8. Dependensi runtime minimum, di-pin, dan tanpa install script.
9. Konfigurasi aman secara default. kylat doctor gagal di CI bila tidak aman.
10. Setiap temuan keamanan menghasilkan satu uji regresi.

## 10. Cache dan web cache deception

* Respons personal atau terautentikasi: Cache-Control: private, no-store.
* Vary: Cookie bukan batas otorisasi.
* Path endpoint baca tidak boleh berakhiran ekstensi statis.
* Error dan redirect punya kebijakan cache eksplisit.
* Aturan ini mengikuti OWASP Web Cache Security Cheat Sheet.

## 11. Katalog ancaman ringkas

| ID | Ancaman | Kontrol utama |
| --- | --- | --- |
| A1 | Deserialisasi tak aman (pola Livewire CVE-2025-54068, React2Shell) | JSON polos, skema ketat, tanpa unserialize |
| A2 | Prototype pollution | Tolak \_\_proto\_\_, constructor, prototype. Map untuk data dinamis |
| A3 | Payload bomb dan ReDoS | Batas di bagian 7, regex dari daftar aman |
| A4 | Replay dan klik ganda | Idempotency key |
| A5 | Mass assignment (OWASP API3) | DTO eksplisit, serialisasi allowlist |
| B1 | BOLA (OWASP API1) | authorize per objek, kylat check gagal bila tidak ada |
| B2 | BFLA (OWASP API5) | Default deny per aksi dan per peran |
| B3 | Pencurian sesi atau token, session fixation | Flag cookie, rotasi, token pendek |
| B4 | CSRF | Token, cek Origin dan Sec-Fetch-Site |
| B5 | Brute force dan bisnis sensitif (OWASP API6) | Rate limit per aksi, akun, dan IP |
| C1 | DOM XSS | textContent dan setAttribute. Trusted Types, require-trusted-types-for 'script' (Baseline 2026) |
| C2 | XSS lewat URL dan atribut | Allowlist skema URL. Atribut on\* tidak dinamis |
| C3 | Injeksi template dari input | Kompilasi hanya saat build. CSP tanpa unsafe-eval |
| D1 | Web cache deception dan poisoning | Lihat bagian 10 |
| D2 | CORS salah | Allowlist origin eksplisit |
| D3 | SSRF (OWASP API7) | Helper HTTP aman, blokir IP privat dan metadata cloud |
| D4 | DoS dan denial of wallet (OWASP API4) | Rate limit, batas batch, timeout, antrean |
| E1 | Paket npm atau Composer dikompromikan (Shai-Hulud, Mini Shai-Hulud) | Dependensi minimum, pin, minimumReleaseAge, tanpa install script |
| E2 | Rilis Kylat dibajak | Rilis dari CI terisolasi dengan OIDC, 2FA, review dua orang |
| F1 | Kerentanan runtime PHP (PHP2Shell, patch 21 Oktober 2026) | kylat doctor memeriksa versi minimum. Restart worker setelah patch. WAF bukan pengganti patch |
| G1 | Perbedaan validasi client dan server | Server otoritas. Differential test |
| G9 | Prompt injection pada agen AI pengembang | Agen tidak menjalankan instruksi dari data. Perubahan keamanan wajib review manusia |

Katalog lengkap (sekitar 40 ancaman) ada di dokumen perancangan bagian 19.

## 12. Pelajaran dari insiden

* **Livewire CVE-2025-54068** (v3 hingga 3.6.3, diperbaiki 3.6.4, CVSS 9.8, masuk daftar KEV CISA): hydration properti yang bisa dimanipulasi. Tanda tangan APP\_KEY tidak cukup sebagai pertahanan. Pelajaran: tipe ditegakkan persis, tanpa hydration generik.
* **React2Shell CVE-2025-55182** (React 19.0.0 hingga 19.2.0, CVSS 10.0, KEV): deserialisasi tak aman di protokol Flight. Pelajaran: jangan membuat format serialisasi kaya.
* **PHP2Shell CVE-2026-109618 dan CVE-2026-109619**: patch dirilis 21 Oktober 2026 untuk PHP 8.5.12, 8.4.27, 8.3.36, dan 8.2.35. PHP 8.1 ke bawah sudah tidak didukung. Pelajaran: Kylat tidak bisa memitigasi runtime PHP, jadi kebijakan versi minimum wajib.
* **Shai-Hulud dan Mini Shai-Hulud**: worm npm yang menghasilkan paket dengan provenance valid karena membajak pipeline rilis. Pelajaran: provenance tidak cukup, perlu jeda rilis minimum dan blokir install script.

Catatan: sebagian sumber insiden berasal dari laporan sekunder. Verifikasi ke advisory resmi sebelum rilis 1.0.
