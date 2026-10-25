# examples/

Contoh yang harus selalu berjalan. Satu contoh per direktori.

| Direktori | Menguji |
|---|---|
| `01-counter/` | Signal dasar, event, render minimal |
| `02-filter-table/` | List berkunci, computed, filter lokal tanpa request |
| `03-form-validation/` | Validasi client dan server, error aksesibel (`aria-describedby`, `aria-invalid`) |
| `04-cart/` | Aksi server, batch, optimistic update dan rollback |

Definisi selesai untuk setiap contoh: ada di CI, lolos `kylat check` dan `kylat doctor`, serta memenuhi target WCAG 2.2 AA.

**Catatan:** Dokumen 5 §11 menyebut "lima komponen contoh", sedangkan pohon repo Dokumen 4 §9 memuat empat (audit S-02). Tambahkan contoh kelima atau perbaiki angkanya sebelum fase 5.
