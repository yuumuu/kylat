# Checklist Audit Aksesibilitas dan Perangkat — Fase 4

Status: **otomatis dieksekusi (13 November 2026); audit manual ⛔ BLOCKED — tidak ada NVDA/VoiceOver/audio dan tidak ada perangkat fisik di lingkungan ini.** Lihat [`AUDIT-2026-11-13.md`](AUDIT-2026-11-13.md).

Contoh yang diaudit: `examples/05-cart-csp` (keranjang, CSP ketat).

## 1. Cakupan otomatis (sudah)

Dijalankan oleh `pnpm test:e2e` pada proyek Playwright `webkit` dan `iphone-13`:

- axe-core WCAG 2 A/AA: tidak ada pelanggaran `serious`/`critical`.
- Keyboard-only:
  - fokus ke tombol `Tambah`;
  - `Enter` menambah qty;
  - `Space` menambah qty;
  - `Tab` berpindah ke `Simpan ke Server`;
  - `Enter` mengirim RPC dan server menerima qty.
- Role dan nama aksesibel:
  - heading level 1 dan 2;
  - tombol `Tambah` dan `Simpan ke Server`;
  - live region `aria-live="polite"`.
- Profil perangkat: iPhone 13 (WebKit) + desktop WebKit.

## 2. Audit screen reader manual (belum)

Jalankan di build yang sama (`pnpm --filter @kylat/example-cart-csp dev` atau server contoh).

### VoiceOver (macOS Safari)

1. Aktifkan VoiceOver (`Cmd+F5`).
2. Muat halaman; pastikan judul halaman dan heading dibacakan berurutan.
3. Tab ke tombol `Tambah`; pastikan nama tombol dan perannya dibacakan.
4. Tekan `VO+Space`; pastikan qty baru dibacakan/dapat ditemukan.
5. Tab ke `Simpan ke Server`; aktifkan; pastikan tidak ada fokus hilang.
6. Pastikan live region mengumumkan perubahan status bila ada.

### VoiceOver (iOS Safari)

1. Aktifkan VoiceOver di Pengaturan > Aksesibilitas.
2. Geser ke kanan menyusuri heading, tombol, dan qty.
3. Aktifkan tombol dengan double-tap.
4. Pastikan tidak ada elemen yang tidak terjangkau atau label ganda.

### NVDA (Windows, Firefox/Chrome)

1. Aktifkan NVDA; gunakan `H` untuk heading dan `B` untuk tombol.
2. Pastikan urutan fokus logis dan nama tombol jelas.
3. Aktifkan tombol dengan `Enter`/`Space`.
4. Pastikan perubahan qty dapat dibaca tanpa memindahkan fokus.

### Kriteria lulus

- Semua kontrol dapat dijangkau keyboard dan screen reader.
- Nama peran/aksi diumumkan dengan benar.
- Tidak ada keyboard trap.
- Perubahan status penting diumumkan (live region).
- Zoom 200% tidak memotong konten.

## 3. Perangkat fisik (belum)

| Perangkat / lingkungan | Yang diperiksa |
|---|---|
| iPhone Safari (iOS terbaru) | layout, tap target, keyboard, CSP, tidak ada error |
| iPad Safari | orientasi, ukuran font, fokus |
| Android Chrome low-end | waktu muat, memori, interaksi |
| Safari JSC (iOS) | tidak ada error runtime, sinyal tetap reaktif |
| Jaringan 3G/4G lambat | hydration, RPC timeout/retry |

Prosedur: buka URL demo dari perangkat di jaringan yang sama, jalankan skenario keranjang (tambah 2, simpan), lalu catat hasil dan versi OS/browser.

## 4. Cara menjalankan otomatis

```bash
pnpm --filter @kylat/example-cart-csp test
```

Konfigurasi: [`playwright.config.mjs`](../../examples/05-cart-csp/playwright.config.mjs).
