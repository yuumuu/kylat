# spec/threat-model.md — Model Ancaman & Kontrol Keamanan Kylat v0

Status: **Normatif**.
Disahkan: 25 Oktober 2026.
Dasar: Dokumen 3 §9 (Invarian Keamanan) dan §11 (Katalog Ancaman A1–D3).

Dokumen ini mendefinisikan model ancaman keamanan (*threat model*), batas kepercayaan (*trust boundary*), dan kontrol teknis wajib yang harus dipatuhi oleh compiler, runtime browser, protokol RPC, dan adapter backend Kylat.

---

## 1. Batas Kepercayaan (*Trust Boundaries*)

```
+-------------------------------------------------------------+
|                      UNTRUSTED ZONE                         |
|  Browser Environment (Client JS, DOM, Network Wire, Input)  |
+-------------------------------------------------------------+
                              |
     [HTTP / Wire RPC: POST /_kylat/call, JSON Strict Schema]
     [Headers: X-Kylat-Build, X-CSRF-Token, Idempotency-Key]
                              |
                              v
+-------------------------------------------------------------+
|                       TRUSTED ZONE                          |
|  Server Environment (Backend Adapter, Database, Storage)    |
|  - Otorisasi Per-Objek & Per-Aksi                           |
|  - Validasi Skema & Sanitasi                                |
|  - Rate Limiting & Audit Log                                |
+-------------------------------------------------------------+
```

1. **Client Tidak Pernah Dipercaya**: Semua input pengguna, prop hidrasi, argumen aksi RPC, dan status komputasi client dianggap dapat dimanipulasi oleh penyerang. Validasi di client hanyalah bantuan UX; server selalu memvalidasi ulang secara independen.
2. **Server Selalu Menjadi Otoritas**: Akses data, otorisasi, mutasi state persisten, dan aturan bisnis diputuskan secara eksklusif oleh server.

---

## 2. Invarian Keamanan Non-Negosiasi

1. **Bebas Eksekusi Dinamis**: Tanpa `eval()`, `new Function()`, `unserialize()`, atau refleksi dinamis dari input pengguna. Kompatibel penuh dengan CSP ketat tanpa `unsafe-eval`.
2. **Default Deny**: Setiap aksi server wajib memiliki otorisasi eksplisit (`authorize()`). Aksi tanpa otorisasi ditolak saat build (`KIL-310`) atau saat runtime oleh backend adapter.
3. **Idempotensi Mutasi Atomik**: Setiap mutasi RPC wajib menyertakan `Idempotency-Key` (panjang 8–128 karakter, TTL 24 jam) yang dikelola secara atomik dalam satu transaksi database ACID bersama efek samping mutasi.
4. **Isolasi Rahasia**: Tidak ada rahasia atau kredensial yang dikirim ke client. Hanya variabel dengan prefiks `PUBLIC_` yang diizinkan masuk ke bundel frontend.
5. **DOM Kebal XSS**: DOM hanya dimanipulasi via API aman (`textContent`, `setAttribute` terfilter). Output HTML mentah dilarang (`KIL-152`); jika didukung di masa depan wajib melalui W3C Trusted Types.
6. **Satu Temuan = Satu Uji Regresi**: Setiap temuan celah keamanan wajib menghasilkan minimal satu unit/e2e test regresi otomatis di CI.

---

## 3. Katalog Ancaman Ringkas & Kontrol Mitigasi

### Kategori A: Integritas Payload, Deserialisasi & Replay

| ID | Ancaman | Dampak | Kontrol Mitigasi Wajib |
|---|---|---|---|
| **A1** | **Deserialisasi Tak Aman** (pola Livewire CVE-2025-54068, React2Shell) | RCE / Eksekusi kode arbitrary di server | Menggunakan format JSON polos dengan skema ketat (`spec/protocol.schema.json`). Dilarang keras menggunakan `unserialize()` PHP atau deserialisasi objek dinamis. |
| **A2** | **Prototype Pollution** | Kerusakan state client atau bypass autentikasi | Memvalidasi dan menolak payload ber-key `__proto__`, `constructor`, atau `prototype`. Menggunakan `Map` untuk struktur data dinamis di runtime JS. |
| **A3** | **Payload Bomb & ReDoS** | Denial of Service (DoS) pada parser server | Batas ukuran body 256 KB, kedalaman JSON max 16 tingkat, panjang string max 10.000 karakter, elemen array max 1.000. Regex dibatasi pada daftar teruji aman. |
| **A4** | **Replay Attack & Klik Ganda** | Duplikasi transaksi atau mutasi ganda | Wajib `Idempotency-Key` pada semua mutasi. Mutasi wajib berjalan dalam transaksi database ACID bersama tabel `kylat_idempotency_keys` (lihat §3.1). |
| **A5** | **Mass Assignment** (OWASP API3) | Modifikasi data ilegal melalui manipulasi atribut | Parameter aksi dipetakan ke DTO atau argumen bertipe ketat. Objek ORM/Model tidak pernah di-bind langsung dari input raw. |

