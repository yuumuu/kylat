# examples/

Daftar contoh aplikasi referensi Kylat:

| Direktori | Deskripsi | Format & Pengujian |
|---|---|---|
| `01-counter/` | Aplikasi Counter Single-File (E2E) | Komponen Single-File resmi (`Counter.kylat.php`, KEP-34), aksi server RPC, dan pengujian end-to-end (`pnpm test:examples`). |

Fixture pengujian internal compiler (golden master, regression guard, dan kontrak legacy) disimpan secara terpisah di `packages/compiler/test/fixtures/`.

Untuk membuat komponen baru dengan format single-file standar:

```bash
node packages/cli/bin/kylat.js make:component MyComponent
```
