# ADR 0020: Penutupan Fase 3 — Optimistic, Generator Tipe, Outbox Command, dan E2E CSP

- **Status**: DITERIMA
- **Tanggal**: 13 November 2026
- **Penulis**: Arsitek Toolchain
- **Konteks**: ADR 0015 menetapkan gerbang Fase 3; ADR 0017–0019 menutup kontrak GET, operasional, dan idempotensi/outbox.

---

## 1. Keputusan

Fase 3 ditutup dengan empat penambahan:

### 1.1 Optimistic update dan rollback

- `beginOptimistic(get, set, next)` menerapkan nilai segera dan mengembalikan handle `commit`/`rollback` idempoten.
- `withOptimistic(get, set, next, operation)` melakukan rollback otomatis saat operasi gagal dan rekonsiliasi bila server mengembalikan nilai.
- `RpcBatcher.call()` menerima `options.optimistic = { apply, rollback }`:
  - `apply` dipanggil sinkron sebelum request masuk antrean;
  - `rollback` dipanggil tepat sekali bila call berakhir gagal (termasuk `apply` yang melempar error);
  - sukses tidak memicu rollback.

### 1.2 Generator tipe dan `sync-contract`

- Perintah `kylat types <schema.json|-> [--out file] [--check]`.
- Input: respons `GET /_kylat/schema` (`protocol`, `build`, `actions[]`).
- Output: modul TypeScript deterministik berisi `KylatActionMap`, `KylatActionName`, dan `callKylatAction()`.
- `--check` membandingkan hasil generate dengan file yang ada; exit 1 bila drift. Ini menjadi gerbang `sync-contract` di CI.
- Pemetaan tipe: `int`/`float` → `number`, `bool` → `boolean`, `array<T>` → `T[]`, `array<K,V>` → `Record<K,V>`, `?T` → `T | null`, tipe tak dikenal → `unknown`.

### 1.3 Outbox command

- `kylat:outbox:relay` (Artisan) menjalankan `OutboxRelayRunner` sekali; cocok untuk scheduler setiap menit atau supervisor loop.
- `OutboxHandlerRegistry` memetakan `event_type` ke handler idempotent; handler menerima `(payload, event)` dan wajib memakai `event_id` untuk deduplikasi.
- Opsi: `--max`, `--max-attempts`, `--lease`.
- Semantik tetap **at-least-once**; bukan exactly-once.

### 1.4 E2E keranjang dengan CSP ketat

- Contoh `examples/05-cart-csp`: Cart SFC, server RPC, dan halaman tanpa inline script/style.
- CSP: `default-src 'none'; script-src 'self' 'sha256-<importmap>'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'`.
- Import map inline diizinkan lewat hash SHA-256; tidak ada `unsafe-inline`/`unsafe-eval`.
- E2E WebKit memverifikasi: halaman termuat, update lokal optimistis, RPC menyimpan ke server, inline script canary diblokir, dan tidak ada page error.

### 1.5 Rate limit Redis multi-worker

- `RedisRateLimiter` memakai skrip Lua atomik (`GET`/`INCRBY`/`EXPIRE`).
- `KylatRateLimiter` memakai `Illuminate\Cache\RateLimiter` bila tersedia; jika tidak, memakai phpredis + Lua saat `kylat.rate_limit_store=redis`; fallback in-memory tetap dilarang di produksi.
- Uji dua proses pada Redis nyata memverifikasi limit 50 menghasilkan tepat 50 allowed dan 30 rejected.

## 2. Bukti

| Item | Bukti |
|---|---|
| Optimistic/rollback | `packages/runtime/test/optimistic.test.mjs` (8 kasus) |
| Generator tipe | `packages/cli/test/types.test.mjs` (5 kasus) + `--check` |
| Outbox command | `packages/adapter-laravel/test/OutboxCommandTest.php` |
| E2E CSP | `examples/05-cart-csp/cart.pw.mjs` (WebKit) |
| Redis multi-worker | `packages/adapter-laravel/test/RedisRateLimitTest.php` + service Redis di CI |
| Idempotensi DB | MySQL 8.4/PostgreSQL 18.4 lokal + CI MySQL 8.0/PG 15 |

## 3. Konsekuensi

- Gerbang Fase 3 ADR 0015 terpenuhi: conformance hijau, konkurensi database nyata hijau, optimistic/rollback ada, generator tipe + `--check`, E2E CSP ketat, GET tidak mengubah state, default-deny tetap.
- Outbox tetap at-least-once; handler wajib idempotent.
- `kylat types` bergantung pada schema yang dihasilkan adapter; schema auth-only sehingga pengambilan schema memerlukan sesi/CI service account.
- Import map inline memerlukan hash CSP; bila host memakai bundler, import map dapat dihapus dan `script-src 'self'` cukup.
