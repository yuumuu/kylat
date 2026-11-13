# ADR 0022: Standar Nama Berkas Komponen Kebab-Case

- **Status**: DITERIMA
- **Tanggal**: 13 November 2026
- **Penulis**: Pemilik proyek / Arsitek Toolchain
- **Konteks**: ADR 0004/KIL-215 mewajibkan nama berkas sama persis dengan nama class dalam PascalCase (`Counter.kylat.php`). Standar proyek diubah menjadi kebab-case agar konsisten dengan konvensi URL, CSS, dan nama berkas frontend.

---

## 1. Keputusan

1. Berkas komponen **wajib kebab-case**:
   - `counter.kylat.php`
   - `cart-product.kylat.php`
   - `product-card.kylat.php`
2. Nama class **wajib PascalCase turunan langsung** dari nama berkas:
   - `counter.kylat.php` → `class Counter`
   - `cart-product.kylat.php` → `class CartProduct`
   - `product-card.kylat.php` → `class ProductCard`
3. Compiler menegakkan aturan ini lewat **KIL-215**:
   - nama berkas bukan kebab-case → galat;
   - class tidak sama dengan PascalCase hasil konversi → galat.
4. Nama modul JavaScript hasil build tetap memakai nama class (`Counter.js`, `CartProduct.js`); yang berubah hanya nama berkas sumber dan path impor.
5. `kylat make:component` menerima nama kebab-case (`kylat make:component cart-product`).
6. `kylat new` membuat `src/counter.kylat.php` dan mengimpor `./counter.kylat.php`.

## 2. Contoh

```php
// cart-product.kylat.php
<?php
declare(strict_types=1);
namespace App\Components;

use Kylat\Component;

final class CartProduct extends Component
{
    public int $qty = 0;
}
?>
<div>{{ $qty }}</div>
```

```js
import { createCartProduct } from './cart-product.kylat.php';
```

## 3. Konsekuensi

- ADR 0004 bagian penamaan berkas (PascalCase) **digantikan** oleh ADR ini; struktur single-file, `?>` wajib, dan satu class per berkas tetap berlaku.
- Berkas lama `Counter.kylat.php` harus diganti nama menjadi `counter.kylat.php`; class `Counter` tidak berubah.
- Tag island (`data-island="Counter"`) dan nama class tidak berubah; hanya path berkas/import.
- Contoh, tes CLI, plugin Vite, dan SSR memakai nama kebab-case.
- KIL-215 di `spec/errors.md` dan `spec/compiler-rules.md` diperbarui.

## 4. Migrasi

1. Ganti nama berkas `NamaClass.kylat.php` → `nama-class.kylat.php`.
2. Perbarui import/entry build.
3. Jalankan `kylat check`; KIL-215 akan menolak sisa berkas PascalCase.
