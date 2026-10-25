# spec/errors.md — Katalog Kode Galat Kylat v0

Status: **Normatif**. Setiap kode galat adalah kontrak yang mengikat compiler, analyzer, CLI, dan perkakas penunjang.
Disahkan: 25 Oktober 2026 (Revisi P0 + Revisi E).

Dokumen ini memuat daftar lengkap kode galat `KIL-xxx` yang ditegakkan oleh compiler Kylat v0, lengkap dengan pemicu, format pesan, contoh salah, contoh benar, dan rujukan spesifikasi.

Setiap kode galat baru wajib terdaftar di berkas ini sebelum digunakan dalam pesan diagnosa compiler mana pun. Halaman panduan di `docs/reference/` bersifat penjelas dan tutorial yang merujuk ke dokumen ini, bukan sebaliknya.

---

## 1. Format Diagnosa Compiler

Sesuai spesifikasi bahasa (Dokumen 2 §9), setiap pesan diagnosa compiler wajib memiliki:
1. **Kode stabil**: `KIL-xxx`
2. **Lokasi presisi**: Jalur berkas, baris, dan kolom (`--> berkas:baris:kolom`)
3. **Pernyataan kesalahan**: Penjelasan satu kalimat yang jelas
4. **Petunjuk perbaikan**: Contoh atau saran perbaikan konkret
5. **Tautan spesifikasi**: Tautan langsung ke jangkar berkas ini (`spec/errors.md#KIL-xxx`)

### Format Standar Tampilan CLI

```text
error[KIL-120]: Method #[Client] tidak boleh mengakses database
 --> src/components/Cart.php:34:17
    |
 34 |         $user = User::find($this->userId);
    |                 ^^^^^^^^^^^^^^^^^^^^^^^^^ operasi database ditolak di client
    |
    = bantuan: pindahkan operasi data ke aksi server, lalu panggil via $this->server(UserActions::class)->loadUser($this->userId);
    = dokumen: spec/errors.md#KIL-120
```

---

## 2. Pembagian Rentang Kode

Nomor kode galat mengindikasikan kelas masalah secara deterministik (Dokumen 2 §10):

| Rentang | Klasifikasi | Keterangan |
|---|---|---|
| **KIL-101 – KIL-149** | Aturan Bahasa & Subset PHP | Batasan sintaks PHP v0, allowlist fungsi/kelas, tipe wajib, dan semantik UTF-8. |
| **KIL-151 – KIL-199** | Sintaks & Direktif Templat | Grammar templat komponen, validasi atribut, event handler, dan keamanan XSS markup. |
| **KIL-201 – KIL-299** | Struktur & Konvensi Komponen | Konvensi satu komponen per berkas, komposisi anak, urutan deklarasi, dan deteksi siklus. |
| **KIL-301 – KIL-399** | Keamanan, Kontrak & Protokol RPC | Otorisasi aksi server, skema batch RPC, keunikan nama aksi, dan batasan integritas wire. |
| **KIL-401 – KIL-499** | Aksesibilitas & Anggaran Performa | Batasan ukuran chunk JS terkompilasi (budget) dan audit semantik aksesibilitas (a11y). |

---

## 3. Tabel Pemetaan Renumber (25 Oktober 2026)

Tiga kode lama yang melanggar klasifikasi rentang telah di-renumber sebelum fase 0 dimulai. Kode lama tidak lagi sah dan hanya dicatat di tabel ini untuk memudahkan pelacakan riwayat:

| Kode Lama | Kode Baru | Alasan Pemindahan Rentang |
|---|---|---|
| `KIL-202` | **`KIL-102`** | Kewajiban `strict_types` adalah batasan bahasa yang diperiksa compiler, masuk rentang `1xx`. |
| `KIL-206` | **`KIL-103`** | Larangan `static`/`global`/singleton adalah batasan subset bahasa komponen, masuk rentang `1xx`. |
| `KIL-210` | **`KIL-311`** | Keunikan nama aksi adalah masalah kontrak RPC server, masuk rentang `3xx`. |

---

## 4. Katalog Kode Galat

### Rentang 1xx: Bahasa & Subset PHP

