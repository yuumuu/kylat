# ADR 0016: Penutupan Fase 2 — Compiler

- **Status**: DITERIMA
- **Tanggal**: 13 November 2026
- **Penulis**: Arsitek Toolchain
- **Konteks**: ADR 0014 menetapkan Fase 2 boleh ditutup setelah ADR 0012/0013 diimplementasikan, KIL-130 aktif, dan verifikasi hijau.

---

## 1. Bukti penyelesaian

- PR #3: aturan AST database client.
- PR #4: ADR 0011, rekonsiliasi closure/`usort`/`match`/kontrol alur.
- PR #5: tipe, IR, kontrol alur, closure, computed/lifecycle, differential test, source map.
- PR #6: Map JS, KIL-130, lifecycle v0, rekonsiliasi gerbang.
- `pnpm typecheck` lulus; `pnpm test` monorepo lulus.
- Compiler: 134 tes, 132 lulus, 0 gagal, 2 skip P8/P10.
- `pnpm lint:errors`: 37/37; 28 kode aktif dari 33.
- Golden `Counter.expected.js` dan `CartCounter.expected.js` identik.

## 2. Kriteria Fase 2

- Subset v0 yang didukung lolos differential test PHP vs JavaScript (13 kasus).
- Konstruksi terlarang menghasilkan KIL yang sesuai.
- IR eksekutabel dan source map tersedia.
- Tidak ada perubahan output golden tanpa persetujuan.

## 3. Pengecualian yang disetujui

- **Enum dan readonly value object ditunda ke v0.1.** `spec/php-subset.md` diperbarui agar tidak lagi mengklaim keduanya didukung di v0.
- KIL-203/204/205 tetap ditunda sesuai ADR 0008.
- KIL-211/KIL-401 adalah pemeriksaan tingkat proyek.
- Source map runtime/stack trace dan strip produksi masuk Fase 4.
- Callback database dinamis tetap risiko keamanan prioritas tinggi dan tidak dianggap tertutup.

## 4. Keputusan

Fase 2 **DITUTUP pada 13 November 2026** dengan tag `v0.2.0-p2` pada commit penutupan. Fase 3 yang sudah dibuka oleh ADR 0015 melanjutkan protokol/adapter.

## 5. Konsekuensi

- STATUS dan register KEP diperbarui.
- Tidak ada kode baru pada ADR ini.
