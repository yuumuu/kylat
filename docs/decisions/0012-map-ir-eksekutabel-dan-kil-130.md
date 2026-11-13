# ADR 0012: Map JavaScript, IR Eksekutabel v0, dan Aktivasi KIL-130

- **Status**: DITERIMA
- **Tanggal**: 13 November 2026
- **Penulis**: Arsitek Toolchain
- **Konteks**: Rekonsiliasi deviasi Fase 2 setelah PR #5

---

## 1. Konteks

Dua deviasi ditemukan saat audit Fase 2:

1. `spec/php-subset.md` §4 mewajibkan map memakai `Map` JavaScript, bukan object. Compiler v0 masih memakai object literal dan `Object.entries`.
2. `spec/ir.md` mendefinisikan IR sebagai pohon sintaksis teranotasi penuh. Implementasi v0 menyimpan `bodyCode` (statement JavaScript) dan `bodyLocations`, bukan pohon `StatementNode`/`ExpressionNode` penuh.
3. KIL-130 ditunda ke v0.1 oleh ADR 0008, sehingga aturan `array_filter`/array ambigu tidak ditegakkan.

## 2. Keputusan

### 2.1 Map memakai `Map` JavaScript

- `array<string, T>` direpresentasikan sebagai `Map` JavaScript.
- `list<T>` tetap array JavaScript.
- Map literal dengan key menghasilkan `new Map([[key, value], ...])`.
- Akses key memakai helper `__kylatGet`, iterasi memakai `__kylatEntries`, nilai memakai `__kylatValues`, jumlah memakai `__kylatCount`.
- `array_filter` menghasilkan `Map` agar key PHP dipertahankan; `array_values` mengembalikannya menjadi `list<T>`.
- Helper dihasilkan di dalam chunk komponen hanya bila dipakai, sehingga anggaran runtime P10 tidak berubah.

### 2.2 IR eksekutabel v0

IR v0 terdiri dari dua lapisan yang keduanya bebas PHP:

1. **Semantic shell terketik**: `Component`, `Prop`, `State`, `Computed`, `Method`, `KylatType`, dan `SourceLocation`.
2. **Executable body**: `bodyCode` + `bodyLocations`, dihasilkan dari AST PHP dan sudah berupa statement JavaScript.

Pohon `StatementNode`/`ExpressionNode` penuh untuk tooling, visualisasi, dan transformasi IR ditunda ke v0.1. `spec/ir.md` diperbarui agar menyebut representasi eksekutabel ini sebagai bentuk resmi IR v0, bukan deviasi diam-diam.

### 2.3 KIL-130 diaktifkan

- Properti/parameter/return bertipe `array` tanpa docblock generik menghasilkan **KIL-130**.
- Hasil `array_filter` bertipe map; assign langsung ke target `list<T>` tanpa `array_values()` menghasilkan **KIL-130**.
- Status “Ditunda ke v0.1” pada KIL-130 dicabut. KIL-203/204/205 tetap ditunda.

## 3. Konsekuensi

- `spec/php-subset.md`, `spec/ir.md`, dan `spec/errors.md` diperbarui.
- Fixture/test yang memakai `public array $items` tanpa docblock wajib diberi `/** @var list<T> */` atau `/** @var array<string,T> */`.
- Differential test map/array_filter diperluas.
- `STATUS` mencatat KIL-130 aktif; KIL-203/204/205 tetap deferred.
- Tidak ada kode KIL baru.
