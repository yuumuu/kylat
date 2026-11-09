# examples/04-cart/

Contoh komponen CartCounter dengan mutasi aksi server `CartActions::add` dan prop `productId` (ADR 0003 / Spike S3).

## Berkas

- `CartCounter.php`: Kelas komponen PHP final dengan prop `productId`, state `qty`, dan pemanggilan server action `CartActions::add`.
- `cart-counter.blade.php`: Templat Blade pendamping (legacy fixture).
- `CartActions.php`: Kontrak aksi server PHP dengan otorisasi `authorize()` dan atribut `#[Server]`.
- `CartCounter.expected.js`: Kontrak golden master tertulis manual yang digunakan oleh `golden.test.mjs` dan `principles-gate.test.mjs`.
