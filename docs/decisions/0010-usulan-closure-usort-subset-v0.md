# ADR 0010: Usulan Status Closure dan `usort` pada `#[Client]`/`#[Computed]`

- **Status**: DIGANTIKAN oleh [ADR 0011](0011-rekonsiliasi-subset-v0.md)
- **Tanggal**: 12 November 2026
- **Penulis**: DH
- **Konteks**: Review PR #2, Fase 2 tugas 1

---

## 1. Konteks dan Masalah

Ada pertentangan yang belum diselesaikan antara dua sumber:

1. `spec/php-subset.md` §2 mencantumkan **closure dan arrow function** sebagai bagian dari yang didukung di `#[Client]` v0, dan memasukkan `usort` dalam allowlist fungsi.
2. Konteks tugas Fase 2 menyatakan **closure dan `usort` di `#[Client]`/`#[Computed]` berada di luar subset v0**, dengan konsekuensi harus ditolak memakai kode KIL yang tepat.

Compiler saat ini tidak menambahkan tes penolakan untuk keduanya. Tidak ada perubahan perilaku yang dilakukan pada PR #2 karena kode KIL yang benar dan cakupan penolakannya bergantung pada keputusan ini.

## 2. Pilihan Keputusan

### Opsi A — Ikuti `spec/php-subset.md` §2

- Closure/arrow function dan `usort` tetap dianggap bagian subset.
- Compiler harus menambah dukungan nyata dan differential test, bukan menolaknya.
- Kelemahan: bertentangan dengan batasan tugas Fase 2 dan menambah permukaan implementasi yang belum siap.

### Opsi B — Nyatakan keduanya di luar subset v0

- Closure dan `usort` di `#[Client]`/`#[Computed]` ditolak saat build.
- Perlu kode KIL yang disepakati. KIL-104 adalah kandidat untuk closure; `usort` membutuhkan keputusan apakah KIL-110 (allowlist) atau kode baru.
- Kelemahan: `spec/php-subset.md` harus direvisi melalui ADR ini, dan `usort` sudah tercantum di allowlist sehingga revisinya lebih besar.

### Opsi C — Tunda keputusan sampai Fase 2 selesai

- Tidak ada perubahan perilaku compiler untuk closure/`usort` sampai ada keputusan.
- Tes penolakan tidak ditambahkan; konflik tetap tercatat.
- Kelemahan: subset v0 tetap memiliki area yang belum dapat diverifikasi secara konsisten antara spec dan compiler.

## 3. Rekomendasi

Opsi C untuk saat ini: jangan mengubah perilaku compiler atau `spec/` sebelum pemilik proyek memilih A atau B. Jika Fase 2 membutuhkan kepastian sebelum penutupan, Opsi B lebih konsisten dengan daftar batasan tugas, tetapi revisi `spec/php-subset.md` wajib menyertai ADR ini.

## 4. Konsekuensi

- Tidak ada tes penolakan closure/`usort` ditambahkan di PR #2.
- Risiko ini tetap terbuka dan tidak boleh diklaim sebagai bagian yang sudah ditegakkan.
- Setelah status ADR berubah menjadi PUTUSAN, PR lanjutan harus menambahkan tes penolakan atau dukungan sesuai opsi yang dipilih.
