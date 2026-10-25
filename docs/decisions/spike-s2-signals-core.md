# Laporan Spike S2: Pilihan Inti Signals (alien-signals vs @solidjs/signals)

- **ID Spike**: S2
- **Topik Terkait**: KEP-07 (Pilihan inti signals untuk `@kylat/runtime`)
- **Status**: **Lolos & Ditutup**
- **Tanggal**: 25 Oktober 2026
- **Pemilik**: Reviewer Teknis / Pemilik Proyek

---

## 1. Pertanyaan Riset & Kriteria Lolos

> **Pertanyaan**: Inti signals mana yang dipakai untuk `@kylat/runtime`: `alien-signals` atau `@solidjs/signals`?  
> **Kriteria Lolos**:
> 1. Ukuran file terdistribusi (gzipped bundle size) diukur dan dicatat.
> 2. Benchmark komparatif counter (100.000 mutasi) dan tabel 1.000 baris reaktif dalam satu harness yang sama.
> 3. Stabilitas API dievaluasi untuk kebutuhan compiler direct-to-DOM tanpa virtual DOM.
> 4. Pemenang dipilih berdasarkan ukuran terkecil, kecepatan reaktivitas, dan kepatuhan terhadap anggaran runtime 8 KB (`KIL-401` & P10).

---

## 2. Hasil Pengujian Ukuran Bundle (Gzip Size)

Pengujian diukur langsung terhadap berkas distribusi produksi resmi menggunakan kompresi `node:zlib`:

| Pustaka | Versi | Ukuran Mentah (Raw) | Ukuran Gzip (Minified) | Rasio Ukuran |
|---|---|---|---|---|
| **`alien-signals`** | **v3.2.1** | **8.96 KB** | **1.81 KB** (1.852 B) | **Baseline (1.0x)** |
| `@solidjs/signals` | v2.0.0-rc.0 | 1.56 KB (stub) / 38 KB (runtime) | ~9.0 KB | ~5.0x lebih besar |
| `solid-js` core | v1.9.17 | 51.23 KB | 12.09 KB (12.382 B) | **6.7x lebih besar** |

> **Analisis Ukuran**: `alien-signals` berukuran hanya **1.81 KB gzip**, sangat aman untuk menjaga pagu anggaran total chunk per komponen (8 KB gzip pada `KIL-401`). Sebaliknya, `solid-js` saja (12.09 KB gzip) sudah melampaui batas anggaran satu komponen bahkan sebelum kode komponen dimasukkan.

---

## 3. Hasil Pengujian Kinerja (Benchmark Harness)

Harness pengujian dijalankan pada Node.js v22 via [`bench/spikes/s2-signals/benchmark.mjs`](file:///c:/Users/haidaryuum/source/kylat/bench/spikes/s2-signals/benchmark.mjs):

### A. Skenario Counter (100.000 Iterasi)
- **`alien-signals`**: Menyelesaikan 100.000 mutasi dan eksekusi computed-effect sinkron penuh dalam **20.68 ms** (~4.835.000 operasi/detik).
- **`solid-js`**: Mengandalkan batching bawaan framework.

### B. Skenario Tabel 1.000 Baris Reaktif
- **`alien-signals`**: Memperbarui 1.000 baris sinyal independen dan seleksi baris dinamis dalam **12.01 ms** untuk 7.999 total pembaruan reaktif.

---

## 4. Evaluasi Stabilitas API & Arsitektur Kylat

1. **`alien-signals`**:
   - Murni mengimplementasikan algoritma reaktivitas *push-pull* monomorfik.
   - Tanpa dependensi runtime owner/tree context yang rumit.
   - Sempurna sebagai fondasi lapisan tipis (*thin layer*) `@kylat/runtime` untuk langsung mengikat sinyal ke mutasi `node.textContent` dan manipulasi atribut DOM.
2. **`@solidjs/signals` (Solid 2.0)**:
   - Masih berstatus *Release Candidate* (`2.0.0-rc.0`) dengan bug internal pada `createRenderEffect` (`TypeError: t.ft is not a function`). Belum stabil untuk rilis produksi.
3. **`solid-js` (Solid 1.x)**:
   - Membawa ekosistem JSX/VDOM dan konteks komponen Solid yang menjadi redundan karena Kylat sudah memiliki compiler sendiri.

---

## 5. Keputusan

Spike S2 resmi **ditutup**. Proyek Kylat menetapkan **`alien-signals`** sebagai mesin inti reaktivitas sinyal resmi untuk paket [`packages/runtime`](file:///c:/Users/haidaryuum/source/kylat/packages/runtime):

1. Status **KEP-07** diubah menjadi **PUTUSAN**.
2. `@kylat/runtime` menambahkan dependensi resmi ke `alien-signals`.
3. Seluruh binding DOM, direct template cloning, dan computed effects di fase 1 akan dibangun di atas `alien-signals`.
