# docs/

Dokumentasi pengguna. Bukan tempat spesifikasi — spesifikasi ada di `spec/`.

```text
tutorial/     jalur dari nol ke komponen pertama (belum ada)
guide/        tugas harian: form, list, aksi server, deployment (belum ada)
reference/    referensi API dan kode error
decisions/    ADR: keputusan arsitektur beserta alasannya
handoff/      status operasional proyek
```

Aturan: hanya contoh quick start yang diuji di CI. Dokumentasi lain diverifikasi saat rilis; setiap klaim harus bisa dilacak ke kode atau `spec/`.

- [`reference/errors.md`](reference/errors.md) — referensi kode galat.
- [`decisions/README.md`](decisions/README.md) — register ADR.
- [`handoff/STATUS.md`](handoff/STATUS.md) — status implementasi terkini.

Mulai dari [README utama](../README.md) untuk perintah `make:component`, `check`, `build`, dan format single-file `*.kylat.php`.
