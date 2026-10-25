# Laporan Spike S3: Sintaks Deklarasi Aksi Server (Interface vs Atribut)

- **ID Spike**: S3
- **Topik Terkait**: KEP-08 (Sintaks deklarasi aksi server)
- **Status**: **Lolos & Ditutup**
- **Tanggal**: 25 Oktober 2026
- **Pemilik**: Pemilik Proyek / Reviewer Teknis

---

## 1. Pertanyaan Riset & Kriteria Lolos

> **Pertanyaan**: Bagaimana bentuk sintaks deklarasi aksi server di komponen Kylat: pendekatan **Interface Kontrak** (`CartActions`) atau **Kelas Aksi Mandiri dengan Atribut** (`#[ServerAction] AddToCart`)?  
> **Kriteria Lolos**:
> 1. Kedua prototipe diuji analisis tipenya menggunakan PHPStan pada tingkat ketat tertinggi (Level 9).
> 2. Dipilih bentuk yang paling sederhana untuk pemula (P2: *satu konsep untuk memulai*) dan kompatibel dengan repo frontend terpisah (Mode A).

---

## 2. Pengujian Prototipe dengan PHPStan Level 9

Uji prototipe dijalankan di [`bench/spikes/s3-action-declaration/`](file:///c:/Users/haidaryuum/source/kylat/bench/spikes/s3-action-declaration):

### Prototipe A: Pendekatan Interface Kontrak (`CartActions`)
```php
// Kontrak: src/PrototypeA/Contracts/CartActions.php
interface CartActions
{
    public function add(string $productId, int $qty): CartResult;
    public function remove(string $productId): CartResult;
}

// Komponen: src/PrototypeA/Components/ProductCard.php
#[Uses(CartActions::class)]
final class ProductCard extends Component
{
    #[Client]
    public function handleAdd(): CartResult
    {
        return $this->server(CartActions::class)->add($this->productId, $this->qty);
    }
}
```
- **Hasil PHPStan Level 9**: **[OK] 0 errors**.
- Penanganan Tipe: PHPStan menginferensi `$this->server(T::class)` mengembalikan instance `T`, sehingga pemanggilan method `add()`, tipe argumen, dan tipe balikan `CartResult` divalidasi 100% secara native.

### Prototipe B: Pendekatan Kelas Aksi Mandiri (`#[ServerAction] AddToCart`)
```php
// Kelas Aksi: src/PrototypeB/Actions/AddToCart.php
#[ServerAction]
final class AddToCart
{
    public function authorize(User $user, string $productId): bool { ... }
    public function handle(string $productId, int $qty): CartResult { ... }
}

// Komponen: src/PrototypeB/Components/ProductCard.php
#[Uses(AddToCart::class)]
final class ProductCard extends Component
{
    #[Client]
    public function handleAdd(): CartResult
    {
        return $this->server(AddToCart::class)->handle($this->productId, $this->qty);
    }
}
```
- **Hasil PHPStan Level 9**: **[OK] 0 errors**.

---

## 3. Evaluasi Perbandingan

| Dimensi Evaluasi | Prototipe A: Interface (`CartActions`) | Prototipe B: Kelas Aksi (`AddToCart`) |
|---|---|---|
| **Kesesuaian untuk Pemula** | **Tinggi & Rapi**: Aksi terkait (tambah, hapus, perbarui) dikelompokkan dalam 1 kontrak logis. | **Cenderung Membingungkan**: Mengharuskan 1 file per aksi. Komponen dengan 4 aksi harus mendeklarasikan 4 atribut `#[Uses]`. |
| **Separasi Repo FE & BE (Mode A)** | **Alami**: Interface hanya memuat signature publik, tanpa logika server atau dependensi database, sehingga aman disinkronkan ke repo FE via `sync-contract`. | **Bermasalah**: Kelas aksi server di backend memuat model Eloquent/ORM dan logika rahasia yang tidak boleh ada di repo frontend statis. |
| **Dukungan Autocomplete IDE** | **Lengkap**: Mengetik `$this->server(CartActions::class)->` langsung menampilkan seluruh opsi aksi dalam domain tersebut. | Terbatas pada method `handle()`. |
| **Penamaan Wire Protocol** | Alami memetakan ke nama batch RPC: `CartActions.add`. | Memetakan ke `AddToCart.handle`. |

---

## 4. Keputusan

Spike S3 resmi **ditutup**. Proyek Kylat menetapkan **Pendekatan Interface Kontrak (Prototipe A)** sebagai sintaks resmi deklarasi aksi server:

1. **Di Komponen Frontend**: Menggunakan atribut `#[Uses(NamaKontrak::class)]` dan memanggil method aksi melalui `$this->server(NamaKontrak::class)->namaMethod(...)`.
2. **Di Backend (Adapter Laravel)**: Kontrak didefinisikan sebagai interface PHP biasa. Backend mengimplementasikannya via handler kelas atau mendelegasikannya ke action class internal.
3. Status **KEP-08** diubah menjadi **PUTUSAN**.
