# `@kylat/protocol`

Kontrak wire antara client dan backend. Netral bahasa: setiap adapter wajib mengimplementasikan ulang kontrak ini dan lulus test konformansi yang sama.

| Bagian | Isi |
|---|---|
| `schema/` | Skema batch request/response, kode tipe error, header wajib |
| `conformance/` | Test yang harus lolos oleh adapter mana pun (Laravel, Symfony, Go, Node) |

**Kontrak yang mengikat** (Dokumen 3):

- `POST /_kylat/call` — batch, maksimal 20 panggilan.
- `GET /_kylat/read/{aksi}` — hanya aksi `read: true` pada data `public: true`.
- `GET /_kylat/schema` — skema untuk `sync-contract` dan generator tipe.
- Header: `X-Kylat-Build`, `X-CSRF-Token`, `Idempotency-Key`, `Authorization`.
- Kegagalan per panggilan dikembalikan di dalam hasil dengan HTTP 200 dan `ok: false`; kegagalan level request memakai RFC 9457.

**Belum ditutup:** bentuk hasil `pending` untuk aksi yang dipindah ke antrean, skema `read`/`public`, dan kode untuk kegagalan format di level request (audit T-04, T-03).
