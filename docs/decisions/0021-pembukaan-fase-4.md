# ADR 0021: Pembukaan Fase 4 — Rendering dan DX

- **Status**: DIBUKA
- **Tanggal**: 13 November 2026
- **Penulis**: Arsitek Toolchain
- **Konteks**: Fase 3 ditutup oleh ADR 0020; tag `v0.3.0-p3`.

---

## 1. Ruang lingkup

1. **Source map runtime dan strip produksi.**
2. **Prerender, SSR opsional, dan hydration mismatch test.**
3. **HMR, generator proyek, dan plugin Vite.**
4. **Pengujian fisik/mobile**: Safari iOS, JSC, perangkat low-end.
5. **Audit aksesibilitas nyata** dengan screen reader.

## 2. Urutan tugas

1. Source map:
   - `kylat build` menghasilkan `.js.map` + `//# sourceMappingURL` pada mode dev.
   - `--production` / `--no-sourcemap` menghapus map dan referensinya.
   - `manifest.json` mencatat `sourceMap` per komponen.
2. Vite plugin + HMR:
   - Plugin membaca `*.kylat.php`, mengompilasi saat dev, dan mengirim update modul.
   - Build produksi memakai compiler yang sama tanpa source map.
3. Generator proyek (`kylat new`) dan template minimal.
4. Prerender/SSR opsional:
   - Render awal island ke HTML, lalu hidrasi.
   - Deteksi mismatch antara markup server dan hasil klien; mismatch tidak boleh menimpa DOM secara diam-diam tanpa peringatan.
5. Audit aksesibilitas:
   - Baseline otomatis axe-core (WCAG 2 A/AA) pada contoh keranjang.
   - Audit manual screen reader (VoiceOver/NVDA) dan keyboard-only.
6. Pengujian perangkat fisik: Safari iOS, JSC, perangkat low-end.

## 3. Gerbang selesai

- Source map valid dan strip produksi terverifikasi.
- Plugin Vite + HMR berfungsi pada contoh nyata.
- `kylat new` menghasilkan proyek yang bisa `build` dan `test`.
- Prerender/SSR opsional lulus uji hydration mismatch.
- Tidak ada pelanggaran axe serius/kritis pada contoh keranjang.
- Audit screen reader dan perangkat fisik terdokumentasi.

## 4. Non-goals

- SSR wajib untuk semua aplikasi; SSR tetap opsional.
- Dukungan browser di luar target yang sudah ditetapkan.

## 5. Konsekuensi

- Fase 4 dibuka; STATUS dan register KEP diperbarui.
- Source map dev/produksi menjadi deliverable pertama.
