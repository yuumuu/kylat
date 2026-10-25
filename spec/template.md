# spec/template.md — Sintaks templat Kylat v0

Status: disahkan untuk v0 (revisi P0, 25 Oktober 2026). Berlaku untuk bagian HTML di berkas komponen .php.
Menjawab temuan K-01 (templat dan direktif tidak dispesifikasikan). Direvisi 25 Oktober 2026 untuk E-02, E-03, E-04, dan pemisahan `#[Uses]`/`#[Child]`.

## 1. Prinsip

1. Sintaks mirip Blade, supaya developer PHP langsung familiar (P1, P2).
2. Templat berisi ekspresi, bukan kode. Ekspresi harus berasal dari subset di spec/php-subset.md.
3. Tidak ada HTML mentah. Output dinamis selalu di-escape (C1 di dokumen 3).
4. Setiap kesalahan templat menghasilkan kode KIL-15x dengan lokasi baris templat (P3).

## 2. Ekspresi

- `{{ $expr }}` menampilkan hasil ekspresi dengan escape HTML.
- Nama yang bisa dibaca: prop (`$products`), state (`$query`), computed (`$visibleProducts`), dan variabel loop yang diperkenalkan `@foreach` (`$item`). Tidak ada `$this` di templat.
- Di dalam `{{ }}`, templat tidak boleh memanggil method; logika masuk ke computed. Pada `on:`, hanya aksi yang dideklarasikan `#[Client]` atau `#[Server]` yang boleh dipanggil.
- Helper yang boleh dipakai di template hanya fungsi dari allowlist di spec/php-subset.md.
- **Satu dialek ekspresi.** Semua ekspresi templat — di `{{ }}`, di atribut direktif, dan di atribut dinamis — memakai sintaks PHP dari `spec/php-subset.md`: variabel memakai `$`, akses properti memakai `->`, penggabungan string memakai `.`. Tidak ada dialek kedua yang menyerupai JavaScript.

## 3. Direktif kontrol

| Direktif | Keterangan |
|---|---|
| `@if (expr)` ... `@elseif (expr)` ... `@else` ... `@endif` | Percabangan |
| `@foreach ($list as $item)` ... `@empty` ... `@endforeach` | Perulangan. `@empty` opsional |
| `key="$item->id"` | Wajib pada elemen anak langsung di dalam `@foreach`. Nilai harus ekspresi string unik |

Tidak didukung di v0: `@for`, `@while`, `@switch`, `@php`, `@include`, `@extends`, `@yield`, `@section`, `@component`, `@slot`. Pemakaian direktif tersebut menghasilkan KIL-151.

Catatan: `@extends`, `@section`, dan `@yield` tidak masuk v0 karena layout diatur oleh router dan halaman, bukan oleh templat komponen.

## 4. Atribut

Nilai atribut HTML mengikuti **tiga kelas** berikut. Tidak ada pencampuran di antara ketiganya. `error` adalah atribut direktif khusus yang nilainya berupa path field, diatur terpisah di bawah.

| Kelas | Bentuk | Dipakai untuk | Contoh |
|---|---|---|---|
| **Ekspresi** | `nama="<ekspresi>"` | Atribut direktif: `bind:*`, `on:*`, `key` | `bind:value="$query"`, `on:click="add($item->id)"`, `key="$item->id"` |
| **Interpolasi** | teks, boleh berisi `{{ }}` | Atribut HTML biasa | `href="/produk/{{ $id }}"`, `alt="{{ $product->name }}"` |
| **Dinamis** | `:nama="<ekspresi>"` | Atribut HTML yang nilainya dihitung | `:href="'/produk/' . $id"`, `:disabled="$busy"` |

Aturan yang mengikat:

