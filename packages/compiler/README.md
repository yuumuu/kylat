# `@kylat/compiler`

Mem-parse komponen Kylat (PHP subset + template), menganalisis aturan, membangun IR, lalu menghasilkan JavaScript signals untuk `@kylat/runtime`.

| Berkas | Isi |
|---|---|
| `src/parser.ts` | Inisialisasi web-tree-sitter WASM |
| `src/analyzer.ts` | Analisis kelas, props, state, method, atribut, dan aturan KIL |
| `src/client-compiler.ts` | Compiler AST method client/computed/lifecycle (kontrol alur, closure, assignment) |
| `src/types.ts` | Model tipe v0 dan parser tipe/docblock |
| `src/template-parser.ts` | AST template: teks, ekspresi, `@if`, `@foreach`, elemen |
| `src/expression.ts` | Penerjemah ekspresi PHP subset ke JavaScript |
| `src/codegen.ts` | Emisi DOM langsung + binding signals |
| `src/source-map.ts` | Source map v3 line-level untuk debugging |
| `src/diagnostics.ts` | Kode KIL dan pesan |

## Cakupan Fase 2

- Kontrol alur `if`/`elseif`/`else`, `foreach`, `for`, dan `return` dini.
- Closure/arrow function dan pemanggilan closure lokal.
- `#[Computed]`, `#[OnMount]`, dan `#[Effect]` menghasilkan sinyal/efek runtime.
- Analisis tipe property, parameter, return, nullable, `list<T>`, dan `array<string,T>`.
- Differential test PHP vs JavaScript untuk operator, string UTF-8, array, dan null coalescing.
- Setiap hasil kompilasi menyertakan `map` berisi source map v3.
- `match` tetap KIL-104; `usort` ditunda dan ditolak KIL-110 sesuai ADR 0011.

**Dependensi:** `spec/php-subset.md`, `spec/template.md`, `spec/errors.md`, `spec/ir.md`.

**Test:** `node --test test/*.test.mjs` (setelah `pnpm build`). Differential test membutuhkan `php` di `PATH`; CI menyediakannya.
