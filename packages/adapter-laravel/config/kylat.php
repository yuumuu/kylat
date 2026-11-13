<?php

declare(strict_types=1);

return [
    /*
     * Build ID server. Bila diisi, client wajib mengirim X-Kylat-Build yang sama.
     */
    'build_id' => env('KYLAT_BUILD_ID'),

    /*
     * Default cache untuk aksi #[Server(read: true, public: true)].
     */
    'read_cache_max_age' => (int) env('KYLAT_READ_CACHE_MAX_AGE', 60),

    /*
     * Produksi wajib memakai Redis. Fallback in-memory hanya untuk test/dev.
     */
    'rate_limit_store' => env('KYLAT_RATE_LIMIT_STORE', 'redis'),
    'rate_limit_authenticated' => (int) env('KYLAT_RATE_LIMIT_AUTHENTICATED', 60),
    'rate_limit_anonymous' => (int) env('KYLAT_RATE_LIMIT_ANONYMOUS', 20),

    /*
     * Driver idempotensi: 'cache' (interim) atau 'database' (ADR 0019).
     * Produksi wajib 'database' setelah uji konkurensi MySQL/PostgreSQL.
     */
    'idempotency_driver' => env('KYLAT_IDEMPOTENCY_DRIVER', 'cache'),
    'idempotency_identity' => env('KYLAT_IDEMPOTENCY_IDENTITY', 'auto'),
];