- `{{ }}` tidak sah di dalam atribut direktif maupun atribut dinamis — hasilnya KIL-159. Di sana ekspresi ditulis polos.
- `error` bukan ekspresi dan bukan interpolasi, melainkan **path field**: segmen dipisah `.`, segmen pertama wajib nama state, segmen berikutnya nama properti atau indeks list. `email` dan `items.0.qty` sama-sama sah; path yang segmen pertamanya bukan state menghasilkan KIL-156.
- Validasi skema URL (`http`, `https`, `mailto`, `tel`) dijalankan pada nilai **setelah** evaluasi, bukan pada teks sumber. `href="{{ $userUrl }}"` dan `:href="$userUrl"` wajib melewati pemeriksaan yang sama (KIL-158).
- Interpolasi pada `style` dan pada atribut `on*` dilarang, karena keduanya mengeksekusi atau menafsirkan CSS/JS (KIL-160).
- Nama atribut dinamis tidak boleh ditentukan oleh ekspresi (`:{{ $name }}` tidak sah).

### Atribut direktif

| Atribut | Contoh | Aturan |
|---|---|---|
| `bind:value` | `<input bind:value="$query">` | Dua arah. Target wajib state, bukan prop (KIL-154) |
| `bind:checked` | `<input type="checkbox" bind:checked="$agree">` | Dua arah untuk checkbox |
| `on:click` | `<button on:click="add($item->id)">` | Nama method wajib dideklarasikan `#[Client]` atau `#[Server]` (KIL-153) |
| `on:input`, `on:change`, `on:submit`, `on:keydown` | `<input on:input="search">` | Daftar event v0. Event lain ditolak (KIL-153) |
| `error` | `<span error="email">` | Menampilkan pesan validasi field. Compiler menambahkan `aria-describedby` dan `aria-invalid`. Field harus state; path boleh masuk ke properti atau indeks list (KIL-156) |

Argumen pada `on:` harus ekspresi dari subset. Argumen tidak boleh berupa nilai mentah dari DOM tanpa tipe.

Indikator proses tidak perlu ditulis. Saat aksi `#[Server]` berjalan, compiler menambahkan `aria-busy="true"` dan atribut `data-pending` di elemen pemicu.

### Pemetaan galat server ke `error`

Server mengembalikan galat validasi sebagai JSON Pointer ke argumen aksi (dokumen 3 §5), bukan ke nama field templat. Adapter memetakan:

1. Buang prefiks `/calls/{n}/args/`; bila pointer tidak punya prefiks itu, galat menjadi galat tingkat form dan tidak dipasangkan ke field.
2. Pecah sisa path per `/`, lalu unescape `~1` menjadi `/` dan `~0` menjadi `~`.
3. Gabungkan segmen dengan `.` — itulah nilai `error`.

`/calls/0/args/qty` → `error="qty"`. `/calls/0/args/items/0/qty` → `error="items.0.qty"`. Segmen numerik adalah indeks list, bukan nama properti. Aturan validasi mana yang juga dikompilasi ke client masih `[TERBUKA]` (dokumen 3 §8).

## 5. Lifecycle dan efek

Menggantikan `onMount` dan `effect` di tabel migrasi (dokumen 5, bagian 8).

| Atribut method | Perilaku | Batasan |
|---|---|---|
| `#[OnMount]` | Dijalankan sekali setelah komponen dihidrasi | Boleh memanggil `#[Client]` dan `#[Server]` |
| `#[Effect]` | Dijalankan ulang saat signal yang dibacanya berubah | Tidak boleh memanggil `#[Server]`, untuk mencegah loop (KIL-157) |

## 6. Navigasi

- `<a href="/produk" data-link>` untuk navigasi client-side lewat router Kylat.
- Tautan tanpa `data-link` adalah navigasi penuh (MPA).
- Skema URL harus lolos allowlist (`http`, `https`, `mailto`, `tel`). `javascript:` ditolak (KIL-158).

## 7. Komposisi komponen dan larangan

### Komposisi

