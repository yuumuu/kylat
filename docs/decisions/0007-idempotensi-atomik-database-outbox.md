# 0007: Idempotensi Atomik Berbasis Transaksi Database & Outbox Pattern

- **ID Keputusan**: KEP-36 (0007)
- **Topik**: Arsitektur Penyimpanan Idempotensi Tingkat Produksi pada Adapter Laravel
- **Status**: DRAFT / KANDIDAT (Usulan untuk Fase 3)
- **Tanggal Usulan**: 10 November 2026
- **Pemilik**: Arsitek Backend & Tim Adapter Laravel
- **Target Tenggat**: Fase 3 (Produksi & Adapter Riil)

---

## 1. Konteks dan Masalah

Berdasarkan keputusan arsitektur per 9 November 2026, implementasi `IdempotencyStore` saat ini menggunakan facade `Cache` (Redis / In-memory) sebagai **solusi interim** untuk pengujian protokol wire.

Namun, terdapat risiko konsistensi data riil pada arsitektur dual-write (Database + Cache):
1. **Risiko Crash Pasca-Commit**:
   Jika transaksi bisnis di database telah di-*commit*, namun server mati/terputus sebelum `IdempotencyStore::complete()` berhasil menuliskan hasil ke Cache, maka *lease* akan kedaluwarsa.
2. **Retry Berisiko Duplikasi**:
   Saat klien mengirimkan retry dengan `Idempotency-Key` yang sama, backend tidak menemukan record `completed` di cache, sehingga berpotensi mengeksekusi mutasi bisnis untuk kedua kalinya (*duplicate execution*).
3. **Penyelarasan Threat Model**:
   `spec/threat-model.md §3.1` (Aturan 1 s/d 8) mewajibkan jaminan *exactly-once execution semantics* di tingkat server untuk seluruh aksi mutasi.

---

## 2. Opsi yang Dipertimbangkan

### Opsi A: Tabel `kylat_idempotency_keys` dalam Transaksi Atomik Database (Rekomendasi Utama ⭐)
- Menempatkan penyimpanan status idempotensi di database relasional yang sama dengan data bisnis:
  ```sql
  CREATE TABLE kylat_idempotency_keys (
      id VARCHAR(128) PRIMARY KEY,
      action_name VARCHAR(128) NOT NULL,
      payload_hash CHAR(64) NOT NULL,
      status VARCHAR(20) NOT NULL, -- 'in_progress', 'completed', 'failed'
      response_payload JSON NULL,
      created_at TIMESTAMP NOT NULL,
      locked_until TIMESTAMP NOT NULL,
      completed_at TIMESTAMP NULL
  );
  ```
- **Alur Transaksional**:
  1. `BEGIN TRANSACTION;`
  2. Insert / Lock record `kylat_idempotency_keys` dengan status `in_progress`.
  3. Jalankan logika aksi server pengguna (`handle()`).
  4. Perbarui status record menjadi `completed` beserta payload responsnya.
  5. `COMMIT;`
- **Kelebihan**:
  - **Atomisitas Mutlak (ACID)**: Mutasi data bisnis dan pencatatan idempotensi hidup atau mati bersama. Jika server crash di tengah jalan, transaksi di-rollback sepenuhnya dan status idempotensi tidak menggantung.
  - Kebal terhadap desinkronisasi dual-write.

### Opsi B: Transactional Outbox Pattern untuk Side Effect Eksternal
- Untuk aksi server yang melibatkan layanan pihak ketiga non-transaksional (misal: pembayaran Stripe atau pengiriman email), mutasi bisnis dan pesan outbox disimpan dalam database transaksi yang sama.
- Pekerjaan eksternal dieksekusi oleh worker antrean (*background relay worker*) yang menjamin eksekusi idempoten.

---

## 3. Rencana Penerapan (Fase 3)

1. Menyediakan migrasi database resmi di `@kylat/adapter-laravel` (`create_kylat_idempotency_table`).
2. Menambahkan driver penyimpanan `DatabaseIdempotencyDriver` yang mengimplementasikan `IdempotencyDriverInterface`.
3. Mempertahankan driver `Cache` sebagai opsi pengujian cepat atau lingkungan serverless ephemeral.