#### KIL-101
- **Nama**: Perbandingan longgar dilarang
- **Klasifikasi**: Aturan Bahasa
- **Pemicu**: Penggunaan operator perbandingan longgar `==` atau `!=` di dalam method `#[Client]` atau ekspresi templat.
- **Pesan**: `Operator perbandingan longgar '==' dan '!=' dilarang. Gunakan perbandingan strict '===' atau '!=='`
- **Rujukan**: [`spec/php-subset.md` §3](file:///c:/Users/haidaryuum/source/kylat/spec/php-subset.md)

##### Contoh Salah
```php
if ($this->status == 1) {
    $this->active = true;
}
```

##### Contoh Benar
```php
if ($this->status === 1) {
    $this->active = true;
}
```

---

#### KIL-102
*(Renumber dari KIL-202)*
- **Nama**: Deklarasi strict types wajib
- **Klasifikasi**: Aturan Bahasa
- **Pemicu**: Berkas komponen PHP tidak memuat `declare(strict_types=1);` pada deklarasi pembuka berkas.
- **Pesan**: `Berkas komponen wajib mendeklarasikan 'declare(strict_types=1);' di awal berkas`
- **Rujukan**: [`spec/compiler-rules.md`](file:///c:/Users/haidaryuum/source/kylat/spec/compiler-rules.md)

##### Contoh Salah
```php
<?php

namespace App\Components;

use Kylat\Component;

final class Counter extends Component {}
```

##### Contoh Benar
```php
<?php

declare(strict_types=1);

namespace App\Components;

use Kylat\Component;

final class Counter extends Component {}
```

---

#### KIL-103
*(Renumber dari KIL-206)*
- **Nama**: Larangan state statis dan global
- **Klasifikasi**: Aturan Bahasa
- **Pemicu**: Penggunaan `static` property, variabel superglobal (`$GLOBALS`, `$_GET`, dll.), kata kunci `global`, atau pola singleton di dalam kelas komponen. Catatan: Enum case dan konstanta kelas `public const` tetap diizinkan karena bukan state yang bermutasi.
- **Pesan**: `Komponen dilarang menggunakan static property, variabel global, atau pola singleton`
- **Rujukan**: [`spec/compiler-rules.md`](file:///c:/Users/haidaryuum/source/kylat/spec/compiler-rules.md)

##### Contoh Salah
```php
final class Cart extends Component
{
    private static int $instanceCount = 0;

    #[Client]
    public function init(): void
    {
        global $currentTenant;
    }
}
```

##### Contoh Benar
```php
final class Cart extends Component
{
    public const MAX_ITEMS = 50;

    public int $itemCount = 0; // State reaktif komponen
}
```

---

#### KIL-104
- **Nama**: Fitur sintaks PHP di luar subset v0
- **Klasifikasi**: Aturan Bahasa & Subset PHP
- **Pemicu**: Penggunaan fitur sintaks bahasa PHP yang dilarang di v0, seperti ekspresi `match`, generator `yield`, pernyataan `goto`, atau evaluasi dinamis `eval()`.
- **Pesan**: `Fitur sintaks PHP '{fitur}' tidak didukung di subset Kylat v0`
- **Rujukan**: [`spec/php-subset.md` §1](file:///c:/Users/haidaryuum/source/kylat/spec/php-subset.md)

##### Contoh Salah
```php
#[Client]
public function statusLabel(int $status): string
{
    return match($status) {
        1 => 'Aktif',
        default => 'Nonaktif',
    };
}
```

##### Contoh Benar
```php
#[Client]
public function statusLabel(int $status): string
{
    if ($status === 1) {
        return 'Aktif';
    }
    return 'Nonaktif';
}
```

---

#### KIL-110
- **Nama**: Pemanggilan fungsi atau instansiasi kelas di luar allowlist
- **Klasifikasi**: Aturan Bahasa / Keamanan
- **Pemicu**: Memanggil fungsi bawaan PHP yang tidak terdaftar di allowlist v0, atau menginstansiasi objek kelas sembarang menggunakan operator `new X`. Referensi tipe pada signature method, docblock generik, deklarasi `use`, `extends Component`, dan atribut komponen tetap sah.
- **Pesan**: `Pemanggilan fungsi '{nama}' atau instansiasi kelas '{kelas}' di luar allowlist tidak diizinkan di client`
- **Rujukan**: [`spec/php-subset.md` §2, §3](file:///c:/Users/haidaryuum/source/kylat/spec/php-subset.md)

##### Contoh Salah
```php
#[Client]
public function formatData(string $raw): void
{
    $trimmed = trim($raw); // trim di luar allowlist (gunakan mb_*)
    $date = new DateTime(); // new X di luar allowlist
}
```

##### Contoh Benar
```php
#[Client]
public function formatData(string $raw): void
{
    $len = mb_strlen($raw); // mb_* ada di allowlist
    // Operasi tanggal atau objek kompleks didelegasikan ke aksi server
    $this->server(FormatterActions::class)->parseDate($raw);
}
```

---

#### KIL-120
- **Nama**: Operasi I/O atau database di method client
- **Klasifikasi**: Arsitektur / Integritas Client
- **Pemicu**: Pemanggilan fungsi/method I/O filesystem, panggilan database (Eloquent/PDO), session, atau operasi jaringan langsung di dalam method beranotasi `#[Client]`.
- **Pesan**: `Method #[Client] tidak boleh mengakses I/O, database, filesystem, atau sesi`
- **Rujukan**: [`spec/php-subset.md` §3](file:///c:/Users/haidaryuum/source/kylat/spec/php-subset.md)

##### Contoh Salah
```php
#[Client]
public function loadProfile(): void
{
    $user = User::query()->find($this->userId); // Akses database langsung
}
```

##### Contoh Benar
```php
#[Client]
public function loadProfile(): void
{
    $this->server(UserActions::class)->getProfile($this->userId);
}
```

---

#### KIL-130
- **Nama**: Tipe array ambigu antara list dan map
- **Klasifikasi**: Sistem Tipe
- **Pemicu**: Variabel atau properti bertipe `array` tanpa anotasi tipe generik yang jelas (`list<T>` vs `array<string, T>`), atau pemakaian langsung hasil `array_filter` sebagai list tanpa dibungkus `array_values()`.
- **Pesan**: `Tipe array ambigu antara list dan map. Gunakan docblock generik atau bungkus hasil array_filter dengan array_values()`
- **Rujukan**: [`spec/php-subset.md` §3, §4](file:///c:/Users/haidaryuum/source/kylat/spec/php-subset.md)

##### Contoh Salah
```php
/** @var array */
public array $items = [];

#[Client]
public function removeInactive(): void
{
    // array_filter mempertahankan key numerik berlubang, menghasilkan map ambigu
    $this->items = array_filter($this->items, fn($i) => $i > 0);
}
```

##### Contoh Benar
```php
/** @var list<int> */
public array $items = [];

#[Client]
public function removeInactive(): void
{
    // array_values merapatkan indeks kembali menjadi list rapat murni
    $this->items = array_values(array_filter($this->items, fn($i) => $i > 0));
}
```

---

#### KIL-131
- **Nama**: Tipe data hilang atau operator titik tidak valid
- **Klasifikasi**: Sistem Tipe
- **Pemicu**: Properti, parameter method, atau return value tidak memiliki deklarasi tipe eksplisit. Kode ini juga dipicu jika operator penggabungan string `.` digunakan pada salah satu operand yang bukan bertipe `string`.
- **Pesan**: `Tipe data wajib dideklarasikan secara eksplisit, atau operand operator '.' bukan string`
- **Rujukan**: [`spec/php-subset.md` §1, §3, §5](file:///c:/Users/haidaryuum/source/kylat/spec/php-subset.md)

##### Contoh Salah
```php
public $searchQuery; // Tipe properti hilang

public function updateQuery($query) // Tipe parameter dan return hilang
{
    $this->searchQuery = $query . 100; // 100 bukan string
}
```

##### Contoh Benar
```php
public string $searchQuery = '';

public function updateQuery(string $query): void
{
    $this->searchQuery = $query . (string) 100;
}
```

---

#### KIL-140
- **Nama**: Fungsi manipulasi string byte-level ditolak
- **Klasifikasi**: Subset Bahasa / Integritas UTF-8
- **Pemicu**: Menggunakan fungsi string standar bawaan PHP yang bekerja di tingkat byte (misal `strlen`, `substr`, `strpos`, `strtolower`, `strtoupper`) yang tidak aman untuk karakter UTF-8 multibyte.
- **Pesan**: `Fungsi byte-level '{nama}' dilarang karena berisiko memecah karakter UTF-8. Gunakan padanan 'mb_{nama}'`
- **Rujukan**: [`spec/php-subset.md` §3, §4](file:///c:/Users/haidaryuum/source/kylat/spec/php-subset.md)

##### Contoh Salah
```php
$length = strlen($this->title);
$prefix = substr($this->title, 0, 3);
```

##### Contoh Benar
```php
$length = mb_strlen($this->title);
$prefix = mb_substr($this->title, 0, 3);
```

---

### Rentang 15x–16x: Sintaks & Direktif Templat

#### KIL-151
- **Nama**: Direktif templat tidak dikenal atau direktif Blade di dalam komponen
- **Klasifikasi**: Grammar Templat
- **Pemicu**: Menulis direktif Blade warisan di dalam berkas komponen Kylat (misal `@for`, `@while`, `@switch`, `@php`, `@include`, `@extends`, `@yield`, `@section`, `@component`, `@slot`).
- **Pesan**: `Direktif '@{nama}' tidak didukung di dalam templat komponen Kylat. Gunakan @if, @foreach, atau komponen <x-nama>`
- **Rujukan**: [`spec/template.md` §3, §8](file:///c:/Users/haidaryuum/source/kylat/spec/template.md)

##### Contoh Salah
```html
@include('partials.card')

@php
    $total = $a + $b;
@endphp
```

##### Contoh Benar
```html
<x-card :title="$item->title" />
<!-- Kalkulasi logika dideklarasikan di dalam kelas komponen PHP -->
```

---

#### KIL-152
- **Nama**: HTML mentah atau penyusupan markup dilarang
- **Klasifikasi**: Keamanan XSS
- **Pemicu**: Menggunakan kurung kurawal unescaped `{!! $html !!}` di templat komponen, atau mencoba menyusupkan tag markup HTML melalui prop string ke komponen anak (Kylat v0 tidak mendukung slot markup).
- **Pesan**: `HTML mentah '{!! !!}' dilarang. Semua output wajib menggunakan interpolasi aman '{{ }}'`
- **Rujukan**: [`spec/template.md` §2, §7, §8](file:///c:/Users/haidaryuum/source/kylat/spec/template.md)

##### Contoh Salah
```html
<div class="content">
    {!! $this->userBio !!}
</div>
```

##### Contoh Benar
```html
<div class="content">
    {{ $this->userBio }}
</div>
```

---

#### KIL-153
- **Nama**: Target event handler tidak sah atau event tidak terdaftar
- **Klasifikasi**: Binding Event
- **Pemicu**: Direktif `on:<event>` diarahkan ke method yang tidak beranotasi `#[Client]` atau `#[Server]`, atau menggunakan nama event di luar daftar v0 (`click`, `input`, `change`, `submit`, `keydown`).
- **Pesan**: `Handler 'on:{event}' mengarah ke method yang tidak beranotasi #[Client]/#[Server], atau event di luar daftar sah v0`
- **Rujukan**: [`spec/template.md` §4, §8](file:///c:/Users/haidaryuum/source/kylat/spec/template.md)

##### Contoh Salah
```html
<!-- helperMethod() adalah private atau tanpa atribut #[Client]/#[Server] -->
<button on:click="helperMethod">Simpan</button>
<div on:mouseenter="hoverEffect">...</div> <!-- mouseenter di luar allowlist v0 -->
```

##### Contoh Benar
```html
<button on:click="save">Simpan</button>
```
```php
#[Client]
public function save(): void
{
    // Handler sah
}
```

---

#### KIL-154
- **Nama**: Target `bind:value` bukan state lokal
- **Klasifikasi**: Two-Way Binding
- **Pemicu**: Mengarahkan `bind:value` dua arah ke properti yang dideklarasikan dengan `#[Prop]` (read-only dari induk) atau ke ekspresi komputasi/literal.
- **Pesan**: `Target direktif 'bind:value' wajib berupa state lokal yang dapat dimutasi, bukan prop atau ekspresi`
- **Rujukan**: [`spec/template.md` §4, §8](file:///c:/Users/haidaryuum/source/kylat/spec/template.md)

##### Contoh Salah
```html
<!-- $startProp adalah properti #[Prop] -->
<input bind:value="$this->startProp">
```

##### Contoh Benar
```html
<!-- $query adalah state lokal komponen -->
<input bind:value="$query">
```

---

#### KIL-155
- **Nama**: Direktif `@foreach` tanpa atribut key unik
- **Klasifikasi**: Integritas Reaktivitas DOM
- **Pemicu**: Menulis perulangan `@foreach` pada elemen DOM tanpa menyertakan atribut penanda unik `key="..."`.
- **Pesan**: `Elemen di dalam direktif @foreach wajib menyertakan atribut 'key' dengan pengenal unik`
- **Rujukan**: [`spec/template.md` §4, §8](file:///c:/Users/haidaryuum/source/kylat/spec/template.md)

##### Contoh Salah
```html
@foreach ($items as $item)
    <div class="item">{{ $item->name }}</div>
@endforeach
```

##### Contoh Benar
```html
@foreach ($items as $item)
    <div class="item" key="$item->id">{{ $item->name }}</div>
@endforeach
```

---

#### KIL-156
- **Nama**: Path atribut `error` bukan state valid
- **Klasifikasi**: Validasi Form
- **Pemicu**: Atribut penampil pesan kesalahan `error="..."` menunjuk path yang segmen pertamanya bukan nama state yang terdaftar di komponen.
- **Pesan**: `Atribut error='{path}' mengarah ke path yang segmen pertamanya bukan nama state yang valid`
- **Rujukan**: [`spec/template.md` §4, §8](file:///c:/Users/haidaryuum/source/kylat/spec/template.md)

##### Contoh Salah
```html
<!-- field 'unregisteredField' tidak dideklarasikan di komponen -->
<span error="unregisteredField"></span>
```

##### Contoh Benar
```html
<!-- 'email' atau 'items' adalah state terdaftar -->
<span error="email"></span>
<span error="items.0.qty"></span>
```

---

#### KIL-157
- **Nama**: Method `#[Effect]` memanggil aksi server
- **Klasifikasi**: Reaktivitas / Pencegahan Loop Jaringan
- **Pemicu**: Method beranotasi `#[Effect]` memanggil method aksi server `#[Server]`, yang dapat menyebabkan *infinite request loop* jika respons server memicu reaktivitas sinyal kembali.
- **Pesan**: `Method #[Effect] dilarang memanggil aksi #[Server] untuk mencegah infinite loop`
- **Rujukan**: [`spec/template.md` §6, §8](file:///c:/Users/haidaryuum/source/kylat/spec/template.md)

##### Contoh Salah
```php
#[Effect]
public function onQueryChange(): void
{
    $this->server(SearchActions::class)->fetchResults($this->query);
}
```

##### Contoh Benar
```php
// Panggil aksi server via OnMount atau dipicu interaksi pengguna langsung:
#[OnMount]
public function mount(): void
{
    $this->server(SearchActions::class)->fetchResults($this->query);
}

#[Client]
public function handleSearch(): void
{
    $this->server(SearchActions::class)->fetchResults($this->query);
}
```

---

#### KIL-158
- **Nama**: Skema URL tidak diizinkan
- **Klasifikasi**: Keamanan XSS
- **Pemicu**: Penggunaan skema URL di luar allowlist (`http`, `https`, `mailto`, `tel`), termasuk protokol berbahaya seperti `javascript:`. Validasi dijalankan terhadap nilai akhir hasil evaluasi ekspresi/interpolasi.
- **Pesan**: `URL menggunakan skema tidak diizinkan. Gunakan skema 'https', 'http', 'mailto', 'tel', atau path relatif`
- **Rujukan**: [`spec/template.md` §4, §8](file:///c:/Users/haidaryuum/source/kylat/spec/template.md)

##### Contoh Salah
```html
<a href="javascript:stealCookie()">Profil</a>
<a :href="'javascript:' . $customScript">Aksi</a>
```

##### Contoh Benar
```html
<a href="https://example.com">Tautan Aman</a>
<a :href="'/produk/' . $productId">Detail Produk</a>
```

---

#### KIL-159
- **Nama**: Kurung kurawal ganda di dalam atribut direktif atau atribut dinamis
- **Klasifikasi**: Grammar Nilai Atribut
- **Pemicu**: Menggunakan sintaks interpolasi `{{ }}` di dalam atribut direktif (`bind:`, `on:`) atau atribut dinamis berekspresi (`:nama`).
- **Pesan**: `Dilarang menggunakan '{{ }}' di dalam atribut direktif atau atribut dinamis. Tulis ekspresi polos`
- **Rujukan**: [`spec/template.md` §4, §8](file:///c:/Users/haidaryuum/source/kylat/spec/template.md)

##### Contoh Salah
```html
<input bind:value="{{ $query }}">
<a :href="{{ '/items/' . $id }}">Lihat</a>
```

##### Contoh Benar
```html
<input bind:value="$query">
<a :href="'/items/' . $id">Lihat</a>
```

---

#### KIL-160
- **Nama**: Interpolasi kurung kurawal ganda pada atribut `style` atau `on*`
- **Klasifikasi**: Keamanan XSS / Penataan Gaya
- **Pemicu**: Menggunakan kurung kurawal `{{ }}` pada atribut `style` atau atribut event bawaan HTML (`onclick`, `onload`, dll.) karena berpotensi mengeksekusi script/CSS berbahaya.
- **Pesan**: `Interpolasi '{{ }}' dilarang pada atribut 'style' atau atribut bawaan 'on*'`
- **Rujukan**: [`spec/template.md` §4, §8](file:///c:/Users/haidaryuum/source/kylat/spec/template.md)

##### Contoh Salah
```html
<div style="color: {{ $userColor }};">Teks</div>
<button onclick="{{ $nativeJs }}">Klik</button>
```

##### Contoh Benar
```html
<!-- Gunakan class terkurasi atau direktif Kylat on:click -->
<div :class="['text-active' => $isActive]">Teks</div>
<button on:click="handleClick">Klik</button>
```

---

### Rentang 2xx: Struktur & Konvensi Komponen

#### KIL-201
- **Nama**: Struktur berkas komponen tunggal dan final
- **Klasifikasi**: Struktur Berkas
- **Pemicu**: Berkas memuat lebih dari satu deklarasi kelas komponen, nama berkas tidak sama persis dengan nama kelas komponen, atau kelas komponen tidak dideklarasikan sebagai `final`.
- **Pesan**: `Satu berkas hanya boleh mendefinisikan satu kelas komponen 'final' dengan nama berkas persis sama`
- **Rujukan**: [`spec/compiler-rules.md`](file:///c:/Users/haidaryuum/source/kylat/spec/compiler-rules.md)

##### Contoh Salah
```php
// Di dalam berkas CartView.php
class ShoppingCart extends Component {} // Tidak final dan nama berbeda dari berkas
```

##### Contoh Benar
```php
// Di dalam berkas ShoppingCart.php
final class ShoppingCart extends Component {}
```

---

#### KIL-203
- **Nama**: Urutan anggota kelas komponen tidak sesuai konvensi
- **Klasifikasi**: Konvensi Kode
- **Pemicu**: Anggota kelas komponen tidak disusun berurutan: konstanta → `#[Prop]` → state publik/privat → computed (`#[Computed]`) → `#[Client]` → `#[Server]`.
- **Pesan**: `Urutan anggota kelas komponen wajib: konstanta, #[Prop], state, computed, #[Client], #[Server]`
- **Rujukan**: [`spec/compiler-rules.md`](file:///c:/Users/haidaryuum/source/kylat/spec/compiler-rules.md)

##### Contoh Salah
```php
final class Counter extends Component
{
    #[Client]
    public function increment(): void { $this->count++; }

    #[Prop]
    public int $initial = 0; // Prop dideklarasikan setelah method
}
```

##### Contoh Benar
```php
final class Counter extends Component
{
    public const STEP = 1;

    #[Prop]
    public int $initial = 0;

    public int $count = 0;

    #[Client]
    public function increment(): void { $this->count += self::STEP; }
}
```

---

#### KIL-204
- **Nama**: Method client melebihi batas kompleksitas
- **Klasifikasi**: Konvensi Kode (Peringatan / Soft Limit)
- **Pemicu**: Method beranotasi `#[Client]` melebihi batas lunak 40 baris kode atau memiliki kedalaman sarang (*nesting level*) lebih dari 3 tingkat.
- **Pesan**: `Method #[Client] '{nama}' terlalu panjang (> 40 baris) atau nesting terlalu dalam (> 3 tingkat)`
- **Rujukan**: [`spec/compiler-rules.md`](file:///c:/Users/haidaryuum/source/kylat/spec/compiler-rules.md)

##### Contoh Salah
Method client berisi 50 baris dengan 4 blok `if/foreach` bersarang.

##### Contoh Benar
Pecah logika menjadi method privat kecil atau pindahkan logika kalkulasi ke computed property.

---

#### KIL-205
- **Nama**: Logika kompleks di dalam templat
- **Klasifikasi**: Konvensi Templat
- **Pemicu**: Templat memuat ekspresi kalkulasi atau transformasi data multi-langkah yang seharusnya disederhanakan melalui computed property.
- **Pesan**: `Templat hanya boleh memuat ekspresi sederhana. Pindahkan kalkulasi logika ke computed property`
- **Rujukan**: [`spec/compiler-rules.md`](file:///c:/Users/haidaryuum/source/kylat/spec/compiler-rules.md)

##### Contoh Salah
```html
<p>{{ array_sum(array_map(fn($x) => $x['price'] * $x['qty'], $this->cartItems)) }}</p>
```

##### Contoh Benar
```html
<p>{{ $this->totalPrice }}</p>
```
```php
public function getTotalPrice(): int
{
    return array_sum(array_map(fn($x) => $x['price'] * $x['qty'], $this->cartItems));
}
```

---

#### KIL-211
- **Nama**: Siklus dependensi antar-komponen
- **Klasifikasi**: Struktur Graf Komponen
- **Pemicu**: Terjadi dependensi melingkar (*circular dependency*) antar-komponen anak (Komponen A menggunakan Komponen B, dan Komponen B menggunakan Komponen A).
- **Pesan**: `Terdeteksi dependensi sirkular antar-komponen: {A} -> {B} -> {A}`
- **Rujukan**: [`spec/compiler-rules.md`](file:///c:/Users/haidaryuum/source/kylat/spec/compiler-rules.md)

##### Contoh Salah
`CommentList` mendeklarasikan `#[Child(CommentItem::class)]`, dan `CommentItem` mendeklarasikan `#[Child(CommentList::class)]` secara langsung tanpa pembatasan terarah.

##### Contoh Benar
Pisahkan komponen penampung (*container*) atau desain hierarki pohon rekursif terstruktur tanpa siklus dependensi langsung saat build.

---

#### KIL-212
*(Diperkenalkan pada Revisi E)*
- **Nama**: Tag komponen anak tanpa atribut `#[Child]`
- **Klasifikasi**: Struktur Komponen / Komposisi
- **Pemicu**: Menggunakan tag `<x-nama>` di dalam templat tanpa mendeklarasikannya di kelas komponen induk menggunakan atribut `#[Child(Nama::class)]`. Catatan: Atribut `#[Uses]` hanya untuk kontrak aksi server dan tidak memberikan izin render komponen.
- **Pesan**: `Tag komponen '<x-{nama}>' wajib dideklarasikan di kelas induk menggunakan atribut #[Child({Kelas}::class)]`
- **Rujukan**: [`spec/compiler-rules.md`](file:///c:/Users/haidaryuum/source/kylat/spec/compiler-rules.md), [`spec/template.md` §7, §8](file:///c:/Users/haidaryuum/source/kylat/spec/template.md)

##### Contoh Salah
```html
<!-- Templat komponen Cart -->
<div class="cart">
    <x-counter :start="1" />
</div>
```
```php
// Kelas Cart tidak mendeklarasikan #[Child(Counter::class)]
final class Cart extends Component {}
```

##### Contoh Benar
```php
use App\Components\Counter;

#[Child(Counter::class)]
final class Cart extends Component {}
```

---

#### KIL-213
- **Nama**: Serialisasi `data-props` melebihi batas 16 KB
- **Klasifikasi**: Serialisasi Wadah Island
- **Pemicu**: Payload JSON serialisasi props awal pada wadah island (`data-props="..."`) melebihi batas 16.384 bytes (16 KB).
- **Pesan**: `Ukuran data-props untuk komponen '{nama}' ({ukuran} bytes) melebihi batas maksimum 16 KB (KIL-213)`
- **Rujukan**: [`spec/template.md` §11](file:///c:/Users/haidaryuum/source/kylat/spec/template.md), [`spec/protocol.schema.json`](file:///c:/Users/haidaryuum/source/kylat/spec/protocol.schema.json)

##### Contoh Salah
```html
<div data-island="UserTable" data-props="{payload_25kb_berisi_seluruh_tabel}"></div>
```

##### Contoh Benar
Gunakan paginasi atau panggil data via aksi server RPC bertahap:
```html
<div data-island="UserTable" data-props='{"page":1,"perPage":20}'></div>
```

---

### Rentang 3xx: Keamanan, Kontrak & Protokol RPC

#### KIL-310
- **Nama**: Aksi server berparameter ID wajib memiliki otorisasi
- **Klasifikasi**: Keamanan Server
- **Pemicu**: Kelas aksi server yang mengimplementasikan `ServerAction` dan menerima parameter pengenal/ID (misal `string $id`) tidak mendeklarasikan method `authorize()`.
- **Pesan**: `Aksi server '{aksi}' yang menerima parameter ID wajib mengimplementasikan method authorize()`
- **Rujukan**: [`spec/compiler-rules.md`](file:///c:/Users/haidaryuum/source/kylat/spec/compiler-rules.md)

##### Contoh Salah
```php
final class DeleteItemAction implements ServerAction
{
    public function handle(string $itemId): void
    {
        // Tanpa method authorize()
    }
}
```

##### Contoh Benar
```php
final class DeleteItemAction implements ServerAction
{
    public function authorize(User $user, string $itemId): bool
    {
        return $user->can('delete', Item::findOrFail($itemId));
    }

    public function handle(string $itemId): void
    {
        // ...
    }
}
```

---

#### KIL-311
*(Renumber dari KIL-210)*
- **Nama**: Nama aksi server bentrok dalam satu kontrak
- **Klasifikasi**: Integritas Kontrak RPC
- **Pemicu**: Terdapat dua deklarasi aksi dengan nama yang identik di dalam kontrak RPC yang sama saat digabungkan.
- **Pesan**: `Nama aksi server '{nama}' bertabrakan dengan aksi lain di dalam kontrak yang sama`
- **Rujukan**: [`spec/compiler-rules.md`](file:///c:/Users/haidaryuum/source/kylat/spec/compiler-rules.md)

##### Contoh Salah
Dua komponen terpisah mendaftarkan aksi bernama sama `cancel` ke dalam kontrak `OrderActions`.

##### Contoh Benar
Gunakan nama aksi yang unik dan deskriptif, misal `cancelOrder` dan `cancelItem`.

---

### Rentang 4xx: Aksesibilitas & Anggaran Performa

#### KIL-401
- **Nama**: Anggaran ukuran chunk JavaScript per komponen terlampaui
- **Klasifikasi**: Anggaran Performa (Performance Budget)
- **Pemicu**: Ukuran chunk JavaScript hasil kompilasi komponen melebihi pagu anggaran yang disepakati (usulan standar: 8 KB gzipped).
- **Pesan**: `Ukuran chunk kompilasi komponen '{nama}' ({ukuran} KB) melebihi anggaran maksimal ({batas} KB)`
- **Rujukan**: [`spec/compiler-rules.md`](file:///c:/Users/haidaryuum/source/kylat/spec/compiler-rules.md)

##### Contoh Salah
Satu komponen monolitik yang mengompilasi ratusan baris method client dan templat besar hingga menghasilkan output 14 KB gzip.

##### Contoh Benar
Pecah komponen menjadi beberapa komponen anak modular (`<x-header>`, `<x-table>`, `<x-pagination>`) sehingga masing-masing komponen berada di bawah 8 KB gzip.

---

## 5. Ringkasan Status Uji & Pemicu Diagnosa

Setiap kode galat di atas wajib memiliki minimal **satu uji golden** (*diagnostic unit test*) di dalam paket `packages/compiler`:

```text
packages/compiler/test/diagnostics/
├── KIL-101-loose-comparison.phpt
├── KIL-102-strict-types-required.phpt
├── KIL-103-no-static-global.phpt
├── KIL-110-allowlist-violation.phpt
├── KIL-120-client-io-forbidden.phpt
├── KIL-130-ambiguous-array-type.phpt
├── KIL-131-missing-type-or-invalid-concat.phpt
├── KIL-140-byte-level-string-function.phpt
├── KIL-151-unsupported-directive.phpt
├── KIL-152-raw-html-forbidden.phpt
├── KIL-153-invalid-event-handler.phpt
├── KIL-154-bind-target-not-state.phpt
├── KIL-155-foreach-missing-key.phpt
├── KIL-156-error-path-not-state.phpt
├── KIL-157-effect-calls-server.phpt
├── KIL-158-disallowed-url-scheme.phpt
├── KIL-159-curly-in-directive-attribute.phpt
├── KIL-160-curly-in-style-or-on-attribute.phpt
├── KIL-201-single-component-per-file.phpt
├── KIL-203-member-order-violation.phpt
├── KIL-204-client-method-complexity.phpt
├── KIL-205-complex-template-logic.phpt
├── KIL-211-circular-component-dependency.phpt
├── KIL-212-child-component-undeclared.phpt
├── KIL-310-action-missing-authorize.phpt
├── KIL-311-action-name-collision.phpt
└── KIL-401-chunk-budget-exceeded.phpt
```
