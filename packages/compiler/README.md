# `@kylat/compiler`

Mem-parse komponen Kylat (subset PHP + markup), menganalisis tipe, membangun IR, lalu menghasilkan JavaScript dan manifest.

| Direktori | Isi |
|---|---|
| `src/parse/` | Parser PHP subset dan parser templat |
| `src/analyze/` | Analisis tipe, resolusi sinyal, penegakan KIL-1xx |
| `src/ir/` | Bentuk IR yang bebas dari PHP |
| `src/codegen/` | Emisi DOM langsung yang terikat ke signal, bukan virtual DOM |
| `src/diagnostics/` | Kode KIL-xxx, lokasi, saran perbaikan |
| `tests/golden/` | Snapshot keluaran compiler |
| `tests/differential/` | PHP vs JS untuk ekspresi dan fungsi allowlist |

**Bergantung pada:** `spec/php-subset.md`, `spec/template.md`, `spec/errors.md`.

**Belum diputuskan:** parser PHP (spike S1), apakah parser templat berbagi AST dengan parser PHP, dan bentuk IR final (`spec/ir.md` belum ditulis).
