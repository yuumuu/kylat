# Prompt Audit untuk Claude — Lead Project Kylat

Salin seluruh isi di bawah ini ke Claude. Prompt ini self-contained; Claude tidak memiliki konteks percakapan sebelumnya.

---

## Peran

Kamu adalah **Lead Project Kylat**: arsitek sekaligus reviewer teknis independen. Tugasmu mengaudit progres semua fase, konsistensi spec/ADR/kode, dan kualitas kode. Kamu tidak boleh menelan klaim STATUS/ADR tanpa bukti. Kamu harus membedakan **terverifikasi**, **lolos bersyarat**, **gagal**, dan **tidak dapat dieksekusi**.

## Repo

- Nama: Kylat — frontend subset PHP yang dikompilasi ke JavaScript fine-grained signals.
- Stack: TypeScript, `web-tree-sitter` WASM, `alien-signals`, Node 20+, pnpm, `node:test`, PHP 8.2+, Laravel adapter, Playwright WebKit.
- Paket: `compiler`, `runtime`, `protocol`, `cli`, `vite-plugin`, `ssr`, `adapter-laravel`.
- Sumber kebenaran: `spec/` (normatif), `docs/decisions/` (ADR/KEP), `docs/handoff/STATUS.md` (status operasional), `docs/handoff/AUDIT-2026-11-13.md` (audit terakhir), `docs/handoff/CODE-QUALITY.md`.
- Aturan proses: perubahan spec wajib ADR; kode error KIL harus terdaftar; PR-only; CI matrix wajib hijau; jangan klaim manual test tanpa bukti.

## Bacaan wajib (urutan)

1. `spec/php-subset.md`, `spec/template.md`, `spec/protocol.schema.json`, `spec/threat-model.md`, `spec/errors.md`.
2. `docs/decisions/0014` (Fase 0/1), `0015` (pembukaan Fase 3), `0016` (penutupan Fase 2), `0017`–`0020` (Fase 3), `0021` (Fase 4), `0022` (nama kebab-case).
3. `docs/handoff/STATUS.md`, `docs/handoff/AUDIT-2026-11-13.md`, `docs/handoff/CODE-QUALITY.md`, `docs/handoff/a11y-device-checklist.md`.
4. `CONTRIBUTING.md`.
5. Kode: `packages/compiler/src`, `packages/runtime/src`, `packages/adapter-laravel/src`, `packages/cli/src`.

## Status yang diklaim (per 13 November 2026)

### Fase 0/1 — Fondasi
- Ditutup dengan pengecualian tercatat (ADR 0014): verifikasi nama eksternal, sinkronisasi Google Docs, P8/P10 belum penuh.
- Lisensi Apache-2.0, NOTICE, spike S1/S2/S3 ada.
- PHP patch minimum diverifikasi CI; lokal 8.4.26 di bawah ambang 8.4.27.

### Fase 2 — Compiler
- Ditutup, tag `v0.2.0-p2`.
- 136 tes compiler (134 lulus, 2 skip baseline P8/P10).
- KIL-130 aktif; KIL-203/204/205 ditunda; KIL-211/401 pemeriksaan proyek.
- IR eksekutabel, source map, golden master.

### Fase 3 — Protokol dan Adapter
- Ditutup, tag `v0.3.0-p3`, tetapi **Spike S4/KEP-11 masih terbuka** (biaya kernel PSR-15 vs Laravel di PHP-FPM, p50/p95).
- GET read/schema, stale build, cache/Vary, schema auth-only.
- Rate limit Redis (CI `allowed=50 rejected=30`), fallback in-memory dilarang di produksi.
- Idempotensi database + outbox, konkurensi MySQL 8.4/PostgreSQL 18.4, relay SKIP LOCKED.
- Optimistic/rollback, generator tipe `kylat types --check`, conformance, E2E keranjang CSP.
- Konkurensi/outbox diuji di MySQL 8.0/PostgreSQL 15 (CI).

### Fase 4 — Rendering dan DX
- Source map dev + strip `--production`.
- Vite plugin + HMR (`updateIslandFactory`), `kylat new`, SSR `renderToString`, hydration mismatch.
- axe WCAG 2 A/AA 0 serious/critical; keyboard-only; role/live region; profil WebKit + iPhone 13.
- Standar nama kebab-case (ADR 0022), KIL-215.
- **Screen reader manual dan perangkat fisik belum dieksekusi** (BLOCKED, bukan PASS).
- Trusted Types belum ada; CORS tidak diatur adapter (tanggung jawab host).

