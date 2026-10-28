# spec/template.md — Sintaks templat Kylat v0

Status: disahkan untuk v0 (revisi P0, 25 Oktober 2026). Berlaku untuk bagian HTML di berkas komponen .php.
Menjawab temuan K-01 (templat dan direktif tidak dispesifikasikan).

## 1. Prinsip

1. Sintaks mirip Blade, supaya developer PHP langsung familiar (P1, P2).
2. Templat berisi ekspresi, bukan kode. Ekspresi harus berasal dari subset di spec/php-subset.md.
3. Tidak ada HTML mentah. Output dinamis selalu di-escape (C1 di dokumen 3).
4. Setiap kesalahan templat menghasilkan kode KIL-15x dengan lokasi baris templat (P3).

## 2. Ekspresi

- `{{ $expr }}` menampilkan hasil ekspresi dengan escape HTML.
- Nama yang bisa dibaca: prop (`$products`), state (`$query`), dan computed (`$visibleProducts`).
- Template tidak boleh memanggil method PHP secara langsung. Logika masuk ke computed atau aksi.
- Helper yang boleh dipakai di template hanya fungsi dari allowlist di spec/php-subset.md.

## 3. Direktif kontrol

| Direktif | Keterangan |
|---|---|
| `@if (expr)` ... `@elseif (expr)` ... `@else` ... `@endif` | Percabangan |
| `@foreach ($list as $item)` ... `@empty` ... `@endforeach` | Perulangan. `@empty` opsional |
| `key="{{ $item->id }}"` | Wajib pada elemen anak langsung di dalam `@foreach`. Nilai harus string unik |

Tidak didukung di v0: `@for`, `@while`, `@switch`, `@php`, `@include`, `@extends`, `@yield`, `@section`, `@component`, `@slot`. Pemakaian direktif tersebut menghasilkan KIL-151.

Catatan: `@extends`, `@section`, dan `@yield` tidak masuk v0 karena layout diatur oleh router dan halaman, bukan oleh templat komponen.

## 4. Atribut khusus

| Atribut | Contoh | Aturan |
|---|---|---|
| `bind:value` | `<input bind:value="$query">` | Dua arah. Target wajib state, bukan prop (KIL-154) |
| `bind:checked` | `<input type="checkbox" bind:checked="$agree">` | Dua arah untuk checkbox |
| `on:click` | `<button on:click="add({{ $item->id }})">` | Nama method wajib dideklarasikan `#[Client]` atau `#[Server]` (KIL-153) |
| `on:input`, `on:change`, `on:submit`, `on:keydown` | `<input on:input="search">` | Daftar event v0. Event lain ditolak (KIL-153) |
| `error` | `<span error="email">` | Menampilkan pesan validasi field. Compiler menambahkan `aria-describedby` dan `aria-invalid`. Field harus state (KIL-156) |

Pemanggilan dengan argumen: `on:click="add(item.id)"`. Argumen harus ekspresi dari subset. Argumen tidak boleh berupa nilai mentah dari DOM tanpa tipe.

Indikator proses tidak perlu ditulis. Saat aksi `#[Server]` berjalan, compiler menambahkan `aria-busy="true"` dan atribut `data-pending` di elemen pemicu.

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

## 7. Dilarang di v0

- HTML mentah: `{!! ... !!}` dan sejenisnya (KIL-152).
- Script dan style inline yang dinamis.
- Komponen anak tanpa deklarasi `#[Uses]` (KIL-211).

## 8. Kode galat templat

| Kode | Kondisi | Contoh perbaikan |
|---|---|---|
| KIL-151 | Direktif tidak didukung atau tidak dikenal | Ganti dengan `@if` atau `@foreach` |
| KIL-152 | HTML mentah | Gunakan `{{ }}` |
| KIL-153 | `on:` mengarah ke method yang tidak dideklarasikan atau event di luar daftar | Tambahkan `#[Client]` atau `#[Server]` |
| KIL-154 | `bind:` mengarah ke prop atau ekspresi | Gunakan state |
| KIL-155 | `@foreach` tanpa `key` | Tambahkan `key="{{ $item->id }}"` |
| KIL-156 | `error` mengarah ke field yang bukan state | Hubungkan ke state atau field validasi |
| KIL-157 | `#[Effect]` memanggil `#[Server]` | Pindahkan ke `#[OnMount]` atau aksi yang dipicu user |
| KIL-158 | URL dengan skema tidak diizinkan | Gunakan `https` atau path relatif |

## 9. Keterkaitan

- P1 (sintaks sama dengan PHP biasa): bagian 2 sampai 4.
- P2 (satu konsep untuk memulai): quick start hanya memakai `{{ }}`, `@if`, `@foreach`, `bind:value`, dan `on:click`.
- P3 (error bisa dipahami): setiap kode bagian 8 punya contoh perbaikan.
- P6 (keamanan default aman): bagian 2 dan 6.

Daftar ini menjadi sumber kebenaran untuk pemetaan Livewire di dokumen 5 bagian 8. Setiap perubahan di sini wajib diikuti pembaruan dokumen 2 bagian 10 dan dokumen 5 bagian 8.
