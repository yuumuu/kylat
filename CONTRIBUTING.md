# Contributing ke Kylat

Dokumen ini untuk developer dan AI agent yang bekerja di repo ini. Baca berurutan:

1. `spec/` — kontrak normatif (bahasa, template, protokol, threat model).
2. `docs/decisions/` — ADR/KEP; perubahan spec wajib lewat ADR.
3. `docs/handoff/STATUS.md` — status fase dan pekerjaan berikutnya.
4. Paket yang relevan di `packages/`.

## Prasyarat

- Node.js >= 20, pnpm 11
- PHP >= 8.2 dengan patch minimum di `kylat doctor` (PHP2Shell)
- MySQL 8+ / PostgreSQL 15+ / Redis 7 untuk uji integrasi (opsional secara lokal)

## Perintah

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm test:examples     # counter E2E
pnpm test:e2e          # cart CSP + aksesibilitas (Playwright)
```

PHP adapter:

```bash
php -d zend.assertions=1 -d assert.exception=1 packages/adapter-laravel/test/AdapterTest.php
php -d zend.assertions=1 -d assert.exception=1 packages/adapter-laravel/test/ConcurrencyIdempotencyTest.php
php -d zend.assertions=1 -d assert.exception=1 packages/adapter-laravel/test/OutboxRelayTest.php
```

Uji database/Redis memakai env `KYLAT_TEST_MYSQL_*`, `KYLAT_TEST_PG_*`, `KYLAT_TEST_REDIS_*` dan skip bila tidak diatur.

## Peta repo

| Path | Isi |
|---|---|
| `packages/compiler` | Parser PHP subset, analyzer KIL, template parser, codegen, source map |
| `packages/runtime` | Signals, DOM binding, RPC batch, island/hydration, optimistic |
| `packages/protocol` | Tipe wire dan konstanta protokol |
| `packages/cli` | `kylat new`, `make:component`, `check`, `build`, `types`, `doctor` |
| `packages/vite-plugin` | Kompilasi dev/build + HMR |
| `packages/ssr` | `renderToString` dan uji hydration mismatch |
| `packages/adapter-laravel` | Route RPC, idempotensi, outbox, rate limit |
| `examples/` | Contoh yang dijalankan CI |
| `spec/` | Sumber kebenaran perilaku |
| `docs/decisions/` | ADR/KEP |

## Invarian yang tidak boleh dilanggar

- `spec/` adalah normatif. Jangan mengubah perilaku yang bertentangan tanpa ADR.
- Setiap kode error `KIL-*` harus terdaftar di `spec/errors.md` sebelum dipakai.
- Aksi `#[Server]` wajib punya `authorize()` default-deny.
- Dilarang `eval()`, `new Function()`, atau `innerHTML` untuk output pengguna.
- Nama berkas komponen **kebab-case** (`cart-product.kylat.php`), class PascalCase (`CartProduct`) — ADR 0022.
- GET tidak boleh mengubah state; hanya aksi `#[Server(read: true)]`.
- Idempotensi: database di produksi, cache hanya interim.
- Outbox bersifat at-least-once; handler wajib idempotent memakai `event_id`.
- Jangan menambah dependency baru tanpa alasan dan tanpa memperbarui lockfile.

## Gaya kode

### TypeScript

- `strict` aktif. Hindari `any`; gunakan `unknown` + penyempitan.
- Import relatif memakai ekstensi `.js` (ESM).
- Ekspor dari `src/index.ts`; jangan mengekspor internal yang tidak perlu.
- Test memakai `node:test` di `test/*.test.mjs`; impor dari `dist/`.

### PHP

- `declare(strict_types=1);` di semua berkas.
- Class `final` bila tidak dimaksudkan untuk diwariskan.
- Docblock untuk array shape yang tidak bisa diekspresikan tipe native.
- Tidak ada `var_dump`/`dd()` di kode produksi.
- Query SQL portabel MySQL/PostgreSQL; jangan memakai `INSERT IGNORE`.

### Komentar

- Komentar menjelaskan **mengapa**, bukan mengulang kode.
- Bahasa komentar mengikuti berkas sekitarnya (Indonesia/Inggris konsisten per berkas).

## Menambah fitur

1. Tulis/ubah spec atau ADR lebih dulu bila perilaku berubah.
2. Tambahkan kode error KIL baru ke `spec/errors.md`.
3. Implementasi + test unit.
4. Untuk perubahan kontrak: perbarui `spec/protocol.schema.json` dan tipe `@kylat/protocol`.
5. Untuk perubahan adapter: tambahkan test di `packages/adapter-laravel/test/`.
6. Jalankan seluruh gate lokal; buka PR; tunggu CI hijau.

## Audit

- Checklist manual: `docs/handoff/a11y-device-checklist.md`.
- Laporan audit terakhir: `docs/handoff/AUDIT-2026-11-13.md`.
- Kualitas kode: `docs/handoff/CODE-QUALITY.md`.

## Batasan lingkungan

- Uji database/Redis nyata memerlukan service; tanpa itu test akan skip (bukan lulus).
- Screen reader dan perangkat fisik tidak dapat dijalankan di CI; jangan mengklaim sudah diuji.