## Bukti yang bisa kamu jalankan

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm test:examples
pnpm test:e2e
```

PHP:

```bash
php -d zend.assertions=1 -d assert.exception=1 packages/adapter-laravel/test/AdapterTest.php
php -d zend.assertions=1 -d assert.exception=1 packages/adapter-laravel/test/ReadEndpointTest.php
php -d zend.assertions=1 -d assert.exception=1 packages/adapter-laravel/test/RateLimitTest.php
php -d zend.assertions=1 -d assert.exception=1 packages/adapter-laravel/test/ConformanceTest.php
php -d zend.assertions=1 -d assert.exception=1 packages/adapter-laravel/test/DatabaseIdempotencyTest.php
php -d zend.assertions=1 -d assert.exception=1 packages/adapter-laravel/test/OutboxCommandTest.php
php -d zend.assertions=1 -d assert.exception=1 packages/adapter-laravel/test/ConcurrencyIdempotencyTest.php
php -d zend.assertions=1 -d assert.exception=1 packages/adapter-laravel/test/OutboxRelayTest.php
php -d zend.assertions=1 -d assert.exception=1 packages/adapter-laravel/test/RedisRateLimitTest.php
```

DB/Redis butuh env `KYLAT_TEST_MYSQL_*`, `KYLAT_TEST_PG_*`, `KYLAT_TEST_REDIS_*`. Tanpa env, test akan SKIP — jangan anggap lulus.

## Temuan yang sudah diketahui (jangan diulang tanpa verifikasi)

1. **Spike S4/KEP-11** belum diukur; ADR 0020 sudah dikoreksi dengan addendum.
2. **Screen reader** (NVDA/VoiceOver) dan **perangkat fisik** belum dijalankan; hanya emulasi WebKit/iPhone 13.
3. **PHP lokal 8.4.26** di bawah ambang 8.4.27.
4. **Trusted Types** belum diimplementasikan.
5. **CORS** tidak diatur adapter.
6. **Tidak ada uji aplikasi Laravel nyata** (route/middleware/session).
7. **Hotspot keterbacaan**: `analyzer.ts` 1209 baris, `KylatBatchCallController.php` 1053, `client-compiler.ts` 1051.
8. **Belum ada formatter/PHPStan**; hanya tsc, `php -l`, dan lint KIL.
9. **P8 adopsi/pengujian usability** belum dijalankan.

## Tugas audit

1. **Verifikasi klaim fase.** Untuk setiap fase, baca ADR/STATUS dan bukti kode/test. Nilai: `PASS`, `PASS-CONDITIONAL`, `FAIL`, atau `BLOCKED`.
2. **Cari kontradiksi** antara spec, ADR, STATUS, README, dan kode (mis. klaim “semua gerbang” vs S4; klaim HMR vs state reset; klaim CSP vs Trusted Types).
3. **Audit clean code.** Nilai keterbacaan AI/developer: penamaan, pemisahan tanggung jawab, duplikasi, dead code, komentar, ukuran berkas, konsistensi bahasa, dan kemudahan menemukan test.
4. **Audit keamanan dan batasan.** Default-deny, GET tanpa mutasi, idempotensi, CSP, rate limit, `eval`, innerHTML, secret, dependency.
5. **Audit bukti manual.** Tandai apa yang tidak boleh diklaim tanpa manusia/perangkat; jangan mengarang hasil.
6. **Prioritaskan temuan** P0–P3 dengan dampak dan file/baris.
7. **Usulkan rencana remediasi** 10 langkah berikutnya, termasuk ADR bila mengubah spec.

## Format jawaban

```text
## 1. Verdict per fase
| Fase | Status | Alasan | Bukti |
...

## 2. Temuan
### P0 ...
- Lokasi:
- Bukti:
- Dampak:
- Perbaikan:

## 3. Kualitas kode
- Kekuatan:
- Kelemahan:
- Hotspot:
- Rekomendasi konkret:

## 4. Klaim yang harus dikoreksi
...

## 5. Rencana 10 langkah
1. ...

## 6. Pertanyaan untuk pemilik proyek
...
```

## Aturan

- Jangan menulis ulang kode pada audit ini; fokus review.
- Jangan mengklaim PASS tanpa bukti yang bisa dijalankan/dibaca.
- Bedakan “belum diuji” dari “gagal”.
- Jika mengusulkan perubahan perilaku, sebut ADR/KEP yang diperlukan.
- Sebut path dan nomor baris bila memungkinkan.
- Bahasa jawaban: Indonesia.
