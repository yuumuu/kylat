# bench/

Harness benchmark yang bisa diulang orang lain. Tidak ada angka performa di dokumentasi yang boleh berasal dari tempat lain.

```
scenarios/    skenario yang diukur (counter, tabel 1.000 baris, keranjang)
baselines/    hasil terarsip per rilis, beserta versi runtime dan perangkat
scripts/      runner
```

**Aturan:** setiap klaim performa wajib menyertakan skrip, versi, dan perangkat. Angka tanpa skrip dianggap hipotesis.

**Belum ditetapkan:** satu matriks pembanding. Saat ini ada tiga set berbeda — Dokumen 1 §3 (Solid/Svelte 5/Vue Vapor), Dokumen 5 §7 (Livewire 4), Dokumen 6 G4 (Svelte/TanStack Query/openapi-typescript). Perlu satu matriks per fase (audit S-01).
