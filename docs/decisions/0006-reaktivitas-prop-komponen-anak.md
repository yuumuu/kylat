# 0006: Semantik Komposisi Reaktif Prop Komponen Anak (<x-child :prop="$state">)

- **ID Keputusan**: KEP-35 (0006)
- **Topik**: Mekanisme Reaktivitas Prop pada Komposisi Komponen Anak
- **Status**: DRAFT / KANDIDAT (Usulan untuk Fase 1)
- **Tanggal Usulan**: 10 November 2026
- **Pemilik**: Arsitek Toolchain & Tim Reviewer
- **Target Tenggat**: Fase 1 (Runtime)

---

## 1. Konteks dan Masalah

Pada arsitektur Kylat v0, komponen dapat menyusun komponen anak menggunakan tag `<x-nama>` dengan atribut wajib `#[Child]` pada kelas induk (sesuai `spec/template.md` dan KEP-32).

Namun, terdapat temuan teknis penting terkait alur pembaruan data reaktif (*fine-grained reactivity gap*):
Ketika komponen induk meneruskan sinyal state dinamis ke komponen anak, misalnya:
```html
<x-display :value="$count" />
```
Dalam implementasi compiler dan runtime saat ini:
1. Jika kompilator meneruskan nilai saat inisialisasi sebagai nilai primitif mentah (`createDisplay({ value: count() })`), maka komponen anak hanya menerima *snapshot* nilai saat hidrasi/render pertama kali.
2. Ketika `$count` di komponen induk bertambah (misalnya dari tombol `increment`), komponen anak tidak otomatis mengetahui bahwa nilai prop telah berubah, karena di dalam anak `props.value` bukan sinyal atau accessor yang dilacak oleh *effect*.

Hal ini berpotensi memutus rantai reaktivitas (*broken reactive chain*) pada hierarki komponen bersarang.

---

## 2. Opsi yang Dipertimbangkan

### Opsi A: Meneruskan Prop Dinamis sebagai Signal Accessor Getter (Rekomendasi ⭐)
- Pada kode JavaScript hasil kompilasi, atribut dinamis `:nama="$state"` tidak di-unwrap saat dioper ke anak, melainkan dioper sebagai *getter function*:
  ```javascript
  createDisplay({
    get value() { return count(); }
  });
  ```
  atau fungsi accessor eksplisit:
  ```javascript
  createDisplay({
    value: () => count()
  });
  ```
- Di dalam komponen anak, setiap pembacaan `prop_value` diperlakukan sebagai pemanggilan accessor yang otomatis dilacak oleh `effect` lokal anak (`bindText(el, () => props.value())`).
- **Kelebihan**:
  - Nol biaya runtime overhead (*zero proxy cost*).
  - Sepenuhnya selaras dengan prinsip *fine-grained signals* (`alien-signals`), mirip dengan pola SolidJS / Svelte 5.
  - Granularitas DOM binding tetap bekerja di tingkat node tanpa merender ulang seluruh komponen anak.
- **Kelemahan**:
  - Kompilator perlu membedakan prop statis (`value="halo"`) dan prop dinamis (`:value="$count"`).

### Opsi B: Membungkus Objek `props` dengan Reactive Proxy
- Seluruh objek `props` dibungkus dalam `Proxy` JavaScript yang memetakan akses properti ke sinyal internal anak.
- **Kelebihan**: Pengembang anak bisa membaca `props.value` seolah-olah properti biasa.
- **Kelemahan & Alasan Penolakan**:
  - Overhead memori dan performa proxy di lingkungan DOM yang masif.
  - Menambah kompleksitas runtime dan mempersulit optimasi tree-shaking compiler.

### Opsi C: Menolak Dynamic Prop Binding pada Komponen Anak di v0
- Membatasi v0 hanya pada prop statis, dan menunda komposisi dinamis ke v0.1 / Fase 2.
- **Kelebihan**: Tidak ada perubahan kode pada runtime v0 saat ini.
- **Kelemahan**: Membatasi kegunaan komposisi `<x-nama>` hanya untuk komponen statis.

---

## 3. Rekomendasi Awal

Memprioritaskan **Opsi A (Signal Accessor Getter)** pada **Fase 1 (Runtime)** melalui pengujian differential di `@kylat/compiler` dan `@kylat/runtime`, tanpa mengubah batasan subset PHP v0.
