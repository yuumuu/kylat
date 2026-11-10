# examples/04-cart/

Contoh komponen CartCounter dengan mutasi aksi server `CartActions::add` dan prop `productId` (sesuai Dokumen 4 §1.4, Spike S3, dan ADR 0003).

## Berkas

- `CartCounter.php`: Kelas komponen PHP final dengan prop `productId`, state `qty`, dan pemanggilan server action `CartActions::add`.
- `cart-counter.blade.php`: Templat Blade pendamping untuk rendering UI keranjang.
- `CartActions.php`: Kontrak aksi server PHP dengan otorisasi `authorize()` dan atribut `#[Server]`.

> **Catatan Uji Regresi**: Fixture uji kompilasi dan golden file JS (`CartCounter.expected.js`) disimpan terpisah di `packages/compiler/test/fixtures/` untuk keperluan pengujian otomatis compiler.
