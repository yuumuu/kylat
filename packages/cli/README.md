# `@kylat/cli`

Perintah pengguna. Node 20+.

  Perintah   Fungsi  
 --- --- 
  `kylat new <nama> [--dir path]`   Membuat proyek minimal (Vite + `@kylat/vite-plugin`)  
  `kylat make:component <Nama> [--dir path]`   Membuat komponen single-file `*.kylat.php`  
  `kylat check [path]`   Lint komponen dan template  
  `kylat build [path] [--out-dir dir] [--production\ --no-sourcemap]`   Preflight KIL-310, kompilasi ke modul JS + `manifest.json` + `client.js`; source map aktif kecuali produksi  
  `kylat types <schema.json\ -> [--out file] [--check]`   Hasilkan tipe TypeScript dari schema aksi; `--check` memvalidasi sinkronisasi  
  `kylat doctor`   Cek Node, PHP patch minimum, Composer  

## Generator proyek

```bash
kylat new my-app
cd my-app
pnpm install
pnpm dev
```

Proyek berisi `vite.config.ts` dengan `@kylat/vite-plugin`, `src/main.js`, dan `src/counter.kylat.php`. Nama proyek wajib kebab-case; direktori tujuan tidak boleh sudah berisi berkas.

Output build berisi modul per komponen, `manifest.json`, dan `client.js` (registrasi island + `hydrateAll`). `client.js` mengimpor `@kylat/runtime`; gunakan bundler/import map di aplikasi host.

Pada mode dev, setiap modul menghasilkan `<Nama>.js.map` dan `//# sourceMappingURL`. Gunakan `--production` (atau `--no-sourcemap`) untuk build produksi: file map tidak ditulis dan `manifest.components[].sourceMap` bernilai `null`.

```html
<script type="module" src="/dist/kylat/client.js"></script>
```

## Generator tipe

`kylat types` membaca respons `GET /_kylat/schema` yang disimpan sebagai JSON:

```bash
curl -H 'Accept: application/json' https://app.test/_kylat/schema > schema.json
kylat types schema.json --out resources/js/kylat-actions.ts
kylat types schema.json --out resources/js/kylat-actions.ts --check
```

File hasil berisi `KylatActionMap`, `KylatActionName`, dan `callKylatAction()` yang memanggil `@kylat/runtime` dengan tipe args/result. Jalankan `--check` di CI untuk mencegah drift schema.