- Komponen anak dipakai sebagai tag **`<x-nama>`**.
- `nama` adalah **kebab-case dari nama kelas**: `Counter` → `x-counter`, `ProductCard` → `x-product-card`.
- Tag wajib dideklarasikan di komponen induk lewat **`#[Child(ProductCard::class)]`**. Tag yang tidak dideklarasikan menghasilkan **KIL-212**.
- `#[Uses(CartActions::class)]` adalah atribut terpisah untuk **kontrak aksi server**. `#[Uses]` tidak membuka izin merender komponen; `#[Child]` tidak mendeklarasikan kontrak aksi. Pemisahan ini disengaja agar compiler tidak menebak maksud dari jenis kelas dan pesan error tetap spesifik.
- `<x-...>` adalah penanda compile-time. Tag ini **tidak boleh muncul di DOM hasil**; compiler menggantinya dengan node milik komponen anak.
- Prop dioper sebagai atribut: `:start="$start"` untuk nilai dinamis, `start="10"` untuk literal string. Prop bertipe non-string wajib memakai kelas ekspresi (`:start="10"`, `:open="false"`), karena atribut biasa selalu menghasilkan `string`.
- `key` pada `<x-nama>` di dalam `@foreach` wajib seperti elemen lain (`<x-product-card key="$item->id" … />`); `key` adalah atribut direktif dan tidak dioper sebagai prop.
- Prop divalidasi terhadap signature `#[Prop]` saat build.
- Dua kelas berbeda yang memetakan ke tag yang sama (`ProductCard` dan `Product_Card`) menggagalkan build. Kode galatnya belum dialokasikan.
- **Tidak ada slot di v0.** Komponen anak yang butuh konten menerima **nilai** lewat prop, bukan markup. Prop bertipe string selalu di-escape seperti output lain, jadi markup tidak bisa diselundupkan lewat prop (KIL-152).

### Dilarang di v0

- HTML mentah: `{!! ... !!}` dan sejenisnya (KIL-152).
- Script dan style inline yang dinamis.
- Komponen anak tanpa deklarasi `#[Child]` (KIL-212).

## 8. Kode galat templat

| Kode | Kondisi | Contoh perbaikan |
|---|---|---|
| KIL-151 | Direktif tidak didukung atau tidak dikenal, termasuk direktif Blade di dalam komponen | Ganti dengan `@if`, `@foreach`, atau `<x-nama>` |
| KIL-152 | HTML mentah | Gunakan `{{ }}` |
| KIL-153 | `on:` mengarah ke method yang tidak dideklarasikan atau event di luar daftar | Tambahkan `#[Client]` atau `#[Server]` |
| KIL-154 | `bind:` mengarah ke prop atau ekspresi | Gunakan state |
| KIL-155 | `@foreach` tanpa `key` | Tambahkan `key="$item->id"` |
| KIL-156 | `error` mengarah ke path yang segmen pertamanya bukan state | Hubungkan ke state atau field validasi |
| KIL-157 | `#[Effect]` memanggil `#[Server]` | Pindahkan ke `#[OnMount]` atau aksi yang dipicu user |
| KIL-158 | URL dengan skema tidak diizinkan, termasuk yang lolos lewat interpolasi | Gunakan `https` atau path relatif |
| KIL-159 | `{{ }}` dipakai di dalam atribut direktif atau atribut dinamis | Tulis ekspresi polos: `bind:value="$query"` |
| KIL-160 | Interpolasi pada `style` atau atribut `on*` | Pindahkan ke kelas atau atribut dinamis yang diizinkan |
| KIL-212 | Tag `<x-nama>` tidak dideklarasikan lewat `#[Child]` | Tambahkan `#[Child(Nama::class)]` |

## 9. Keterkaitan

- P1 (sintaks sama dengan PHP biasa): bagian 2 sampai 4.
- P2 (satu konsep untuk memulai): quick start hanya memakai `{{ }}`, `@if`, `@foreach`, `bind:value`, dan `on:click`.
- P3 (error bisa dipahami): setiap kode bagian 8 punya contoh perbaikan.
- P6 (keamanan default aman): bagian 2, 4, dan 6.

