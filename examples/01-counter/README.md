# Demo End-to-End: Aplikasi Counter Kylat (`01-counter`)

Aplikasi contoh resmi untuk mendemonstrasikan alur kerja penuh (*end-to-end*) toolchain Kylat menggunakan format **Single-File Component (`*.kylat.php`)** (ADR 0004 / KEP-34):

1. **Komponen Single-File (`counter.kylat.php`)**: Menggabungkan class PHP dan templat Blade/HTML reaktif dalam satu berkas tunggal.
2. **Kompilasi Otomatis**: Dikompilasi menjadi JavaScript reaktivitas sinyal murni (`@kylat/runtime`) tanpa Virtual DOM.
3. **Pulau Interaktif (*Interactive Island*)**: Berjalan di browser dengan hidrasi instan.
4. **Panggilan Mutasi RPC Backend (`POST /_kylat/call`)**: Dilindungi kontrak idempotensi `Idempotency-Key` (sesuai `spec/threat-model.md §3.1`).
5. **Proteksi Tombol**: Otomatis diikat atribut `aria-busy="true"`, `data-pending`, dan `disabled="disabled"` saat aksi in-flight untuk mencegah klik ganda.

---

## Struktur Berkas

```text
examples/01-counter/
├── counter.kylat.php       # Komponen single-file resmi Kylat (KEP-34)
├── CounterActions.php      # Kontrak interface aksi server (Spike S3)
├── dist/
│   └── Counter.js          # Output JavaScript terkompilasi
├── index.html              # Halaman demo interaktif peramban
├── build.mjs               # Script kompilasi komponen
├── server.mjs              # Server HTTP & RPC backend demo
├── e2e.test.mjs            # Suite uji otomatis end-to-end
└── package.json            # Konfigurasi package & scripts
```

---

## Langkah Menjalankan

### 1. Kompilasi Komponen
Jalankan kompilator untuk menghasilkan JavaScript dari berkas `counter.kylat.php`:
```bash
node build.mjs
# atau melalui pnpm:
pnpm --filter "@kylat/example-counter-app" run build
```
Output terkompilasi akan ditulis ke `dist/Counter.js`.

### 2. Jalankan Uji Otomatis End-to-End
```bash
node --test e2e.test.mjs
# atau melalui pnpm:
pnpm --filter "@kylat/example-counter-app" test
```

### 3. Jalankan Server Demo Lokal
```bash
node server.mjs
# atau melalui pnpm:
pnpm --filter "@kylat/example-counter-app" start
```
Buka `http://localhost:3000` di peramban Anda.
