# docs/

Dokumentasi pengguna. Bukan tempat spesifikasi — spesifikasi ada di `spec/`.

```
tutorial/     jalur dari nol ke komponen pertama
guide/        tugas sehari-hari: form, list, aksi server, deployment
reference/    referensi API, kode error, konfigurasi
decisions/    ADR: keputusan arsitektur beserta alasannya
```

**Aturan dari dokumen 6:** hanya contoh quick start yang diuji di CI. Dokumentasi lain diverifikasi saat rilis, dan setiap klaim harus bisa dilacak ke kode atau ke `spec/`.

**Struktur & Status:**
- `tutorial/` — panduan jalur dari nol ke komponen pertama *(belum ada, menunggu fase 0)*
- `guide/` — panduan praktis: form, list, aksi server, deployment *(belum ada, menunggu fase 1)*
- [`reference/errors.md`](file:///c:/Users/haidaryuum/source/kylat/docs/reference/errors.md) — referensi kode galat dan panduan perbaikan (menaut ke `spec/errors.md`)
- [`decisions/README.md`](file:///c:/Users/haidaryuum/source/kylat/docs/decisions/README.md) — register keputusan arsitektur (ADR KEP-01 s/d KEP-33 dan prinsip P1–P12)

