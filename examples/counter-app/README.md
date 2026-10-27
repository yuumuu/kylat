# Demo End-to-End: Aplikasi Counter Kylat

Aplikasi contoh resmi untuk mendemonstrasikan alur kerja penuh (*end-to-end*) toolchain Kylat:
1. Komponen PHP standar (`Counter.php`) dan template mirip Blade (`counter.blade.php`).
2. Kompilasi otomatis menjadi JavaScript reaktivitas sinyal murni (`@kylat/runtime`) tanpa Virtual DOM.
3. Pulau interaktif (*interactive island*) di browser dengan hidrasi instan.
4. Panggilan mutasi RPC ke backend server (`POST /_kylat/call`) yang dilindungi kontrak idempotensi `Idempotency-Key` (sesuai `spec/threat-model.md §3.1`).
5. Proteksi tombol saat mutasi berlangsung: otomatis diikat atribut `aria-busy="true"`, `data-pending`, dan `disabled="disabled"` untuk mencegah klik ganda.

---

## Struktur Berkas

```text
examples/counter-app/
├── Counter.php             # Definisi kelas komponen PHP subset v0
├── counter.blade.php       # Template Blade komponen
├── CounterActions.php      # Kontrak interface aksi server (Spike S3)
├── dist/
│   └── Counter.js          # Output JavaScript terkompilasi
├── index.html              # Halaman demo interaktif peramban
├── build.mjs               # Script kompilasi komponen
├── server.mjs              # Server HTTP & RPC backend
├── e2e.test.mjs            # Suite uji otomatis end-to-end
└── package.json            # Konfigurasi package & scripts
```

---

## Langkah Reproduksi Cepat

### 1. Kompilasi Komponen
Jalankan kompilator untuk menghasilkan JavaScript dari berkas sumber PHP:
```bash
node build.mjs
# atau melalui pnpm:
pnpm --filter "@kylat/example-counter-app" run build
```
Output terkompilasi akan ditulis ke `dist/Counter.js`.

### 2. Jalankan Uji Otomatis End-to-End
Jalankan verifikasi otomatis dari hulu ke hilir:
```bash
node --test e2e.test.mjs
# atau melalui pnpm:
pnpm --filter "@kylat/example-counter-app" test
```

Uji otomatis memverifikasi:
- Kompilasi komponen deterministik.
- Mutasi lokal sinyal tanpa virtual DOM (increment dan decrement).
- Panggilan RPC mutasi ke server dengan header `Idempotency-Key`.
- Pemenuhan kontrak idempotensi: *replay cache* (§3.1 Aturan 4), penolakan konflik payload (§3.1 Aturan 3), dan batas panjang key 8–128 karakter (§3.1 Aturan 1).

### 3. Jalankan Server Demo Interaktif di Browser
Jalankan server demo lokal:
```bash
node server.mjs
# atau melalui pnpm:
pnpm --filter "@kylat/example-counter-app" start
```
Buka browser pada: [http://localhost:3000](http://localhost:3000)

Pada antarmuka browser:
1. Klik **`+`** atau **`-`** untuk melihat mutasi state lokal langsung di DOM tanpa request jaringan.
2. Klik **`Simpan ke Server (RPC)`** untuk memicu batch RPC:
   - Tombol akan otomatis beralih ke state pending (`aria-busy="true"`, `disabled="disabled"`).
   - Log terminal di sisi kanan akan menampilkan payload JSON RPC dan nilai `Idempotency-Key` yang dikirim ke server.
   - Server merespons dan counter state di server tersinkronisasi.
