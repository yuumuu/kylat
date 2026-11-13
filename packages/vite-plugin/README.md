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
- `handleHotUpdate` mengembalikan modul terpengaruh agar Vite mempropagasi update. Bila berkas belum termonitor (mis. file baru), plugin mengirim `full-reload`.
- Build produksi memakai compiler yang sama; atur `build.minify` dan source map lewat konfigurasi Vite.

## Batasan

Belum ada component-level HMR accept; perubahan komponen saat ini dapat berujung full reload. HMR granular akan ditambahkan bersama runtime dev helper.
