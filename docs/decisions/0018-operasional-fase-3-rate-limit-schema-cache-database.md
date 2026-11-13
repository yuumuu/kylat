# ADR 0018: Keputusan Operasional Fase 3 — Rate Limit, Schema, Cache, dan Database

- **Status**: DITERIMA
- **Tanggal**: 13 November 2026
- **Penulis**: Pemilik proyek + Arsitek Toolchain
- **Konteks**: Implementasi rate limit/conformance Fase 3 membutuhkan keputusan operasional yang mengikat.

---

## 1. Rate limit produksi

- Produksi memakai **`RateLimiter` Laravel dengan store Redis**.
- Fallback in-memory hanya untuk **test dan development**; tidak boleh dianggap sebagai rate limit produksi.
- Alasan: pada PHP-FPM/Octane multi-worker, memori per proses tidak berbagi hitungan sehingga limit mudah dilewati. Redis lebih cocok untuk pengecekan sering; database store boleh sebagai alternatif, tetapi bukan default.
- Batas awal tetap mengikuti Kylat 3 §7: **60 mutasi/menit per akun**, **20 mutasi/menit per IP anonim**.
- Konfigurasi adapter: `KYLAT_RATE_LIMIT_STORE=redis` (default) dan `CACHE_STORE=redis`; batas dapat di-override lewat config `kylat.rate_limit_*`.

## 2. `GET /_kylat/schema`

- Schema bersifat **auth-only**. Handler memeriksa `auth()->check()` dan mengembalikan **401 Problem Details** `urn:kylat:unauthorized`; route tidak memakai middleware `auth` agar tidak terjadi redirect login pada request JSON.
- Alasan: schema membuka nama aksi, tipe parameter, dan struktur kontrak yang berguna untuk pemetaan endpoint oleh penyerang.
- Jika kelak dibutuhkan schema publik untuk dokumentasi, buat **endpoint terpisah** yang hanya memuat aksi `public: true`; jangan melonggarkan endpoint ini.
- Respons schema: `Cache-Control: private, no-store`, `Vary: Cookie`, `X-Content-Type-Options: nosniff`.

## 3. Cache read publik

- `max-age=60` adalah default awal untuk aksi `#[Server(read: true, public: true)]`, dan hanya untuk data publik non-personal.
- Respons personal/terautentikasi wajib `Cache-Control: private, no-store`; `Vary: Cookie` bukan batas otorisasi.
- Respons publik memakai `Cache-Control: public, max-age=60` dan `Vary: Accept-Encoding`; jika ada variasi bahasa, adapter wajib menambah `Vary: Accept-Language`.
- Cache key tidak boleh mengandung identitas pengguna untuk respons publik.

## 4. Database Fase 3

- Target utama: **MySQL**; target uji kedua: **PostgreSQL**.
- Kontrak SQL harus portabel:
  - unique index pada `(user_id, key)`;
  - tanpa `INSERT IGNORE`;
  - tangani error duplikat per driver: **1062** (MySQL), **23505** (PostgreSQL).
- Uji konkurensi wajib dijalankan di MySQL dan PostgreSQL sebelum klaim portabilitas.
- Implementasi tabel/outbox tetap mengikuti ADR 0007 dan harus lewat PR terpisah.

## 5. Konsekuensi

- `KylatRateLimiter` membaca config store/limit dan tidak mengandalkan fallback in-memory di produksi.
- Route schema ditambah middleware `auth`.
- Header cache/Vary diterapkan pada read, schema, dan Problem Details.
- ADR 0007 tetap menjadi rujukan skema database/outbox; ADR ini hanya menetapkan target driver dan aturan portabilitas.
- Tidak ada kode KIL baru.
