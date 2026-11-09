# examples/

Daftar contoh aplikasi dan komponen referensi Kylat:

| Direktori | Deskripsi | Format & Pengujian |
|---|---|---|
| `01-counter/` | Aplikasi Counter lengkap (E2E) | Format Single-File (`Counter.kylat.php`, KEP-34) + format legacy dua-berkas (`Counter.php` + `counter.blade.php`). Diuji lewat `pnpm test:examples`. |
| `04-cart/` | Komponen CartCounter dengan Aksi Server | Aksi server RPC `CartActions::add`, verifikasi prop wajib non-null, dan golden master contract. |

Untuk membuat komponen baru dengan format single-file standar:

```bash
node packages/cli/bin/kylat.js make:component MyComponent
```
