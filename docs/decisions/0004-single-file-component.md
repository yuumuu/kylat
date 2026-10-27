# 0004: Format Komponen Single-File (*.kylat.php)

- **ID Keputusan**: KEP-34 (0004)
- **Topik**: Format Berkas Komponen Tunggal (*Single-File Component*)
- **Status**: Diusulkan (menunggu review pemilik proyek)
- **Tanggal Usulan**: 27 Oktober 2026
- **Pemilik**: Pemilik Proyek & Reviewer Teknis
- **Target Tenggat**: Fase 0

---

## 1. Konteks dan Masalah

Sebelum keputusan ini, komponen Kylat dirancang dengan memisahkan berkas logika kelas PHP (`Counter.php`) dan berkas templat markup (`counter.blade.php`).

Pemisahan dua berkas ini menimbulkan sejumlah friksi teknis dan pengalaman pengembang (*developer experience*):
1. **Proliferasi Berkas**: Setiap komponen membutuhkan minimal 2 berkas terpisah. Komponen kecil harus dikelola dalam dua tempat, meningkatkan beban navigasi di editor/IDE.
2. **Kesesuaian dengan Paradigma Frontend Modern**: Pengembang modern terbiasa dengan pendekatan *Single-File Component* (SFC) seperti pada Vue, Svelte, atau Astro, di mana logika komponen dan representasi visualnya berada dalam satu kesatuan kohesif.
3. **Kebutuhan Tooling & Editor**: Format komponen harus tetap ramah terhadap ekosistem PHP yang ada (PHP linter `php -l`, static analysis PHPStan/Psalm, dan syntax highlighting bawaan PhpStorm atau VS Code) tanpa memaksa pengembang menginstal ekstensi editor kustom sejak hari pertama.

---

## 2. Opsi yang Dipertimbangkan

### Opsi A: Ekstensi Kustom Murni (`.kylat`)
- Menyatukan komponen dalam berkas dengan ekstensi baru, misalnya `Counter.kylat`.
- **Kelebihan**: Bebas mendefinisikan batas blok dengan sintaks kustom (misal `<php>...</php>` dan `<template>...</template>`).
- **Kelemahan & Alasan Penolakan**:
  - Memutus kompatibilitas dengan ekosistem linter PHP bawaan (`php -l Counter.kylat` akan menolak atau gagal).
  - Seluruh editor kode (VS Code, PhpStorm, Neovim) memperlakukan berkas sebagai plain text tanpa pewarnaan sintaks (*syntax highlighting*) kecuali pengembang menginstal ekstensi khusus Kylat.
  - Melanggar Prinsip **P1** (*Sintaks PHP standar tanpa ekstensi aneh*) dan **P2** (*Satu konsep untuk memulai tanpa konfigurasi rumit*).

### Opsi B: Format Single-File Berbasis PHP Standar (`*.kylat.php`)
- Menyatukan komponen dalam satu berkas berakhiran ganda `.kylat.php`.
- Struktur berkas terbagi menjadi dua bagian alami menggunakan semantik dasar bahasa PHP:
  1. **Bagian Pertama (PHP)**: Dibuka dengan `<?php`, memuat `declare(strict_types=1);`, `namespace`, pernyataan `use`, dan tepat satu definisi kelas komponen `final class Nama extends Component`.
  2. **Pembatas & Bagian Kedua (Templat)**: Ditutup dengan tag penutup PHP standar `?>`, diikuti langsung oleh templat HTML/Kylat.
- **Kelebihan**:
  - **100% Valid PHP Sintaks**: Pemeriksaan `php -l Nama.kylat.php` sukses secara bawaan, karena runtime PHP menganggap teks setelah tag penutup `?>` sebagai teks HTML keluaran (*inline HTML*).
  - **Syntax Highlighting Otomatis**: Semua editor PHP secara alami mewarnai bagian PHP sebagai kode PHP dan bagian setelah `?>` sebagai HTML.
  - **Kemudahan Parsing AST**: Parser Tree-sitter dapat mengidentifikasi batas token `?>` secara presisi tanpa membutuhkan pre-processor regex kustom.
  - **Sesuai Filosofi Asli PHP**: Mengembalikan esensi PHP sebagai bahasa yang menyatukan logika kelas dan markup output.

---

## 3. Keputusan

1. **KEP-34**: Format Single-File Component (`*.kylat.php`) (Opsi B) diusulkan sebagai format resmi penulisan komponen Kylat.
2. Format struktur berkas `*.kylat.php`:
   - **Bagian Pertama**:
     - Tag pembuka `<?php`.
     - `declare(strict_types=1);` wajib di baris pertama pernyataan PHP.
     - Deklarasi `namespace`.
     - Pernyataan impor `use`.
     - Tepat satu kelas `final` turunan `Kylat\Component`.
     - Dilarang keras ada statement PHP lain di luar tubuh kelas komponen (menghasilkan galat `KIL-214`).
     - Nama kelas komponen wajib identik dengan nama berkas dalam format PascalCase (menghasilkan galat `KIL-215`).
   - **Bagian Kedua**:
     - Tag penutup `?>` wajib ada setelah tubuh kelas komponen.
     - Dilarang ada kode PHP (`<?php` atau `<?=`) setelah tag penutup `?>` (menghasilkan galat `KIL-216`).
     - Seluruh konten setelah `?>` adalah templat HTML dengan sintaks ekspresi Kylat sesuai [`spec/template.md`](../../spec/template.md).
3. Hubungan dengan Blade:
   - Templat komponen **tidak lagi** menggunakan berkas `.blade.php` terpisah.
   - Layout aplikasi host di Laravel tetap menggunakan Blade reguler dengan direktif `@kylat('Nama', $props)`.

---

## 4. Contoh Komponen Standar

Berkas: `resources/kylat/Counter.kylat.php`
```php
<?php
declare(strict_types=1);

namespace App\Kylat;

use Kylat\Attributes\Prop;
use Kylat\Attributes\Client;
use Kylat\Attributes\Server;
use Kylat\Attributes\Uses;
use Kylat\Component;
use App\Actions\CounterActions;

#[Uses(CounterActions::class)]
final class Counter extends Component
{
    #[Prop]
    public int $start = 0;

    public int $count = 0;

    #[Client]
    public function increment(): void
    {
        $this->count += 1;
    }

    #[Client]
    public function decrement(): void
    {
        $this->count -= 1;
    }

    #[Server]
    public function save(): void
    {
        $this->server(CounterActions::class)->saveCount($this->count);
    }
}
?>
<div>
  <button on:click="decrement()">-</button>
  <span>{{ $count }}</span>
  <button on:click="increment()">+</button>
  <button on:click="save()">Simpan</button>
</div>
```

---

## 5. Konsekuensi

- **Positif**:
  - Jumlah berkas komponen berkurang 50% (1 berkas per komponen alih-alih 2 berkas terpisah).
  - Developer experience meningkat drastis dengan seluruh konteks state, aksi, dan templat berada di satu tempat.
  - Kompatibel penuh dengan linter PHP (`php -l`), tooling analisis statis, dan IDE populer tanpa plugin khusus.
- **Batasan & Aturan Penegakan Compiler**:
  - Ditegakkan aturan build baru pada `@kylat/compiler`: `KIL-214`, `KIL-215`, dan `KIL-216`.

Pengesahan: belum. Menunggu review dan persetujuan tertulis dari pemilik proyek.