### Kategori B: Otorisasi, Akses & Autentikasi

| ID | Ancaman | Dampak | Kontrol Mitigasi Wajib |
|---|---|---|---|
| **B1** | **BOLA / IDOR** (OWASP API1) | Pengguna mengakses atau mengubah data milik pengguna lain | Kewajiban method `authorize(User $user, string $id)` untuk setiap aksi berparameter ID (`KIL-310`). Pemeriksaan dijalankan sebelum `handle()`. |
| **B2** | **BFLA** (OWASP API5) | Pengguna biasa memanggil fungsi administratif | Kebijakan *Default Deny* di tingkat adapter backend. Setiap endpoint memvalidasi role/permission. |
| **B3** | **Pencurian Token & Session Hijacking** | Pengambilalihan akun pengguna | Cookie ditandai `HttpOnly`, `Secure`, `SameSite=Lax/Strict`. Untuk mode token: masa berlaku access token 15 menit, refresh token dirotasi. |
| **B4** | **Cross-Site Request Forgery (CSRF)** | Eksekusi aksi atas nama pengguna korban | Header `X-CSRF-Token` divalidasi pada setiap mutasi mode cookie. Validasi header `Origin` dan `Sec-Fetch-Site`. |
| **B5** | **Brute Force & Abuse** (OWASP API6) | Serangan kamus atau eksploitasi fitur kuota | Rate limiting bertingkat: default 60 request/menit per akun terautentikasi, 20 request/menit per IP anonim. |

### Kategori C: Injeksi Klien & XSS

| ID | Ancaman | Dampak | Kontrol Mitigasi Wajib |
|---|---|---|---|
| **C1** | **DOM-based XSS** | Pencurian cookie, manipulasi tampilan, keylogging | Operasi rendering menggunakan `textContent` dan text node murni. Tag `<x-...>` diganti node DOM aman saat kompilasi. |
| **C2** | **XSS Lewat URL & Atribut** | Eksekusi script via atribut `href="javascript:..."` | Allowlist skema URL (`http`, `https`, `mailto`, `tel`) divalidasi setelah evaluasi ekspresi (`KIL-158`). Dilarang interpolasi `{{ }}` pada `style` atau `on*` (`KIL-160`). Serialisasi `data-props` menggunakan JSON hex-escape + single HTML attribute escape. |
| **C3** | **Client-Side Template Injection** | Injeksi sintaks template dari input pengguna | Templat dikompilasi menjadi JavaScript murni **hanya saat build**. Tidak ada template compiler di runtime produksi browser. |

### Kategori D: Jaringan, Cache & Server-Side Abuse

| ID | Ancaman | Dampak | Kontrol Mitigasi Wajib |
|---|---|---|---|
| **D1** | **Web Cache Deception & Poisoning** | Data sensitif pengguna tersimpan di shared CDN cache | Endpoint personal/terautentikasi wajib mengirim header `Cache-Control: private, no-store`. Path endpoint baca tidak boleh berakhiran ekstensi statis (`.css`, `.js`). |
| **D2** | **CORS Misconfiguration** | Pembocoran data API ke domain jahat | Allowlist Origin eksplisit pada adapter. Dilarang menggunakan wildcard `Access-Control-Allow-Origin: *` pada endpoint terautentikasi. |
| **D3** | **SSRF** (OWASP API7) | Server backend mengakses infrastruktur internal | Endpoint RPC Kylat tidak menerima input URL mentah untuk di-fetch oleh backend tanpa validasi domain terpercaya. |

---

### 3.1 Spesifikasi Normatif Mitigasi A4: Idempotensi Mutasi Berbasis Transaksi Database (ACID)

Untuk menjamin invarian **Zero Duplicate Execution** dan mencegah duplikasi saat terjadi kegagalan atau retry, seluruh mutasi backend Kylat wajib mengikuti kontrak atomisitas database berikut:

#### 1. Prinsip Atomisitas Efek Samping & Catatan Idempotensi
Mutasi state persistent dan catatan idempotensi wajib berada dalam **satu transaksi database ACID yang sama**. Efek samping dan status `completed` berhasil bersama-sama (*commit*), atau seluruhnya dibatalkan (*rollback*).

