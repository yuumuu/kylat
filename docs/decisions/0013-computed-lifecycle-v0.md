# ADR 0013: Bentuk `#[Computed]`, `#[OnMount]`, dan `#[Effect]` v0

- **Status**: DITERIMA
- **Tanggal**: 13 November 2026
- **Penulis**: Arsitek Toolchain
- **Konteks**: `spec/template.md` §5 dan §11 masih membuka urutan lifecycle/cleanup; bentuk `#[Computed]` belum normatif.

---

## 1. Keputusan

### 1.1 `#[Computed]`

- Berupa **method tanpa parameter** dengan tipe return eksplisit selain `void`.
- Body hanya boleh membaca props/state/computed lain dan menjalankan ekspresi murni. Penulisan state, pemanggilan aksi server, I/O, dan database ditolak.
- Compiler menghasilkan `createComputed(() => { ... })`; dependency dilacak dari pembacaan sinyal.
- Method `#[Computed]` tidak boleh menjadi target `on:` atau `$this->method()` dari event.

### 1.2 `#[OnMount]` dan `#[Effect]`

- Berupa method tanpa parameter dengan return `void`.
- Compiler menjalankan: bangun DOM → `#[OnMount]` sesuai urutan deklarasi → `#[Effect]` sesuai urutan deklarasi.
- `#[Effect]` dijalankan sekali segera setelah DOM terbentuk, lalu dijalankan ulang saat sinyal yang dibacanya berubah.
- `#[Effect]` tidak boleh memanggil aksi `#[Server]` (KIL-157).
- **Cleanup belum didukung di v0.** Return function dari lifecycle tidak dijalankan. Cleanup ditunda ke v0.1 dan wajib lewat ADR baru.
- **Pemanggilan `$this->server(...)` dari `#[OnMount]` ditunda ke v0.1.** `spec/template.md` diperbarui: OnMount boleh memanggil `#[Client]`; panggilan server dari OnMount ditolak dengan KIL-120 sampai semantik async-nya diputuskan.

## 2. Konsekuensi

- `spec/template.md` §5 dan §11 diperbarui.
- Compiler menolak `#[Computed]` berparameter, `#[Computed]` yang menulis state, dan lifecycle berparameter dengan KIL-104.
- Tes baru mencakup computed terlarang, urutan onMount/effect, dan penolakan server dari OnMount.
- Tidak ada kode KIL baru.
