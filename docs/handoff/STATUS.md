# STATUS — Kylat

Diperbarui: 10 November 2026. Sumber kebenaran: `spec/` di repo. File ini ringkasan operasional, bukan spesifikasi.

## Ringkasan

Prototipe sudah melewati tahap "belum ada kode". Compiler, runtime, CLI, dan adapter Laravel berjalan dan memiliki test. Fokus berikutnya adalah memperdalam template/IR, konformansi protokol, dan idempotensi atomik di database nyata.

## Repo

- `origin/main` sinkron dengan commit lokal.
- commit `fa1a19f` (konversi arsip) dibuang oleh reset dan dibuat ulang sebagai `3751625`. Tidak ada force push.

## Yang sudah berjalan

- Parser PHP subset via `web-tree-sitter` WASM.
- Komponen single-file `*.kylat.php` (KEP-34): pemisahan pada `?>`, validasi KIL-214/215/216.
- Template: teks, `{{ ekspresi }}`, `@if/@elseif/@else`, `@foreach/@empty`, `key`, `on:` dengan argumen, `bind:value`, `bind:checked`, `:attr`, interpolasi atribut, `<x-nama>` dengan `#[Child]`.
- Codegen DOM langsung + signals; `bindIf`, keyed list reaktif, sanitasi URL di `bindAttr`.
- RPC batch dengan retry transient/in-progress, timeout, CSRF meta/cookie, idempotency key unik.
- Adapter Laravel: registry-only, method wajib `#[Server]`, `authorize()` wajib/default-deny, validasi bentuk batch, batas body/kedalaman, Problem Details, cache-control.
- CLI: `make:component`, `check`, `build` (manifest), `doctor`.
- Pengujian komprehensif (120 tes lulus di CI):
  - Unit tests Node: 99 tes (Compiler: 72 [70 pass, 2 skipped P8/P10], Runtime: 17, CLI: 7, Protocol: 3).
  - Integrasi E2E: 6 tes (`01-counter` kompilasi SFC, DOM signals, batch RPC, idempotensi).
  - Security audit PHP: 15 tes (Adapter: 11, Cache driver idempotensi: 4).
  - Audit konsistensi kode galat KIL: 35/35 pemeriksaan lulus 100%.
- Pemisahan fixture: seluruh golden master dan fixture pengujian tersimpan terisolasi di `packages/compiler/test/fixtures/`; direktori `examples/01-counter` murni percontohan SFC.

## Masalah terbuka (prioritas)

### Tinggi

1. **Idempotensi database belum atomik.** Implementasi Cache masih interim. PUTUSAN 9 November 2026: produksi wajib memakai transaksi database + unique index + outbox, dikerjakan Fase 3.
2. **Side effect sudah commit lalu lease habis.** `complete()` gagal setelah mutasi tereksekusi dapat memicu retry duplikat. Perlu pola transactional outbox atau penyimpanan hasil dalam transaksi yang sama.
3. **Heartbeat masih manual.** Aksi panjang harus memanggil `IdempotencyStore::heartbeat()`.
4. **PHP `set_time_limit` hanya CPU time.** I/O lambat tidak dihentikan.
5. **Konformansi protokol belum punya suite bersama.** Demo dan adapter diuji terpisah.
6. **Test konkurensi idempotensi** dengan MySQL/PostgreSQL/Redis nyata belum ada.

### Sedang

7. **Static state `IdempotencyStore`** perlu di-reset per request di Octane/FrankenPHP.
8. **Error validasi server ke field** baru dipetakan ke `error="..."` secara dasar; `aria-describedby`/fokus belum lengkap.
9. **Aturan KIL yang belum lengkap:** KIL-110 allowlist kelas (fungsi klien sudah), KIL-130, KIL-203/204/205, KIL-211, KIL-401. KIL-120/140 sudah ditegakkan untuk method client; KIL-310 ditegakkan lewat `kylat check` dan registrasi kontrak.
10. **`match` ditunda ke v0.1** (PUTUSAN 9 November 2026); tetap ditolak KIL-104 di v0.
11. **Source map** belum dihasilkan; lokasi diagnostic template sudah node-based tetapi mapping ke berkas single-file perlu diuji lebih luas.
12. **Bundle size/P10 dan adopsi/P8** belum diukur formal.

## Aturan kerja

- Commit kecil, satu perubahan per commit.
- Setiap klaim "lulus" harus disertai output test.
- Jangan mengubah golden file dengan menyalin output compiler tanpa alasan yang dijelaskan.
- Setiap KIL baru wajib terdaftar di `spec/errors.md` sebelum dipakai.
