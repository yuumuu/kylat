# `@kylat/vite-plugin`

Plugin Vite untuk mengompilasi komponen single-file `*.kylat.php` saat dev dan build.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { kylat } from '@kylat/vite-plugin';

export default defineConfig({
  plugins: [kylat()],
});
```

```js
// main.js
import { createCounter } from './counter.kylat.php';

document.getElementById('app').replaceChildren(createCounter({ initialCount: 0 }));
```

## Perilaku

- `transform` mengompilasi berkas `*.kylat.php` memakai `@kylat/compiler` dan meneruskan source map.
- Pada mode serve, plugin menyuntikkan `import.meta.hot.accept` yang memanggil `updateIslandFactory()` dari runtime sehingga island yang sudah terpasang dirender ulang tanpa full reload.
- `handleHotUpdate` mengembalikan modul terpengaruh agar Vite mempropagasi update. Bila berkas belum termonitor (mis. file baru), plugin mengirim `full-reload`.
- Build produksi tidak menyertakan kode HMR.

## Batasan

State lokal komponen dibuat ulang saat HMR (belum ada state preservation). Perubahan pada berkas non-Kylat tetap memakai perilaku HMR Vite standar.
