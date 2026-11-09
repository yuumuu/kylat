# `@kylat/protocol`

Tipe wire RPC antara client dan backend. Skema normatif ada di [`spec/protocol.schema.json`](../../spec/protocol.schema.json).

Kontrak utama:

- `POST /_kylat/call` — batch maksimal 20 panggilan.
- Response HTTP 200: setiap call memiliki `id` dan `ok`; kegagalan per-call ada di `error`.
- Kegagalan level request memakai RFC 9457 `application/problem+json`.
- Header: `X-Kylat-Build`, `X-CSRF-Token`/`X-XSRF-TOKEN`, `Idempotency-Key`, `Authorization`.

`src/index.ts` memuat tipe TypeScript dan `PROTOCOL_LIMITS`. Test konformansi adapter belum tersedia; ini pekerjaan berikutnya.
