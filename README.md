# Kylat

Toolchain frontend: komponen ditulis dengan subset PHP bergaya Livewire, dikompilasi menjadi JavaScript dengan reaktivitas fine-grained (signals) yang berjalan di browser. Server hanya dipanggil untuk hal yang memang membutuhkan server — data, penyimpanan, otorisasi — melalui protokol RPC netral bahasa. Frontend bisa di-host statis di CDN dan berbicara dengan backend mana pun yang mengimplementasikan kontrak.

**Status: Fase 0 (Fondasi) Selesai.** Seluruh spesifikasi normatif (`spec/`) telah lengkap. Spike S1 (Parser PHP via Tree-sitter WASM) dan Spike S3 (Interface kontrak aksi server) telah lolos dan ditutup. Siap memasuki Fase 1 (Runtime).

## Sumber kebenaran

Alasan dan riwayat keputusan masih hidup di Google Drive, folder `Kylat` → `01 Aktif (v1.1)`. Repo ini belum memuat salinannya.

**Yang mengikat implementasi adalah `spec/`**, bukan dokumen Drive. Urutan prioritas antar berkas spec ada di [`spec/README.md`](spec/README.md).

| Dokumen | Isi | Artefak spec terkait |
|---|---|---|
| Kylat 1 | Visi, ruang lingkup, mode distribusi, prinsip P1–P12 | — |
| Kylat 2 | Subset PHP v0, semantik, IR, format error | `spec/php-subset.md`, `spec/ir.md`, `spec/errors.md` |
| Kylat 3 | Protokol, keamanan, autentikasi, batas runtime | `spec/protocol.schema.json`, `spec/threat-model.md` |
| Kylat 4 | Arsitektur, runtime, struktur repo, aksesibilitas | `spec/compiler-rules.md` |
| Kylat 5 | Adopsi, CLI, migrasi dari Livewire 4 | — |
| Kylat 6 | Roadmap, register keputusan, gerbang | — |
| `template.md` | Grammar templat, komposisi `<x-nama>`, tiga kelas atribut, `data-props`, hubungan dengan Blade | `spec/template.md` |

## Struktur

```
spec/                 spesifikasi yang mengikat implementasi
packages/
  compiler/           parse, analyze, ir, codegen, diagnostics
  runtime/            signals, DOM, list, scheduler, RPC client
  protocol/           skema dan test konformansi
  adapter-laravel/    kontrak aksi, endpoint, direktif @kylat, policy
  cli/                create, dev, build, check, doctor, sync-contract, make:component, make:action, migrate:livewire
bench/                scenarios, baselines, scripts
examples/             contoh yang harus selalu berjalan
docs/                 tutorial, guide, reference, decisions
```

Aturan: setiap package punya README. Impor lintas package hanya lewat API publik. Lint mencegah dependensi sirkular. Modul di bawah sekitar 300 baris.

## Invarian

Yang tidak boleh dilanggar di seluruh repo, dari dokumen 3 §9:

1. Tanpa `eval`, `new Function`, `unserialize`, atau refleksi dinamis atas input.
2. Server selalu otoritas; client tidak pernah dipercaya.
3. Setiap aksi server punya otorisasi eksplisit, validasi skema, batas, dan idempotency untuk mutasi.
4. Default deny.
5. Tidak ada rahasia di client; hanya variabel `PUBLIC_` yang di-embed.
6. Respons terautentikasi atau personal tidak pernah di-cache bersama.
7. DOM hanya ditulis lewat API aman; HTML mentah hanya lewat Trusted Types.
8. Dependensi runtime minimum, di-pin, tanpa install script.
9. Konfigurasi aman secara default; `kylat doctor` gagal di CI bila tidak aman.
10. Setiap temuan keamanan menghasilkan satu uji regresi.

Selain itu: tidak ada klaim performa tanpa harness benchmark yang bisa diulang.

## Belum ada di repo ini

Sengaja tidak dibuat karena keputusannya masih terbuka, atau karena isinya belum tersedia:

- `LICENSE` — lisensi `[TERBUKA]`, tenggat sebelum rilis 1.0.
- `CONTRIBUTING.md`, `SECURITY.md` — menunggu kebijakan versi dan pelaporan.
- `spec/ir.md` — sudah disusun di `spec/ir.md`.
- `spec/errors.md` — sudah disusun di `spec/errors.md`.
- Seluruh isi `packages/` — belum ada baris kode.