#### 2. Skema Tabel Otoritatif (`kylat_idempotency_keys`)
Adapter backend wajib menyediakan migrasi tabel database dengan skema minimal:
- `key`: `VARCHAR(128)` — Kunci unik dari client (`Idempotency-Key`), **PRIMARY KEY**.
- `action`: `VARCHAR(255)` — Nama aksi kontrak yang dipanggil.
- `payload_hash`: `CHAR(64)` — Hash SHA-256 dari JSON payload aksi kanonikal.
- `user_id`: `VARCHAR(255)`, NULLABLE — Identitas user untuk isolasi multi-tenant / kepemilikan.
- `status`: `VARCHAR(20)` — Nilai: `'in_progress'`, `'completed'`.
- `response`: `MEDIUMTEXT` / `JSON`, NULLABLE — Payload respons JSON yang dikembalikan saat status `'completed'`.
- `created_at`: `TIMESTAMP` — Waktu pembuatan rekaman.
- `updated_at`: `TIMESTAMP` — Waktu mutasi terakhir.
- `expires_at`: `TIMESTAMP` — Batas kedaluwarsa record (default TTL: `created_at` + 24 jam / 86.400 detik).

#### 3. Alur Transaksi Mutasi
1. Buka transaksi database (`BEGIN TRANSACTION`).
2. Masukkan baris baru ke tabel `kylat_idempotency_keys` dengan `key`, `action`, `payload_hash`, dan `status = 'in_progress'`.
   - Jika kunci sudah ada (pelanggaran *unique constraint*):
     - Lakukan kueri record yang ada.
     - Jika `status === 'completed'`:
       - Jika `payload_hash` berbeda: batalkan transaksi (`ROLLBACK`), tolak dengan `kylat:idempotency_conflict`.
       - Jika `payload_hash` identik: batalkan transaksi (`ROLLBACK`), kembalikan respons tersimpan (`replay`).
     - Jika `status === 'in_progress'`:
       - Batalkan transaksi (`ROLLBACK`), tolak dengan `kylat:in_progress`.
3. Jalankan handler mutasi aksi server.
4. Perbarui baris pada `kylat_idempotency_keys` menjadi `status = 'completed'` beserta `response` hasil eksekusi.
5. Komit transaksi database (`COMMIT`).

#### 4. Rollback Semantik (Eliminasi `markFailed` pada Jalur Mutasi)
- Jika terjadi exception atau kegagalan sebelum komit (pada langkah 3 atau 4), transaksi database di-rollback secara utuh (`ROLLBACK`).
- Baris `in_progress` ikut terhapus/batal bersama efek samping mutasi.
- **Dilarang memanggil `markFailed` pada jalur mutasi database**. Karena tidak ada data yang tercommit sebagian, client aman melakukan retry langsung tanpa risiko mutasi ganda dan tanpa terhalang lock sisa.

#### 5. Eliminasi Kebutuhan Lease & Heartbeat pada Mutasi
- Kegagalan proses worker, eksekusi melebihi batas waktu (timeout), atau crash koneksi jaringan akan secara otomatis memicu rollback oleh DBMS.
- Oleh karena itu, mekanisme *lease time* 30 detik dan perpanjangan *heartbeat* manual **tidak digunakan** pada jalur mutasi database ACID.

#### 6. Batasan Efek Samping Non-Database di v0
- Transaksi database hanya dapat me-rollback mutasi pada level basis data.
- Pada v0, **handler mutasi dilarang mengeksekusi efek samping non-database secara langsung** (misalnya pengiriman email langsung, panggilan webhook HTTP pihak ketiga, atau dispatch message queue eksternal).
- Seluruh efek samping eksternal wajib dicatat ke tabel *Transactional Outbox* dalam transaksi database yang sama, untuk kemudian diproses oleh worker latar belakang terpisah.

#### 7. Pemisahan Peran Store: Database vs Cache
- **Database (`kylat_idempotency_keys`)**: Satu-satunya store otoritatif untuk aksi mutasi (`POST /_kylat/call` tanpa `read: true`).
- **Cache Store (Redis / In-Memory)**: Hanya diizinkan untuk optimasi pemanggilan baca (`read: true`) atau rate limiting, dilarang menjadi store utama mutasi yang mengubah state persistent.

#### 8. Batas Waktu Transaksi
- Transaksi database mutasi wajib berdurasi singkat. Handler dilarang menahan transaksi terbuka untuk operasi komputasi berat atau pemanggilan I/O jaringan lambat.

---

## 4. Matriks Pengujian Keamanan di CI

Setiap kontrol keamanan diverifikasi secara otomatis dalam pipeline build dan CI:

```text
tests/security/
├── A1-no-unserialize-check.test.ts
├── A2-prototype-pollution.test.ts
├── A3-payload-bounds.test.ts
├── A4-idempotency-replay.test.ts
├── B1-bola-authorization-enforced.phpt
├── B4-csrf-token-validation.test.ts
├── C1-xss-interpolation-escaping.test.ts
├── C2-url-scheme-allowlist.test.ts
└── D1-cache-control-headers.test.ts
```
