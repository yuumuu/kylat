# 0001: Penetapan Nama Proyek "Kylat"

- **ID Keputusan**: KEP-01 (0001)
- **Topik**: Penetapan dan Verifikasi Nama Proyek "Kylat"
- **Status**: **PUTUSAN**
- **Tanggal Verifikasi**: 27 Oktober 2026
- **Pemilik**: Pemilik Proyek
- **Target Tenggat**: Akhir Fase 0 (Tercapai)

---

## 1. Konteks dan Rasionalisasi Nama

Nama **Kylat** dipilih sebagai representasi karakteristik inti toolchain:
1. **Kecepatan & Performa**: Diadaptasi dari kata "kilat" (bahasa Indonesia: petir/sangat cepat), merepresentasikan proses kompilasi deterministik berbasis Tree-sitter WASM dan kecepatan reaktivitas sinyal (*fine-grained signals*) langsung ke DOM tanpa overhead Virtual DOM.
2. **Modernitas Identitas**: Penulisan fonetis menggunakan huruf "y" memberikan diferensiasi visual yang khas di ekosistem open-source global sekaligus mempertahankan akar lokal.
3. **Kesesuaian Lingkup**: Singkat, mudah diketik pada antarmuka baris perintah (`kylat`), dan tidak bertabrakan dengan istilah umum bahasa PHP maupun JavaScript.

---

## 2. Cakupan Penamaan di Seluruh Toolchain

Penetapan nama ini mengikat seluruh artefak proyek:

| Artefak / Komponen | Identifier Resmi | Keterangan |
|---|---|---|
| **CLI Binary** | `kylat` | Perintah CLI utama (`npx kylat` / `kylat build`) |
| **Paket NPM Compiler** | `@kylat/compiler` | Mesin parser Tree-sitter & codegen signals |
| **Paket NPM Runtime** | `@kylat/runtime` | Core signals (`alien-signals`), reconciler, & RPC client |
| **Paket NPM CLI** | `@kylat/cli` | Antarmuka command-line developer |
| **Paket NPM Induk** | `kylat` | Meta-package pembungkus toolchain |
| **Paket Packagist Utama** | `kylat/kylat` | Core library PHP (kontrak, atribut, base component) |
| **Paket Packagist Adapter** | `kylat/laravel` | Adapter backend Laravel (middleware, RPC controller) |
| **PHP Namespace** | `Kylat\` | Namespace PHP resmi untuk semua kelas & atribut |
| **Tag Komposisi Templat** | `<x-nama>` | Tag komponen anak (dideklarasikan via `#[Child]`) |
| **Atribut Komponen DOM** | `data-kylat-component` | Penanda identitas komponen pada elemen DOM root |
| **Endpoint RPC Wire** | `/_kylat/call` | Endpoint default panggilan batch RPC |

---

## 3. Bukti Pemeriksaan Registry & Kekayaan Intelektual

Pemeriksaan ketersediaan nama dan mitigasi risiko sengketa merek dagang dilakukan secara komprehensif pada **27 Oktober 2026**:

### A. NPM Registry (JavaScript Ecosystem)
- **Tautan Pemeriksaan**:
  - Halaman Paket: [https://www.npmjs.com/package/kylat](https://www.npmjs.com/package/kylat)
  - Registry API: [https://registry.npmjs.org/kylat](https://registry.npmjs.org/kylat)
- **Tanggal Diperiksa**: 27 Oktober 2026
- **Hasil & Bukti Teknis**:
  - Respons API: `HTTP 404 Not Found` (`{"error":"Not found"}`).
  - Nama paket `kylat` belum pernah didaftarkan atau digunakan oleh pihak lain.
  - Scope `@kylat` tersedia dan bebas konflik untuk paket modular (`@kylat/compiler`, `@kylat/runtime`, `@kylat/cli`).

### B. Packagist (PHP Composer Ecosystem)
- **Tautan Pemeriksaan**:
  - Halaman Vendor: [https://packagist.org/packages/kylat/](https://packagist.org/packages/kylat/)
  - Search API: [https://packagist.org/search.json?q=kylat](https://packagist.org/search.json?q=kylat)
- **Tanggal Diperiksa**: 27 Oktober 2026
- **Hasil & Bukti Teknis**:
  - Query penelusuran `q=kylat` menghasilkan 0 paket yang memakai nama atau vendor `kylat`.
  - Namespace vendor `kylat` (`kylat/kylat`, `kylat/laravel`) sepenuhnya tersedia untuk didaftarkan.

### C. GitHub (Source Code & Organisasi)
- **Tautan Pemeriksaan**:
  - Repositori Resmi: [https://github.com/yuumuu/kylat](https://github.com/yuumuu/kylat)
  - Search Repositories: [https://github.com/search?q=kylat&type=repositories](https://github.com/search?q=kylat&type=repositories)
- **Tanggal Diperiksa**: 27 Oktober 2026
- **Hasil & Bukti Teknis**:
  - Repositori utama aktif di `yuumuu/kylat` di bawah lisensi dan kontrol pemilik proyek.
  - Tidak ada proyek frontend framework publik lain dengan nama identik yang aktif dikembangkan.

### D. DJKI (Pangkalan Data Kekayaan Intelektual Republik Indonesia)
- **Tautan Pemeriksaan**:
  - Portal Resmi DJKI: [https://pdki-indonesia.dgip.go.id/](https://pdki-indonesia.dgip.go.id/)
- **Tanggal Diperiksa**: 27 Oktober 2026
- **Parameter Penelusuran**:
  - Kata Kunci Merek: `KYLAT`
  - Klasifikasi Nice:
    - **Kelas 09**: Perangkat lunak komputer, aplikasi perangkat lunak yang dapat diunduh, compiler, runtime.
    - **Kelas 42**: Jasa penelitian dan pengembangan perangkat lunak komputer, SaaS, konsultasi pemrograman komputer.
- **Hasil & Bukti Teknis**:
  - Tidak ditemukan pendaftaran merek aktif (*Registered*) maupun permohonan pendaftaran (*Pending Application*) untuk kata `KYLAT` pada Kelas 09 dan Kelas 42.
  - Nama aman digunakan sebagai nama perangkat lunak open source di wilayah hukum Republik Indonesia.

### E. WIPO (World Intellectual Property Organization)
- **Tautan Pemeriksaan**:
  - Global Brand Database: [https://branddb.wipo.int/](https://branddb.wipo.int/)
- **Tanggal Diperiksa**: 27 Oktober 2026
- **Parameter Penelusuran**:
  - Brand Name: `KYLAT`
  - Nice Classes: `09` (Software) & `42` (Computer services/software development).
- **Hasil & Bukti Teknis**:
  - Tidak ditemukan catatan merek dagang internasional yang aktif atau bertabrakan langsung untuk istilah `KYLAT` dalam kategori pengembangan perangkat lunak dan layanan teknologi informasi terkait.

---

## 4. Keputusan Akhir

1. Status **KEP-01** pada register keputusan arsitektur dinyatakan **PUTUSAN** (Tuntas).
2. Seluruh dependensi, konfigurasi repositori, dokumentasi, paket build, dan namespace resmi menggunakan nama **Kylat**.
3. Bukti verifikasi ini diarsipkan permanen sebagai bagian dari pemenuhan kriteria keluar (*exit gate*) Penutupan Fase 0.
