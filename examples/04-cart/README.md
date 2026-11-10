# examples/04-cart/

> [!WARNING]
> **Legacy Fixture (Pra-KEP-34)**: Contoh ini menggunakan format dua-berkas terpisah (`.php` dan `.blade.php`) sebelum penetapan arsitektur kanonik Single-File Component (`*.kylat.php`) pada KEP-34 / ADR 0004. Direktori ini dipertahankan sebagai fixture kompatibilitas dan referensi historis, bukan sebagai format standar komponen Kylat saat ini. Untuk contoh kanonik SFC terkini, lihat `examples/01-counter/Counter.kylat.php`.

Contoh komponen CartCounter dengan mutasi aksi server `CartActions::add` dan prop `productId` (sesuai Dokumen 4 §1.4, Spike S3, dan ADR 0003).

## Berkas

- `CartCounter.php`: Kelas komponen PHP final dengan prop `productId`, state `qty`, dan pemanggilan server action `CartActions::add`.
- `cart-counter.blade.php`: Templat Blade pendamping untuk rendering UI keranjang (legacy format dua-berkas).
- `CartActions.php`: Kontrak aksi server PHP dengan otorisasi `authorize()` dan atribut `#[Server]`.

> **Catatan Uji Regresi**: Fixture uji kompilasi dan golden file JS (`CartCounter.expected.js`) disimpan terpisah di `packages/compiler/test/fixtures/` untuk keperluan pengujian otomatis compiler.
