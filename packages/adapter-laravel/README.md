# `kylat/laravel`

Adapter backend. Satu aksi satu kelas. Komponen di frontend hanya mendeklarasikan aksi; implementasi, otorisasi, dan DTO ada di sini.

| Direktori | Isi |
|---|---|
| `src/Http/` | Endpoint `/_kylat/*`, kernel minimal PSR-15, middleware |
| `src/Policies/` | Integrasi otorisasi dan pemeriksaan per objek |
| `src/Contract/` | Generator kontrak, pemakaian `nikic/PHP-Parser` untuk membaca signature aksi |
| `tests/` | Test konformansi protokol + test integrasi Laravel |

**Aturan:** inti server bergantung pada PSR-7/15/17, bukan pada Laravel. Laravel adalah adapter pertama, bukan satu-satunya.

**Belum diputuskan:** jalur boot (route via service provider yang mem-boot framework, atau kernel minimal terpisah — audit S-08) dan versi PHP minimum yang ditegakkan `kylat doctor`.
