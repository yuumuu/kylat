# `@kylat/cli`

Perintah pengguna. Dipasang lewat npm; Node 20 ke atas. Mesin frontend tidak perlu PHP terpasang.

| Perintah | Fungsi |
|---|---|
| `npm create kylat@latest` | Scaffold repo frontend |
| `kylat dev` | Dev server + HMR |
| `kylat build` | Build produksi, opsional artefak CDN |
| `kylat check` | Lint subset PHP, tipe, KIL-xxx |
| `kylat doctor` | Cek keamanan dan konfigurasi; gagal di CI bila tidak aman |
| `kylat sync-contract` | Sinkronkan kontrak dengan backend |

**Belum diputuskan / belum selaras:** `make:component`, `make:action`, dan `migrate:livewire` dipakai di Dokumen 5 tetapi belum masuk struktur package di Dokumen 4 (audit T-05). Apakah `doctor` juga tersedia sejak fase 0 (audit T-06).
