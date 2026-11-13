# ADR 0017: Kontrak GET Read dan Schema

- **Status**: DITERIMA
- **Tanggal**: 13 November 2026
- **Penulis**: Arsitek Toolchain
- **Konteks**: Fase 3 dibuka oleh ADR 0015; `spec/protocol.schema.json` baru memuat batch POST.

---

## 1. Keputusan

### 1.1 `GET /_kylat/read/{aksi}`

- `{aksi}` memakai format `Kontrak::method` atau `Komponen.method`, URL-encoded.
- Query `args` berisi **JSON object** yang di-URL-encode; bila tidak ada, dianggap `{}`.
- Hanya aksi `#[Server(read: true)]` yang boleh dipanggil. Aksi mutasi selalu ditolak.
- `GET` tidak pernah mengubah state.
- Respons sukses HTTP 200:
  ```json
  { "data": { } }
  ```
- Respons galat memakai RFC 9457 Problem Details, bukan envelope `ok:false`.
- `Cache-Control`:
  - aksi `read: true` + `public: true`: boleh `public` dengan `max-age` yang ditentukan adapter;
  - selain itu: `private, no-store`.
- `X-Kylat-Build` diperiksa bila dikirim; ketidakcocokan menghasilkan HTTP 409 dengan `urn:kylat:stale_build`.

### 1.2 `GET /_kylat/schema`

Respons HTTP 200:

```json
{
  "protocol": "0.1",
  "build": "optional-build-id",
  "actions": [
    {
      "name": "ProductActions::list",
      "read": true,
      "public": false,
      "params": [
        { "name": "page", "type": "int", "required": true, "nullable": false }
      ],
      "returnType": "list<Product>"
    }
  ]
}
```

- `protocol` adalah versi kontrak schema, bukan versi paket.
- `build` opsional, berasal dari build ID server.
- `params[].type` dan `returnType` memakai notasi tipe Kylat (`int`, `list<T>`, `array<string,T>`, nullable).
- Schema hanya memuat aksi yang terdaftar dan lolos `authorize()`; aksi tanpa otorisasi tidak boleh muncul.

### 1.3 Problem Details

Tipe stabil untuk request-level:

| Tipe | HTTP |
|---|---|
| `urn:kylat:stale_build` | 409 |
| `urn:kylat:rate_limited` | 429 |
| `urn:kylat:bad_request` | 400 |
| `urn:kylat:unauthorized` | 401 |
| `urn:kylat:forbidden` | 403 |
| `urn:kylat:csrf_invalid` | 403 |

`kylat:stale_build` dan `kylat:rate_limited` **tidak** dimasukkan ke `CallError` karena keduanya bukan kegagalan per panggilan batch.

### 1.4 Rate limit

Nilai awal mengikuti Kylat 3 §7: 60 mutasi/menit per akun dan 20 mutasi/menit per IP anonim. Implementasi adapter boleh menaikkan batas lewat konfigurasi, tetapi tidak boleh menurunkannya tanpa ADR.

## 2. Konsekuensi

- `packages/protocol/src/index.ts` menambah `ReadResponse`, `SchemaResponse`, `SchemaAction`, `SchemaParam`, `PROTOCOL_PROBLEM_TYPES`, dan `PROTOCOL_PROBLEM_STATUS`.
- `spec/protocol.schema.json` menambah definisi `ReadResponse` dan `SchemaResponse`.
- Adapter Laravel belum mengimplementasikan route pada PR ini; itu tugas berikutnya.
- Tidak ada kode KIL baru.
