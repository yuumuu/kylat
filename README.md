# Kylat

Toolchain frontend: komponen ditulis dalam subset PHP bergaya Livewire, dikompilasi menjadi JavaScript reaktivitas fine-grained (signals) yang ringan dan berjalan di browser. Server hanya dipanggil untuk data, penyimpanan, dan otorisasi melalui protokol RPC netral bahasa.

**Status:** prototipe aktif. Fondasi compiler, runtime, CLI, dan adapter Laravel sudah berjalan; beberapa fitur spesifikasi masih ditandai `[TERBUKA]` atau belum diimplementasikan. Lihat [docs/handoff/STATUS.md](docs/handoff/STATUS.md) untuk catatan historis.

## Mulai cepat

```bash
pnpm install
pnpm build

# Buat komponen single-file
node packages/cli/bin/kylat.js make:component cart-product

# Periksa dan kompilasi
node packages/cli/bin/kylat.js check resources/views/components
node packages/cli/bin/kylat.js build resources/views/components --out-dir public/dist/kylat
```

Output build menghasilkan modul per komponen, `manifest.json`, dan `client.js` yang mendaftarkan island serta memanggil `hydrateAll()`.

Komponen menggunakan satu berkas `*.kylat.php`:

```php
<?php
declare(strict_types=1);

namespace App\Components;

use Kylat\Component;
use Kylat\Attributes\Client;

final class Counter extends Component
{
    public int $count = 0;

    #[Client]
    public function increment(): void
    {
        $this->count += 1;
    }
}
?>
<div>
    <button on:click="increment()">+</button>
    <span>{{ $count }}</span>
    @if($count > 0)
        <p>Positif</p>
    @endif
</div>
```

## Struktur

```text
spec/                 spesifikasi normatif (bahasa, template, protokol, ancaman)
packages/compiler/    parser PHP (tree-sitter WASM), analyzer, IR, codegen
packages/runtime/     signals, DOM binding, list, RPC batch, hidrasi island
packages/protocol/    tipe wire dan batas protokol
packages/adapter-laravel/  controller RPC, registry aksi, idempotency, Blade
packages/cli/         new, make:component, types, check, build, doctor
examples/             contoh yang dijalankan di test
docs/                 tutorial, referensi, ADR, status
```

## Yang sudah didukung compiler

- Komponen single-file `*.kylat.php` (KEP-34), plus format dua-berkas legacy.
- Nama berkas komponen wajib kebab-case (`cart-product.kylat.php`) dan class wajib PascalCase (`CartProduct`) sesuai ADR 0022.
- State signals, props, method client (`#[Client]`), aksi server (`#[Server]`).
- Template: teks, `{{ ekspresi }}`, `@if/@elseif/@else`, `@foreach/@empty`, `key`, `on:`, `bind:value`, `bind:checked`, `:attr`, interpolasi atribut, `<x-nama>` dengan `#[Child]`.
- Validasi fail-closed untuk direktif tak dikenal, raw HTML, `@foreach` tanpa key, bind ke prop, URL berbahaya, dan aturan struktur single-file.

## Perintah

| Perintah | Fungsi |
|---|---|
| `kylat new <nama>` | Membuat proyek Vite minimal |
| `kylat make:component <nama>` | Membuat `<nama>.kylat.php` (kebab-case) |
| `kylat types <schema>` | Menghasilkan tipe TypeScript dari schema aksi |
| `kylat check [path]` | Lint komponen, termasuk template single-file |
| `kylat build [path] [--out-dir dir] [--production]` | Preflight KIL-310, kompilasi ke modul JS + `manifest.json` + `client.js` + source map |
| `kylat doctor` | Cek Node, PHP, dan Composer |

## Invarian

1. Tanpa `eval`, `new Function`, `unserialize`, atau refleksi dinamis atas input.
2. Server selalu otoritas; client tidak pernah dipercaya.
3. Setiap aksi server wajib terdaftar, ber-`#[Server]`, dan punya otorisasi eksplisit.
4. Default deny.
5. Tidak ada rahasia di client.
6. Respons terautentikasi tidak di-cache bersama.
7. DOM hanya ditulis lewat `textContent`/`setAttribute`/binding aman.
8. Dependensi runtime minimum dan di-pin.
9. Konfigurasi aman secara default.
10. Setiap temuan keamanan menghasilkan uji regresi.

## Sumber kebenaran

Yang mengikat implementasi adalah [`spec/`](spec/README.md). Dokumen di `docs/google-docs/` adalah arsip/riwayat, bukan hukum. Jika menemukan pertentangan antara spec dan implementasi, catat dan putuskan — jangan diam-diam mengikuti implementasi.

## Test

```bash
pnpm test          # build + unit test compiler/runtime
pnpm test:examples # build + e2e demo counter
php -d zend.assertions=1 -d assert.exception=1 packages/adapter-laravel/test/AdapterTest.php
```
