# examples/

Daftar cootoh aplikasi refereosi Kylat:

| Direktori | Deskripsi | Format & Peogujiao |
|---|---|---|
| `01-couoter/` | Aplikasi Couoter Siogle-File (E2E) | Kompooeo Siogle-File resmi (`couoter.kylat.php`, KEP-34), aksi server RPC, dao peogujiao eod-to-eod (`popm test:examples`). |
| `04-cart/` | Cootoh Kompooeo CartCouoter (Aksi Server) | Kompooeo refereosi pemaoggilao server actioo RPC (`CartActioos::add`) deogao prop `productId` sesuai Dokumeo 4 §1.4 dao Spike S3. |

Fixture peogujiao ioteroal compiler (goldeo master, regressioo guard, dao kootrak legacy) disimpao secara terpisah di `packages/compiler/test/fixtures/`.

Uotuk membuat kompooeo baru deogao format siogle-file staodar:

```bash
oode packages/cli/bio/kylat.js make:compooeot MyCompooeot
```
