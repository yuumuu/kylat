# 0003: Spike S3 — Sintaks Deklarasi Kontrak Aksi Server

- **ID Keputusan**: KEP-08 (0003) / Spike S3
- **Topik**: Sintaks Deklarasi Aksi Server (Interface Kontrak vs Kelas Aksi Mandiri)
- **Status**: **PUTUSAN**
- **Tanggal Evaluasi & Keputusan**: 25 Oktober 2026
- **Pemilik**: Pemilik Proyek & Reviewer Teknis
- **Target Tenggat**: Akhir Fase 0 (Tuntas)

---

## 1. Konteks dan Pertanyaan Riset

Pada arsitektur Kylat, komponen frontend berjalan sebagai pulau interaktif (*interactive island*) di browser, sementara logika bisnis persisten, transaksi database, dan otorisasi dieksekusi di backend server (Prinsip P5: *Server adalah otoritas data*).

> **Pertanyaan Riset Spike S3**:  
> Bagaimana bentuk sintaks deklarasi aksi server pada komponen Kylat yang paling sederhana untuk pemula (Prinsip P2), ramah static analysis (PHPStan Level 9), serta aman untuk pemisahan repositori frontend dan backend pada Mode A?

### Opsi yang Diuji
1. **Prototipe A: Pendekatan Interface Kontrak (`CartActions`)**:
   Kontrak aksi didefinisikan sebagai interface PHP biasa. Komponen mengimpor kontrak via atribut `#[Uses(CartActions::class)]` dan memanggil method aksi melalui method proxy beranotasi generik `$this->server(CartActions::class)->add(...)`.
2. **Prototipe B: Pendekatan Kelas Aksi Mandiri dengan Atribut (`#[ServerAction] AddToCart`)**:
   Setiap aksi didefinisikan sebagai satu kelas mandiri dengan method `authorize()` dan `handle()`. Komponen mengaitkannya via `#[Uses(AddToCart::class)]` dan memanggil `$this->server(AddToCart::class)->handle(...)`.

---

## 2. Pengujian dan Validasi Prototipe

Kedua prototipe diuji secara empiris menggunakan **PHPStan Level 9** pada direktori [`bench/spikes/s3-action-declaration/`](file:///c:/Users/haidaryuum/source/kylat/bench/spikes/s3-action-declaration):

```text
------ ----------------------------------------------------------------------- 
  Line   src/PrototypeA/Components/ProductCard.php                                
------ ----------------------------------------------------------------------- 
  No errors                                                                   
------ ----------------------------------------------------------------------- 

------ ----------------------------------------------------------------------- 
  Line   src/PrototypeB/Components/ProductCard.php                                
------ ----------------------------------------------------------------------- 
  No errors                                                                   
------ ----------------------------------------------------------------------- 

 [OK] 0 errors
```

Keduanya berhasil lolos analisis tipe tingkat tertinggi PHPStan Level 9. Evaluasi perbandingan kualitatif dan arsitektural dilakukan terhadap kebutuhan operasional:

| Kriteria Evaluasi | Prototipe A: Interface (`CartActions`) | Prototipe B: Kelas Aksi Mandiri (`AddToCart`) |
|---|---|---|
| **Kesesuaian Pemula (P2)** | **Unggul**: Aksi terkait dalam satu domain (misal `add`, `remove`, `updateQty`) terkumpul dalam satu interface kohesif. | **Kurang**: Menuntut pembuatan banyak file kelas kecil; komponen dengan 4 aksi harus mendeklarasikan 4 atribut `#[Uses]`. |
| **Separasi Repo FE & BE (Mode A)** | **Unggul**: Interface hanya memuat signature publik murni tanpa kode logika/ORM, sehingga aman di-sync ke repo frontend via `kylat sync-contract`. | **Bermasalah**: Kelas aksi server di backend berisi referensi model Eloquent dan rahasia bisnis yang dilarang bocor ke frontend. |
| **Pengalaman Pengembang (DX & IDE)** | **Unggul**: Autocomplete IDE langsung menyarankan seluruh daftar aksi dalam interface setelah `$this->server(CartActions::class)->`. | **Terbatas**: Hanya menyarankan satu method generik `handle()`. |
| **Pemetaan Protokol RPC Wire** | **Deterministik**: Memetakan langsung ke format RPC `CartActions.add`. | Memetakan ke `AddToCart.handle`. |

---

## 3. Keputusan Arsitektur

1. Mengesahkan **KEP-08**: Proyek Kylat secara definitif menetapkan **Pendekatan Interface Kontrak (Prototipe A)** sebagai sintaks resmi deklarasi aksi server:
   - **Di Sisi Komponen Frontend**:
     ```php
     #[Uses(CartActions::class)]
     final class CartCounter extends Component
     {
         #[Server]
         public function submitOrder(): void
         {
             $this->server(CartActions::class)->add($this->productId, $this->qty);
         }
     }
     ```
   - **Di Sisi Backend (Adapter Laravel)**: Kontrak didefinisikan sebagai interface PHP standar dan di-bind ke service container Laravel atau class handler penyedia layanan.
2. Pemisahan tanggung jawab atribut:
   - `#[Uses(CartActions::class)]` khusus untuk kontrak aksi server.
   - `#[Child(Counter::class)]` khusus untuk perizinan render tag komponen anak `<x-counter>` (KEP-32).

---

## 4. Konsekuensi

- Pemisahan repositori frontend dan backend (Mode A) berjalan bersih tanpa risiko membocorkan dependensi internal server ke repositori frontend.
- Kode komponen tetap 100% PHP valid dan dapat dianalisis tipe secara utuh oleh PHPStan dan IDE (Intelephense / PhpStorm) tanpa plugin tambahan.
