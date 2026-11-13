# `@kylat/ssr`

Prerender/SSR opsional untuk komponen Kylat. Memakai `linkedom`; tidak dipakai di runtime browser.

```js
import { renderToString } from '@kylat/ssr';
import { createCounter } from './Counter.kylat.php';

const html = renderToString(createCounter, { initialCount: 3 });
```

Hasilnya adalah markup root komponen (termasuk `data-kylat-component`). Bungkus dengan elemen island di server:

```html
<div
  data-island="Counter"
  data-props='{"initialCount":3}'
  data-kylat-ssr="true"
>${html}</div>
```

Di klien, `hydrateIsland()` akan:

- membandingkan markup server dengan hasil klien (whitespace antar-tag dinormalisasi);
- menandai `data-kylat-hydration-mismatch="true"` dan mencatat peringatan bila berbeda;
- mengganti child dengan hasil klien dan menandai `data-kylat-hydrated="true"`.

## Batasan

- `renderToString` mengganti `globalThis.document` secara sinkron; jangan dipanggil paralel dalam satu proses.
- SSR tetap opsional; aplikasi tanpa SSR tidak terpengaruh.
- Belum ada CLI prerender; integrasi dilakukan di server/build aplikasi.
