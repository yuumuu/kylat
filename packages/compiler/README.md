# `@kylat/compiler`

Mem-parse komponen Kylat (PHP subset + template), menganalisis aturan, membangun IR, lalu menghasilkan JavaScript signals untuk `@kylat/runtime`.

| Berkas | Isi |
|---|---|
| `src/parser.ts` | Inisialisasi web-tree-sitter WASM |
| `src/analyzer.ts` | Analisis kelas, props, state, method, atribut |
| `src/template-parser.ts` | AST template: teks, ekspresi, `@if`, `@foreach`, elemen |
| `src/expression.ts` | Penerjemah ekspresi PHP subset ke JavaScript |
| `src/codegen.ts` | Emisi DOM langsung + binding signals |
| `src/diagnostics.ts` | Kode KIL dan pesan |

**Dependensi:** `spec/php-subset.md`, `spec/template.md`, `spec/errors.md`, `spec/ir.md`.

**Test:** `node --test test/*.test.mjs` (setelah `pnpm build`).
