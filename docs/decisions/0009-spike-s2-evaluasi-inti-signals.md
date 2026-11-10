# ADR 0009: Evaluasi Inti Reaktivitas Signals (alien-signals vs @solidjs/signals)

- **ID Keputusan**: KEP-07 (Spike S2)
- **Topik**: Pemilihan Pustaka Inti Signals untuk `@kylat/runtime`
- **Status**: Usulan
- **Tanggal Usulan**: 10 November 2026
- **Penulis**: Antigravity & Tim Pengembang
- **Target Tenggat**: Fase 1 (Runtime)

---

## 1. Konteks dan Masalah

Prinsip P4 dan P10 Kylat menetapkan:
- **P4**: Tidak ada virtual DOM di client; reaktivitas langsung mengikat mutasi sinyal ke node DOM riil.
- **P10**: Anggaran ukuran bundle JavaScript runtime minimal dan terukur ketat (target batas anggaran inti ~8 KB gzip).

Untuk menggerakkan reaktivitas granular (*fine-grained reactivity*) pada `@kylat/runtime`, Spike S2 melakukan pengujian komparatif antara dua kandidat utama:
1. **`alien-signals`** (v3.2.1, Lisensi: **MIT**) — mesin reaktivitas *push-pull* mandiri dengan memori monomorfik.
2. **`@solidjs/signals`** (v2.0.0-rc.0, Lisensi: **MIT**) — inti reaktivitas Solid 2.0 generasi baru berbasis *reactive graph*.

Keduanya diuji dalam harness yang sama ([`bench/spikes/s2-signals/benchmark.mjs`](../../bench/spikes/s2-signals/benchmark.mjs)) dengan tiga metrik terukur:
1. Ukuran bundle terkompresi (gzip) dari fungsi inti menggunakan bundler yang sama (`esbuild --minify --bundle --format=esm`).
2. Kinerja mutasi counter skala tinggi (1.000.000 pembaruan sinyal).
3. Kinerja mutasi hierarkis tabel 1.000 baris reaktif (7.999 pembaruan sinyal & seleksi).

---

## 2. Data Hasil Pengukuran (Spike S2)

### A. Pengukuran Ukuran Bundle Gzip Inti (`esbuild` Minify)

Fungsi inti yang dibundel:
- `alien-signals`: `{ signal, computed, effect }`
- `@solidjs/signals`: `{ createSignal, createMemo, createEffect, createRoot }`

| Pustaka | Versi | Lisensi | Ukuran Minified (Raw) | Ukuran Gzip | Rasio terhadap `alien-signals` |
|---|---|---|---|---|---|
| **`alien-signals`** | **3.2.1** (Pinned) | **MIT** | **4.533 B** (4,43 KB) | **1.712 B** (1,67 KB) | **Baseline (1,0x)** |
| **`@solidjs/signals`** | v2.0.0-rc.0 | MIT | **19.763 B** (19,30 KB) | **7.929 B** (7,74 KB) | **4,63x lebih besar** |

> **Temuan Ukuran**: Inti `@solidjs/signals` (7,93 KB gzip) menghabiskan hampir 99% dari batas anggaran bundle runtime Kylat (~8 KB gzip) bahkan sebelum runtime primitives (`bindText`, `bindAttr`, `batchRpc`) dimasukkan. Sebaliknya, `alien-signals` hanya membutuhkan 1,71 KB gzip, menyisakan ruang anggaran yang sangat luas untuk kode runtime lainnya.

### B. Benchmark Counter (1.000.000 Pembaruan Sinyal)

| Metrik | `alien-signals` | `@solidjs/signals` | Selisih / Keunggulan |
|---|---|---|---|
| Waktu Eksekusi | **75,15 ms** | **963,72 ms** | `alien-signals` **12,82x lebih cepat** |
| Operasi / Detik | **~13.306.702 ops/detik** | **~1.037.644 ops/detik** | - |
| Total Effect Dipicu | 1.000.001 | 1.000.001 | Hasil identik |

### C. Benchmark Tabel 1.000 Baris Reaktif (7.999 Pembaruan)

| Metrik | `alien-signals` | `@solidjs/signals` | Selisih / Keunggulan |
|---|---|---|---|
| Waktu Eksekusi | **10,04 ms** | **35,43 ms** | `alien-signals` **3,53x lebih cepat** |
| Total Mutasi Teks & Seleksi | 7.999 updates | 7.999 updates | Hasil identik |

---

## 3. Arah Rekomendasi (Opsi A: `alien-signals`)

Berdasarkan tinjauan arsitektur dan data Spike S2, arah rekomendasi teknis mengarah ke **Opsi A (`alien-signals`)**:
1. **Ukuran Inti Ultra-Ramping**: 1,71 KB gzip (vs 7,93 KB gzip), krusial untuk memenuhi batas anggaran bundle runtime ringan Kylat.
2. **Kesesuaian dengan Direct DOM Binding**: Tidak membutuhkan pohon konteks/owner (`createRoot`), sangat cocok dengan model manipulasi langsung DOM node Kylat tanpa VDOM.
3. **Stabilitas API**: Versi `3.2.1` stabil, teruji, dan bebas dari isu bug internal yang masih ditemui pada status Release Candidate `@solidjs/signals` v2.
4. **Lisensi Terbuka**: Berlisensi **MIT** yang kompatibel penuh dengan lisensi proyek Kylat (**Apache-2.0**). Versi dipin secara ketat pada `3.2.1` di `packages/runtime/package.json`.

---

## 4. Batasan dan Hal yang Belum Terbukti

1. **Lingkungan Pengujian**: Hasil benchmark di atas **hanya diukur pada engine V8 (Node.js v22) di platform desktop**.
2. **Belum Teruji di Mobile / JavaScriptCore**: Kinerja memori, *garbage collection*, dan kecepatan eksekusi pada engine JavaScriptCore (Safari iOS) serta perangkat bergerak berspesifikasi rendah (*low-end mobile*) belum diukur.

---

## 5. Syarat Pengesahan Keputusan

Status ADR ini **tetap "Usulan"** dan tidak diputuskan secara sepihak sampai syarat berikut terpenuhi:
1. **Uji Komparatif Mobile / JSC**: Benchmark lanjutan dilakukan pada JavaScriptCore (Safari iOS) dan perangkat mobile *low-end*. Jika `alien-signals` kalah performa atau boros memori secara signifikan di lingkungan tersebut, arah keputusan ini wajib ditinjau ulang.
2. **Pengesahan Pemilik Proyek**: Persetujuan resmi diberikan setelah hasil uji lintas-engine diverifikasi.
