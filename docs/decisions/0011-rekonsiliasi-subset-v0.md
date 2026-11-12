# ADR 0011: Rekonsiliasi Subset v0 — Closure, `usort`, `match`, dan Kontrol Alur

- **Status**: DITERIMA
- **Tanggal**: 12 November 2026
- **Penulis**: Arsitek Toolchain
- **Menggantikan**: ADR 0010 (status USULAN)
- **Konteks**: Penutupan PR #3 dan awal pekerjaan Fase 2 compiler

---

## 1. Konteks

Tiga sumber masih berbeda:

1. `spec/php-subset.md` §2 mencantumkan closure/arrow function, `usort`, dan kontrol alur `if`/`foreach`/`for`/`return` sebagai bagian subset v0.
2. Dokumen aktif Kylat 2 v1.2 masih mencantumkan `match` sebagai didukung, sedangkan `spec/php-subset.md` menundanya ke v0.1 dengan KIL-104.
3. Compiler Fase 2 saat ini menolak seluruh kontrol alur di method client dengan KIL-104 dan belum memiliki codegen closure, computed, atau lifecycle.

Tanpa keputusan ini, analisis tipe dan IR tidak punya target yang stabil.

## 2. Keputusan

### 2.1 Closure dan arrow function — DIDUKUNG

Closure dan arrow function tetap bagian subset v0. Compiler wajib mengompilasinya menjadi arrow function JavaScript dan menguji semantiknya lewat differential test. Closure hanya boleh muncul sebagai ekspresi di dalam method `#[Client]`/`#[Computed]`, bukan sebagai tipe properti atau prop.

### 2.2 `usort` — DITUNDA ke v0.1

`usort` dikeluarkan dari allowlist v0. Alasan: PHP memutasi array secara *by reference* dan mengembalikan `bool`, sedangkan JavaScript memutasi array dan mengembalikan array. Semantik ini belum punya padanan yang disepakati. Pemakaian `usort` di client ditolak dengan **KIL-110**. Kode ini masuk kembali hanya melalui ADR baru yang menyertakan differential test.

### 2.3 `match` — TETAP DITUNDA ke v0.1

`match` tetap ditolak dengan **KIL-104**, sesuai PUTUSAN 9 November 2026. Dokumen aktif Kylat 2 diperbarui agar tidak lagi mencantumkan `match` sebagai fitur v0.

### 2.4 Kontrol alur — DIDUKUNG

Compiler wajib mendukung `if`/`elseif`/`else`, `foreach`, `for`, dan `return` dini di method `#[Client]` dan `#[Computed]`. `while`, `do-while`, `switch`, `try/catch`, `throw`, dan `break`/`continue` di luar `foreach`/`for` tetap ditolak dengan **KIL-104** sampai ada ADR terpisah.

## 3. Konsekuensi

- `spec/php-subset.md` diperbarui: `usort` dihapus dari allowlist dan dipindahkan ke daftar ditunda.
- Dokumen aktif Kylat 2 v1.2 diselaraskan: `match` dan `usort` tidak lagi diklaim didukung.
- ADR 0010 berstatus **DIGANTIKAN**; KEP-38 ditutup.
- Fase 2 wajib menambah tes penerimaan untuk closure, arrow function, `if`, `foreach`, `for`, dan `return` dini.
- Fase 2 wajib menambah tes penolakan `usort` (KIL-110) dan `match` (KIL-104).
- Tidak ada kode KIL baru dalam keputusan ini.
