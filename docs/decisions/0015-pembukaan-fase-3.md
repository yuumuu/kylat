# ADR 0015: Pembukaan Fase 3 — Protokol dan Adapter

- **Status**: DITUTUP — lihat ADR 0020 (`0020-penutupan-fase-3.md`)
- **Tanggal**: 13 November 2026
- **Penulis**: Arsitek Toolchain
- **Konteks**: Fase 2 berada pada tahap rekonsiliasi akhir; Fase 3 dibuka agar pekerjaan protokol/adapter punya urutan dan gerbang yang eksplisit.

---

## 1. Ruang lingkup Fase 3

Fase 3 mencakup kontrak wire, adapter Laravel, idempotensi, optimistic update, dan generator tipe. Mengacu pada Kylat 3 v1.2 dan Kylat 6.

## 2. Urutan tugas

1. **Kontrak GET dan schema**
   - `GET /_kylat/read/{aksi}` hanya untuk aksi `#[Server(read: true)]`.
   - Cache hanya untuk aksi `public: true`.
   - `GET /_kylat/schema` mengembalikan kontrak aksi dan tipe client.
   - `X-Kylat-Build` + `kylat:stale_build` (409).
   - `kylat:rate_limited` (429) dan Problem Details.
2. **Conformance suite**
   - Satu set kasus lintas-adapter untuk batch, error, header, batas, dan idempotensi.
3. **Optimistic update dan rollback**
   - Runtime RPC menyimpan state sementara, rollback pada `ok:false`, dan rekonsiliasi hasil server.
4. **Idempotensi database/outbox**
   - Implementasi ADR 0007: tabel idempotensi, transaksi, unique index, outbox.
   - Uji konkurensi MySQL/PostgreSQL/Redis nyata.
   - Reset state worker Octane/FrankenPHP.
5. **Generator tipe dan `sync-contract`**
   - Kontrak aksi menjadi tipe TypeScript dan validasi build.
6. **E2E keranjang dengan CSP ketat**
   - Skenario cart end-to-end, tanpa `unsafe-eval`, dengan hydration mismatch test bila SSR aktif.

## 3. Gerbang selesai Fase 3

- Spike S4 dan S5 lolos.
- Conformance suite hijau.
- Uji konkurensi database nyata hijau.
- Skenario keranjang lolos E2E dengan CSP ketat.
- Tidak ada endpoint GET yang mengubah state.
- Default-deny `authorize()` tetap berlaku pada semua aksi.

## 4. Non-goals

- SSR/prerender, HMR, dan generator proyek tetap di Fase 4.
- OpenAPI/Mode B tetap bersyarat G1–G5.
- Perubahan spec protokol wajib lewat ADR baru.

## 5. Konsekuensi

- Fase 3 resmi dibuka; STATUS dan register KEP diperbarui.
- Tugas pertama adalah kontrak GET read/schema dan tipe protokol, belum implementasi adapter penuh.
- Tidak ada perubahan kode pada ADR ini.
