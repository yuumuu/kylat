# ADR 0014: Rekonsiliasi Gerbang Fase 0/1 dan Otoritas STATUS

- **Status**: DITERIMA
- **Tanggal**: 13 November 2026
- **Penulis**: Arsitek Toolchain
- **Konteks**: `docs/handoff/STATUS.md` menyatakan Fase 0 dan Fase 1 ditutup, sedangkan Kylat 6 v1.2 masih mencantumkan blocker Fase 0 dan caveat Fase 1.

---

## 1. Keputusan

1. **STATUS adalah otoritas operasional untuk status penutupan fase.** Kylat 6 tetap menjadi dokumen perencanaan dan alasan historis; daftar blocker di dalamnya tidak otomatis membuka kembali fase yang sudah ditutup.
2. **Fase 0 dan Fase 1 berstatus “DITUTUP dengan pengecualian tercatat”**, bukan “terbukti penuh”. Pengecualian tetap dilacak sebagai risiko, bukan blocker tersembunyi:
   - verifikasi nama eksternal belum independen;
   - Google Docs asli belum disinkronkan;
   - P8/P10 belum diukur sesuai definisi awal;
   - Safari iOS/JSC fisik, perangkat low-end, dan screen reader belum diuji;
   - ADR 0009 tetap USULAN.
3. **Golden `CartCounter.expected.js` disahkan pemilik proyek pada 10 November 2026.** Blocker “review manusia golden” di Kylat 6 dinyatakan tertutup oleh pengesahan tersebut; Kylat 6 lokal diberi catatan rujukan ADR ini.
4. **Fase 2 belum ditutup oleh ADR ini.** Fase 2 baru boleh ditutup setelah ADR 0012/0013 diimplementasikan, KIL-130 aktif, dan seluruh verifikasi hijau. Setelah itu STATUS diperbarui dan tag Fase 2 dapat dibuat.
5. **Backlog STATUS yang menamai “Fase 2: CLI & DX” diperbaiki** agar konsisten dengan Kylat 6: Fase 2 = Compiler, Fase 3 = Protokol/Adapter, Fase 4 = Rendering/DX, Fase 5 = Performa/Rilis.

## 2. Konsekuensi

- Kylat 6 lokal diberi catatan “status terkini: lihat STATUS dan ADR 0014”.
- STATUS menambahkan label “dengan pengecualian tercatat” pada Fase 0/1.
- Tidak ada perubahan kode.
- Tidak ada tag baru dalam ADR ini.
