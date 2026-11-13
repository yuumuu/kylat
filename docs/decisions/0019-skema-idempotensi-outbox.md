# ADR 0019: Skema Idempotensi Database dan Transactional Outbox

- **Status**: DITERIMA
- **Tanggal**: 13 November 2026
- **Penulis**: Arsitek Backend
- **Konteks**: ADR 0007/0018 menetapkan database MySQL utama + PostgreSQL uji untuk Fase 3.

---

## 1. Skema `kylat_idempotency_keys`

| Kolom | Tipe | Aturan |
|---|---|---|
| `user_id` | `VARCHAR(255)` | identitas pemanggil: `user:<id>` atau `anon:<session_hash>` |
| `key` | `VARCHAR(128)` | nilai `Idempotency-Key` (8–128 karakter) |
| `action` | `VARCHAR(255)` | nama aksi |
| `payload_hash` | `CHAR(64)` | SHA-256 payload kanonikal |
| `status` | `VARCHAR(20)` | `in_progress` atau `completed` |
| `response` | `MEDIUMTEXT`/`TEXT` | JSON respons; maksimum 64 KB |
| `attempts` | `INT` | jumlah percobaan; default 1 |
| `locked_until` | `TIMESTAMP NULL` | lease in-progress |
| `expires_at` | `TIMESTAMP` | `created_at + 24 jam` |
| `created_at` | `TIMESTAMP` | waktu dibuat |
| `updated_at` | `TIMESTAMP` | waktu diperbarui |

Kekangan:

- `PRIMARY KEY (user_id, key)`.
- `INDEX (expires_at)` untuk pruning.
- Tidak memakai `INSERT IGNORE`.
- Duplikat ditangani per driver: MySQL `1062`, PostgreSQL `23505`, SQLite `23000`.

## 2. Skema `kylat_outbox`

| Kolom | Tipe | Aturan |
|---|---|---|
| `id` | big integer | auto increment |
| `event_id` | `CHAR(36)` | UUID unik |
| `event_type` | `VARCHAR(128)` | jenis efek samping |
| `payload` | `TEXT` | JSON event |
| `status` | `VARCHAR(20)` | `pending`, `processing`, `completed`, `failed` |
| `attempts` | `INT` | default 0 |
| `available_at` | `TIMESTAMP` | jadwal relay |
| `locked_until` | `TIMESTAMP NULL` | lease worker |
| `last_error` | `TEXT NULL` | pesan kegagalan terakhir, maksimum 2000 karakter |
| `created_at` / `updated_at` | `TIMESTAMP` | audit |

Kekangan: unique `event_id`, index `(status, available_at)`.

## 3. Semantik transaksi

1. Satu transaksi per panggilan mutasi.
2. `INSERT` baris idempotensi `in_progress` di dalam transaksi.
3. Handler bisnis dan `enqueueOutbox()` memakai koneksi/transaksi yang sama.
4. Sukses: update `completed` + response, lalu `COMMIT`.
5. Exception: `ROLLBACK` penuh; baris idempotensi dan outbox ikut hilang.
6. Replay: hash sama + `completed` → kembalikan response tanpa eksekusi.
7. Hash berbeda → `kylat:idempotency_conflict`.
8. In-progress dan lease masih aktif → `kylat:in_progress`.
9. Respons > 64 KB atau gagal disimpan → rollback dan `kylat:action_error`.
10. Tidak ada `markFailed` pada driver database.

## 4. Integrasi

- Migrasi disediakan di `packages/adapter-laravel/database/migrations/`.
- Driver `DatabaseIdempotencyStore` memakai PDO yang sama dengan handler.
- Controller memilih driver lewat `kylat.idempotency_driver` (`KYLAT_IDEMPOTENCY_DRIVER`), default `cache`; produksi wajib `database`.
- Driver Cache tetap tersedia untuk development/ephemeral, bukan produksi.
- Outbox relay worker belum diimplementasikan; event hanya ditulis ke tabel.

## 5. Uji wajib

- Replay idempotensi dan konflik hash.
- Rollback penuh saat handler exception.
- Outbox ikut rollback.
- Dua pemanggil berbeda dengan key sama tidak berbagi hasil.
- Uji konkurensi MySQL/PostgreSQL dijalankan sebelum klaim portabilitas.
- SQLite hanya untuk unit test logika, bukan bukti row-level lock.

## 6. Bukti uji konkurensi

`test/ConcurrencyIdempotencyTest.php` menjalankan dua proses PHP terpisah (`proc_open`, tanpa pcntl) dengan skenario:

1. Dua worker paralel, identity/key/hash sama → satu `completed`, satu `replay`, handler dieksekusi tepat sekali.
2. Replay setelah `completed` → tidak mengeksekusi handler.
3. Hash berbeda → `conflict`.
4. Identity berbeda dengan key sama → independen, keduanya `completed`.
5. Handler exception → baris idempotensi rollback; retry berhasil.

Hasil 13 November 2026:

- MySQL **8.4.2** (lokal): lulus semua skenario.
- PostgreSQL **18.4** (lokal): lulus semua skenario.
- Uji ini juga menemukan bug nyata: `quoteIdentifier($key)` pada `inspectExisting()` membuat query `WHERE "idem-key" = ?`; SQLite menerimanya sebagai string literal sehingga lolos, MySQL menolaknya dengan error 1054. Sudah diperbaiki menjadi `quoteIdentifier('key')`.
- CI menggunakan service container MySQL 8.0 dan PostgreSQL 15 pada workflow `ci.yml`.

Catatan: pada konkurensi DB nyata, worker kedua biasanya menerima `replay` (bukan `in_progress`) karena `INSERT` unik menunggu transaksi pertama commit. `in_progress` tetap valid untuk lease yang dibuat jalur non-transaksional.

## 7. Relay outbox

`OutboxRelay` ([`src/Support/OutboxRelay.php`](../../packages/adapter-laravel/src/Support/OutboxRelay.php)) menyediakan:

- `claim()`: `SELECT ... FOR UPDATE SKIP LOCKED` pada MySQL 8+/PostgreSQL, lease `locked_until`, `attempts + 1`.
- `complete()`: status `completed`.
- `fail()`: status `pending` + backoff eksponensial (`10s × 2^(attempts-1)`, maksimum 1 jam), atau `failed` setelah `maxAttempts`, dengan `last_error`.
- `run(callable $handler)`: klaim batch, panggil handler, tandai hasil.
- Payload bukan object JSON langsung ditandai `failed` dan tidak diteruskan ke handler.

Semantik pengiriman adalah **at-least-once**, bukan exactly-once. Handler wajib idempotent dan memakai `event_id` sebagai kunci deduplikasi. `OutboxRelay` tidak menyediakan daemon/Artisan command; aplikasi memanggilnya dari scheduler atau worker sendiri.

Bukti uji 13 November 2026 (`test/OutboxRelayTest.php`, `test/OutboxWorker.php`):

- SQLite: enqueue → claim → complete, backoff, max attempts, payload rusak.
- MySQL 8.4.2 dan PostgreSQL 18.4: 20 event, 2 worker paralel, hasil `10 + 10`, 20 eksekusi unik, 0 event tertinggal.
- CI memakai service container MySQL 8.0/PostgreSQL 15 dan menjalankan tes yang sama.
