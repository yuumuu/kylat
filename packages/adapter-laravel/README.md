# `kylat/laravel`

Adapter backend Laravel untuk Kylat.

| Bagian | Isi |
|---|---|
| `src/Http/Controllers/KylatBatchCallController.php` | `handleRequest(Request)`, validasi batch, batas body/depth, error RFC 9457 |
| `src/Actions/ActionRegistry.php` | Registry kontrak aksi; tidak ada fallback kelas arbitrer |
| `src/Support/IdempotencyStore.php` | Lease/idempotensi dengan cache Laravel atau memory |
| `src/Blade/KylatDirective.php` | `@kylat` dan `@kylatScripts`, serialisasi data-props aman |
| `src/Attributes/` | `Prop`, `Client`, `Server`, `Uses`, `Child` |
| `src/Component.php` | Base class komponen |

**Keamanan:** hanya kontrak terdaftar; method wajib `#[Server]` pada kontrak/implementasi; `authorize()` wajib dan default-deny; error internal tidak dibocorkan.

**Dipasang otomatis** lewat `extra.laravel.providers` di `composer.json`. Route `POST /_kylat/call` memakai middleware `web` (CSRF).
