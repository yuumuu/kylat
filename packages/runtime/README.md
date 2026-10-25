# `@kylat/runtime`

Lapisan tipis di atas inti signals pihak ketiga. Bukan runtime reaktif buatan sendiri — keputusan ini sudah final (Dokumen 4 §3).

| Direktori | Isi |
|---|---|
| `src/signals/` | Pembungkus inti signals; satu-satunya tempat inti diimpor |
| `src/scheduler/` | Prioritas event input di atas pekerjaan latar, flush satu microtask |
| `src/dom/` | Binding DOM aman: `textContent`, `setAttribute`, tanpa `innerHTML` bebas |
| `src/list/` | List berkunci, jalur cepat append/remove, virtualisasi opsional |
| `src/rpc/` | Klien batch `/_kylat/call`, optimistic update dan rollback |

**Invarian khusus runtime:** tanpa `eval` dan `new Function`; target WCAG 2.2 AA untuk fokus, live region, dan status pending; tidak ada akses `innerHTML` di luar jalur Trusted Types.

**Belum diputuskan:** inti signals — `alien-signals` atau `@solidjs/signals` (spike S2, akhir fase 1).
