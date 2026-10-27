# Referensi Implementasi Idempotensi Adapter Laravel

> **Status**: Dokumen Non-Normatif. Sumber kebenaran kontrak protokol adalah [`spec/threat-model.md §3.1`](../../../spec/threat-model.md).

Dokumen ini mendokumentasikan desain teknis, status kesesuaian saat ini, dan rencana migrasi implementasi idempotensi mutasi pada `packages/adapter-laravel`.

---

## 1. Status Kepatuhan Saat Ini terhadap §3.1

Implementasi saat ini pada `packages/adapter-laravel` (`IdempotencyStore` berbasis Laravel `Cache` facade) **BELUM MEMENUHI** aturan 5 dan aturan 8 dari kontrak protokol [`spec/threat-model.md §3.1`](../../../spec/threat-model.md):

* **Pelanggaran Aturan 5 (Efek Samping Paling Banyak Sekali)**:
  * Pada `KylatBatchCallController`, blok `catch (\Throwable $e)` memanggil `IdempotencyStore::markFailed()`. Jika mutasi database telah tercommit sebagian atau seluruhnya sebelum terjadi exception, panggilan retry klien akan diizinkan mengeksekusi ulang handler mutasi, memicu duplikasi efek samping.
  * Jalur `Cache` menggunakan pola `get` lalu `put` yang tidak atomik (*check-then-act / TOCTOU*).
  * `set_time_limit` hanya membatasi CPU time, bukan wall-clock time. Aksi yang menunggu I/O eksternal tetap dapat melampaui lease 30 detik tanpa dihentikan.
  * `IdempotencyStore::heartbeat()` saat ini wajib dipanggil manual; tanpa pemanggilan eksplisit, lease akan mati dan aksi berdurasi lama ditolak saat `complete()`.
* **Pelanggaran Aturan 8 (Larangan Keberhasilan tanpa Jaminan Replay)**:
  * Kunci idempotensi belum diisolasi per-user (`PRIMARY KEY (user_id, key)`), sehingga berisiko kebocoran replay antar-pengguna (*cross-user replay*).
  * Belum ada penolakan mutasi jika penyimpanan respons gagal atau melebihi batas kuota.

---

## 2. Rencana Arsitektur Migrasi: Jaminan Atomisitas Berbasis Database

Untuk memenuhi §3.1 secara penuh, adapter Laravel akan dimigrasikan dari driver Cache ke transaksi database ACID:

### A. Skema Tabel `kylat_idempotency_keys`
Migrasi database Laravel (`packages/adapter-laravel/database/migrations/`) akan mendefinisikan:
- `user_id`: `VARCHAR(255)` NOT NULL — Identitas pengguna pemilik sesi/token (atau `anon:<session_hash>`).
- `key`: `VARCHAR(128)` NOT NULL — Nilai header `Idempotency-Key` (8–128 karakter).
- `action`: `VARCHAR(255)` NOT NULL — Nama aksi kontrak yang dipanggil.
- `payload_hash`: `CHAR(64)` NOT NULL — Hash SHA-256 dari JSON kanonikal (RFC 8785) atas `action` dan `args`.
- `status`: `VARCHAR(20)` NOT NULL — Nilai: `'in_progress'`, `'completed'`.
- `response`: `MEDIUMTEXT` / `JSON` NULLABLE — Payload JSON respons (maksimal 64 KB; dilarang memuat kredensial/rahasia).
- `created_at`: `TIMESTAMP` NOT NULL.
- `updated_at`: `TIMESTAMP` NOT NULL.
- `expires_at`: `TIMESTAMP` NOT NULL — Batas kedaluwarsa record (`created_at` + 24 jam).

**Kekangan Integritas**:
- `PRIMARY KEY (user_id, key)` — Mencegah replay lintas pengguna.
- `INDEX idx_expires_at (expires_at)` — Untuk kebutuhan job pembersihan (*pruning*).

### B. Prosedur Transaksi Per-Panggilan
1. **Satu Transaksi Per Panggilan**: Setiap elemen dalam array `calls` dieksekusi dalam transaksi DB terpisah. Batch tidak atomik sebagai satu unit.
2. **Koneksi Database Sama**: Handler aksi dan operasi tabel `kylat_idempotency_keys` wajib menggunakan instance koneksi database (PDO) yang sama persis.
3. **Lock Timeout Ter-scope**: Timeout kunci (`lock_timeout` pada PostgreSQL atau `innodb_lock_wait_timeout` pada MySQL) diatur di awal transaksi (misal 5 detik) dan dikembalikan ke nilai semula pada blok `finally`.
4. **Pencegahan Error Tertelan**:
   - Gunakan `INSERT` standar.
   - Tangkap secara presisi kode error duplikat database: **MySQL `1062`** atau **PostgreSQL SQLSTATE `23505`**. Dilarang menggunakan `INSERT IGNORE` yang menelan warning data truncation.
   - Jika terjadi duplikasi, lakukan kueri `SELECT ... FOR UPDATE` untuk memeriksa status `completed` (replay jika hash cocok, `kylat:idempotency_conflict` jika hash beda) atau tolak `kylat:in_progress` jika masih berjalan / lock wait timeout.
5. **Rollback Semantik Tanpa `markFailed`**:
   - Jika handler melempar exception sebelum komit, transaksi di-rollback secara utuh.
   - Baris `in_progress` otomatis terhapus bersama efek samping mutasi.
   - Tidak ada pemanggilan `markFailed`. Retry klien aman dieksekusi kembali dari awal.
6. **Batas Ukuran Respons**: Jika respons melebihi 64 KB atau gagal disimpan ke database, transaksi mutasi wajib di-`ROLLBACK` dan mengembalikan galat `kylat:action_error`.

---

## 3. Strategi Pengujian & Verifikasi

* **Batas SQLite**: SQLite menggunakan file-level lock serial sehingga tidak dapat memvalidasi *row-level lock wait* atau *deadlock*. Pengujian konkurensi adapter wajib dijalankan pada **MySQL dan PostgreSQL sungguhan** via container Docker di pipeline CI.
* **Uji Kasus Wajib**:
  1. Dua request paralel dengan pasangan `(user_id, key)` dan payload sama: hanya 1 mutasi yang berhasil dieksekusi, request kedua menerima respons replay.
  2. Dua request paralel dengan `user_id` berbeda dan `key` sama: kedua mutasi dieksekusi independen tanpa tumpang tindih.
  3. Exception di tengah handler: membuktikan efek samping database dan baris idempotensi ter-rollback penuh, dan retry langsung berhasil tanpa duplikasi.
  4. Uji conformance kanonikalisasi payload hash terhadap RFC 8785.