Daftar ini menjadi sumber kebenaran untuk pemetaan Livewire di dokumen 5 bagian 8. Setiap perubahan di sini wajib diikuti pembaruan `spec/errors.md` dan dokumen 5 bagian 8.

## 10. Hubungan dengan Blade

Blade dan Kylat bekerja di dua lapisan berbeda.

- **Layout dan halaman host** (di luar komponen) tetap ditulis dengan Blade. Adapter Laravel menyediakan direktif `@kylat('Nama', $props)`, yang hanya menghasilkan wadah island: `<div data-island="Nama" data-props="…">`.
- **Isi komponen** (di dalam `.php` komponen) ditulis dengan sintaks Kylat. Blade tidak diproses di dalam komponen. Direktif Blade di dalam berkas komponen menghasilkan KIL-151.
- Templat Kylat **tidak menggantikan** Blade di layout. Templat Kylat hanya menggantikan Blade di dalam komponen.

Pembagian ini mengikat semua adapter. Adapter Laravel menyediakan `@kylat`; adapter lain menyediakan padanan dengan keluaran wadah yang sama.

**Tidak ada tabrakan teknis dengan `<x-...>`.** Blade hanya memproses berkas layout; berkas komponen tidak pernah melewati Blade, jadi `<x-counter>` di dalam komponen tidak bisa ditafsirkan sebagai komponen Blade. Risikonya murni kebingungan manusia: developer bisa mengira `<x-counter>` di layout juga akan bekerja. Karena itu `<x-...>` hanya sah di dalam berkas komponen.

### Serialisasi `data-props`

- Nilai diserialisasi sebagai JSON dengan escape heksadesimal untuk `<`, `>`, `&`, `'`, dan `"`, lalu string hasilnya di-escape **sekali** untuk konteks atribut HTML. Tidak ada escape HTML kedua di lapisan mana pun.
- Tipe yang diizinkan: `null`, `bool`, `int`, `float`, `string`, `list`, dan `map` dengan key string. Objek, closure, resource, dan model ORM ditolak saat build — konsisten dengan A5 (mass assignment) di dokumen 3.
- Kedalaman maksimum 16, panjang string maksimum 10.000 karakter, total maksimum 16 KB per atribut. Batas body 256 KB di dokumen 3 §7 tetap berlaku untuk request dan tidak berubah oleh aturan ini.
- Prop divalidasi terhadap signature `#[Prop]` **saat build**, memakai kontrak yang sama dengan `sync-contract`. Ketidakcocokan saat hidrasi adalah galat protokol; island tidak dihidrasi dan galat dicatat.
- Tes wajib: prop berisi `"`, `<`, `</script>`, `&quot;`, dan karakter Unicode non-ASCII tidak boleh memecah atribut, tidak boleh menghasilkan escape ganda, dan tidak boleh terbaca sebagai markup.

## 11. Status keputusan

| Butir | Status | Catatan |
|---|---|---|
| Pemisahan `#[Uses]` dan `#[Child]` | **PUTUSAN** | `#[Uses(CartActions::class)]` khusus kontrak aksi server; `#[Child(Counter::class)]` membuka tag `<x-counter>`. KIL-212 mengacu ke `#[Child]`. Quick start counter tidak memerlukan `#[Child]` |
| Event pemicu `bind:value` | `[TERBUKA]` | `input` atau `change` belum ditetapkan; perilaku untuk `<select>` dan `contenteditable` juga |
| Modifier `on:` | `[TERBUKA]` | `.prevent`, `.stop`, `.once` belum ada; tanpa itu `on:submit` selalu memuat ulang halaman |
| Urutan `#[OnMount]` / `#[Effect]` terhadap render, dan cleanup | `[TERBUKA]` | Dibutuhkan sebelum runtime fase 1 |
| Kode galat tabrakan nama tag | `[TERBUKA]` | Belum dialokasikan |
| Aturan validasi yang dikompilasi ke client | `[TERBUKA]` | Dokumen 3 §8 belum menetapkan subset aturan; tanpa itu validasi instan tidak bisa diuji |
