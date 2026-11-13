# Audit Kualitas Kode — 13 November 2026

Konteks: commit `4b54a68`, sebelum pembersihan terakhir. Tujuan: memastikan kode mudah dibaca AI/developer, bukan sekadar lolos tes.

## 1. Pemeriksaan yang dijalankan

| Pemeriksaan | Hasil |
|---|---|
| `git ls-files --eol` | 239 berkas, semuanya LF di index |
| BOM UTF-8 | 0 berkas |
| `pnpm build` / `typecheck` | lulus |
| `pnpm lint` (KIL codes) | 37/37 |
| `pnpm test` | 197 tes (195 lulus, 2 skip baseline) |
| `php -l` seluruh sumber adapter | lulus (dijalankan per berkas saat perubahan) |
| `composer validate` | `./composer.json is valid` |
| `npm pack --dry-run` | `bin/kylat.js` kini ikut terpaket |
| `pnpm audit --prod` | 0 known vulnerabilities |
| `@ts-ignore` / `: any` / `as any` di `src` | 0 |
| `var_dump` / `dd()` / `dump()` di produksi | 0 |
| `console.log` di runtime/compiler | 0 (hanya CLI, memang output) |
| Duplikasi berkas | fixture legacy `examples/04-cart` vs `compiler/test/fixtures` disengaja |

## 2. Perbaikan yang dilakukan

1. `DatabaseIdempotencyStore::inspectExisting()` tidak lagi memilih kolom `locked_until` yang tidak dipakai.
2. `@kylat/cli` `files` ditambah `bin`; paket npm kini membawa executable.
3. CI menambahkan `kylat doctor`.
4. `CONTRIBUTING.md` ditambahkan: peta repo, invarian, gaya kode, alur fitur, dan batasan lingkungan.
5. ADR 0020/STATUS dikoreksi untuk pengecualian Spike S4.

## 3. Hotspot keterbacaan

| Berkas | Baris | Catatan |
|---|---:|---|
| `packages/compiler/src/analyzer.ts` | 1209 | Analyzer AST; banyak aturan KIL dalam satu pass |
| `packages/adapter-laravel/src/Http/Controllers/KylatBatchCallController.php` | 1053 | Validasi, dispatch, read/schema, Problem Details |
| `packages/compiler/src/client-compiler.ts` | 1051 | Kompilasi method client |
| `packages/compiler/src/codegen.ts` | 797 | Codegen DOM/signals |
| `packages/compiler/src/template-parser.ts` | 593 | Parser template |

Ini bukan bug, tetapi kandidat refactor berikutnya:

- pecah controller menjadi `CallValidator`, `CallDispatcher`, `ReadEndpoint`, `SchemaEndpoint`;
- pecah analyzer per kelompok aturan (struktur, tipe, keamanan client);
- tambahkan komentar modul tingkat atas dan daftar aturan KIL yang ditangani.

## 4. Konvensi yang sudah konsisten

- TypeScript strict, ESM `.js`, test `node:test`.
- PHP `declare(strict_types=1)`, class `final`, docblock array-shape.
- Nama berkas komponen kebab-case; class PascalCase (ADR 0022).
- Bahasa komentar konsisten per berkas; tidak ada komentar mati.
- Dokumentasi status terpusat di `docs/handoff/STATUS.md`.

## 5. Rekomendasi berikutnya

1. Tambahkan formatter (Prettier) dan PHP CS Fixer/PSR-12 di CI.
2. Tambahkan PHPStan level minimal untuk adapter.
3. Refactor controller/analyzer sesuai hotspot di atas.
4. Tambahkan `docs/ARCHITECTURE.md` ringkas dengan diagram alur compile → runtime → adapter.
5. Jadikan `kylat doctor` dan audit ukuran sebagai gate eksplisit di STATUS.
