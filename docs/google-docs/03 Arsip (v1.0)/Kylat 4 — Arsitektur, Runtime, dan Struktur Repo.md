ARSIP — non-normatif. Hasil konversi otomatis dari .docx.

# Kylat 4 — Arsitektur, Runtime, dan Struktur Repo

**Status:** draf konsolidasi v1.0. Membahas keputusan arsitektur yang sebelumnya bertentangan di dokumen perancangan (bagian 5, 7, 18.2, dan 20.4).

## 1. Pipeline

Authoring PHP (subset) lalu parse, analisis tipe, IR, codegen, dan keluaran berupa JS, manifest, dan skema kontrak. Runtime di browser menjalankan JS tersebut dan berbicara dengan backend lewat protokol di dokumen 3.

* **compiler:** parse, analyze, ir, codegen, diagnostics
* **runtime:** signals, scheduler, DOM, list, RPC client
* **protocol:** skema dan test konformansi
* **adapter-laravel:** kontrak aksi, endpoint, Blade directive, policy
* **cli:** create, dev, build, check, doctor, sync-contract

## 2. Keputusan: struktur komponen dan aksi server

**[PUTUSAN]** Komponen hanya mendeklarasikan aksi server. Implementasinya ada di kelas Action di backend. Ini menyelesaikan kontradiksi antara contoh awal (badan #[Server] di komponen) dan kebutuhan repo FE terpisah.

// FE: src/components/ProductCard.php
#[Uses(CartActions::class)]
final class ProductCard extends Component
{
 #[Client]
 public function add(int $productId): void
 {
 $this->server(CartActions::class)->addToCart($productId);
 }
}

// BE: app/Kylat/Actions/AddToCart.php
final class AddToCart implements ServerAction
{
 public function authorize(User $user, int $productId): bool { /\* ... \*/ }
 public function handle(int $productId): CartResult { /\* ... \*/ }
}

CartActions adalah interface kontrak yang menjadi satu sumber kebenaran untuk tipe parameter dan return, diperiksa di CI. Bentuk sintaks final (interface atau atribut) diputuskan lewat prototipe di fase 0.

## 3. Keputusan: inti reaktif

**[PUTUSAN]** Tidak menulis runtime reaktif sendiri. Runtime Kylat adalah lapisan tipis (binding DOM, list berkunci, RPC client) di atas inti signals pihak ketiga.

**[TERBUKA]** Pilihan inti: alien-signals (kecil, algoritma push-pull, bisa dibangun sebagai sistem reaktif sendiri) atau @solidjs/signals (sudah punya async dan optimistic primitives, masih beta). Keputusan lewat spike S2 di fase 1, dengan kriteria di dokumen 6. Proposal TC39 Signals masih Stage 1 dan tidak dijadikan dasar.

## 4. Model state dan aksi

* **#[Prop]:** data dari server saat load. Dianggap publik.
* **State:** property tanpa atribut. Hidup di client sebagai signal.
* **Computed:** turunan yang di-cache dan hanya dihitung ulang saat dependensinya berubah.
* **#[Client]:** aksi yang dikompilasi ke JS dan jalan di browser.
* **#[Server]:** deklarasi aksi yang dikirim ke backend. Argumen dan return memakai skema dari signature.
* **Optimistic update:** aksi dapat menandai perubahan sementara. Jika server menolak, perubahan dikembalikan hanya pada node yang terdampak.

## 5. Rendering

* **CSR murni** (default untuk FE terpisah): HTML kosong, JS merender.
* **Prerender** untuk halaman statis: HTML dibuat saat build, JS menyambung seperlunya.
* **SSR opsional** lewat adapter: hasil server dan client harus identik. Ada test hydration mismatch di CI.

Resumability (ala Qwik) tidak masuk ruang lingkup v1. Hanya dievaluasi setelah benchmark fase 5.

## 6. Scheduler dan list

* Event input diprioritaskan dari pekerjaan latar. Batching flush dalam satu microtask.
* List memakai key. Reconcile minimal dengan jalur cepat untuk append dan remove.
* Virtualisasi opsional untuk list besar. Fokus elemen yang sedang dipakai dipertahankan saat patching.
* Event delegation untuk event umum.

## 7. Aturan runtime dan aksesibilitas

Target WCAG 2.2 level AA untuk runtime dan contoh resmi. Gerbang rilis 1.0.

| Area | Aturan | Uji |
| --- | --- | --- |
| Fokus | Pindah rute memindahkan fokus ke judul utama. Modal menjebak fokus dan mengembalikannya saat ditutup | Playwright, urutan fokus |
| Form | Error dikaitkan lewat aria-describedby dan aria-invalid | Uji komponen |
| Live region | Hasil aksi diumumkan sekali lewat aria-live, bukan berulang saat re-render | axe dan uji manual |
| Status pending | Elemen yang diproses memakai aria-busy | Uji komponen |
| Warna | Kontras minimal 4.5:1 untuk teks, 3:1 untuk teks besar dan komponen UI | Lint token |
| Target sentuh | Minimal 24 x 24 CSS px atau jarak yang memenuhi WCAG 2.5.8 | Audit |
| Gerak | Hormati prefers-reduced-motion. Transisi nonaktif bila diminta | Uji CSS |
| Gambar | Wajib alt. Kosong untuk dekoratif. Compiler menolak gambar tanpa alt (KIL-4xx) | Lint |

Aksesibilitas tidak sepenuhnya dijamin library. Teks alternatif yang bermakna dan urutan konten yang logis tetap tanggung jawab developer.

## 8. Batasan build-time

| Constraint | Kode |
| --- | --- |
| Subset PHP (dokumen 2) | KIL-1xx |
| Tipe wajib pada property, parameter, return | KIL-130 |
| declare(strict\_types=1) wajib | KIL-202 |
| Satu komponen per file, nama file sama dengan kelas | KIL-201 |
| Tanpa static, global, atau singleton di komponen | KIL-206 |
| Nama aksi unik per kontrak | KIL-210 |
| Tidak ada dependensi sirkular antar komponen | KIL-211 |
| Aksi dengan parameter ID wajib authorize | KIL-310 |
| Anggaran ukuran chunk per komponen (usulan 8 KB gzip) | KIL-401 |

## 9. Struktur repo library (monorepo)

kylat/
 README.md CONTRIBUTING.md SECURITY.md LICENSE
 spec/ php-subset.md ir.md protocol.schema.json errors.md
 packages/
 compiler/ src/{parse,analyze,ir,codegen,diagnostics} tests/{golden,differential}
 runtime/ src/{signals,dom,list,rpc,scheduler} tests/
 protocol/ schema/ conformance/
 adapter-laravel/ src/{Http,Policies,Contract} tests/
 cli/ src/commands/{create,dev,build,check,doctor,sync-contract}.ts
 bench/ scenarios/ baselines/ scripts/
 examples/ 01-counter/ 02-filter-table/ 03-form-validation/ 04-cart/
 docs/ tutorial/ guide/ reference/ decisions/

Aturan: setiap package punya README. Impor lintas package hanya lewat API publik. Lint mencegah dependensi sirkular. Modul di bawah sekitar 300 baris.

## 10. Struktur aplikasi hasil kylat create

**Topologi terpisah (direkomendasikan):**

my-app-frontend/ repo FE, Node saja, tanpa PHP terpasang
 kylat.config.json divalidasi JSON Schema
 src/components/ satu komponen per file, mis. Counter.php
 src/pages/ rute mengikuti struktur folder
 src/shared/ fungsi #[Shared] murni
 contract/ DIHASILKAN dan dikomit: schema.json, types.d.ts
 tests/ public/

my-app-backend/ repo BE, Laravel
 app/Kylat/Actions/ satu aksi satu kelas, mis. AddToCart.php
 app/Kylat/Policies/
 app/Kylat/Data/ DTO masuk dan keluar
 config/kylat.php
 tests/Kylat/

**Topologi monolit:** resources/kylat/components, app/Kylat/Actions, dan plugin Vite dalam satu proyek Laravel.

## 11. Konvensi kode

* Urutan anggota: konstanta, #[Prop], state, computed, #[Client], #[Server]. (KIL-203)
* Method #[Client] pendek, batas lunak 40 baris, nesting maksimal 3. (peringatan KIL-204)
* Template hanya ekspresi sederhana. Logika masuk computed. (KIL-205)
* Nama aksi kata kerja (addToCart). Computed kata benda (visibleProducts).
* PHPStan level maksimum, formatter Pint atau Mago, TypeScript strict di runtime.

## 12. Kode galat yang dipakai dokumen ini

KIL-1xx, KIL-2xx, KIL-3xx, dan KIL-4xx mengikuti dokumen 2 bagian 10. Daftar lengkap ada di docs/reference/errors.md (belum ditulis).
