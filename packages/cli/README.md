# `@kylat/cli`

Perintah pengguna. Node 20+.

| Perintah | Fungsi |
|---|---|
| `kylat make:component <Nama> [--dir path]` | Membuat komponen single-file `*.kylat.php` |
| `kylat check [path]` | Lint komponen dan template |
| `kylat build [path] [--out-dir dir]` | Preflight KIL-310, kompilasi ke modul JS + `manifest.json` + `client.js` |
| `kylat doctor` | Cek Node, PHP patch minimum, Composer |

Output build berisi modul per komponen, `manifest.json`, dan `client.js` (registrasi island + `hydrateAll`). `client.js` mengimpor `@kylat/runtime`; gunakan bundler/import map di aplikasi host.

```html
<script type="module" src="/dist/kylat/client.js"></script>
```
