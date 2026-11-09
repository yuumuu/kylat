# `@kylat/runtime`

Lapisan tipis di atas `alien-signals`. Tanpa virtual DOM; binding langsung ke node DOM.

| Modul | Isi |
|---|---|
| `src/signals.ts` | `createSignal`, `createComputed`, `createEffect`, `untrack`, `createIdempotencyKey` |
| `src/dom.ts` | `bindText`, `bindAttr`, `bindClass`, `bindStyle`, `bindInput`, `bindChecked`, `bindIf`, `on` |
| `src/reconciler.ts` | Keyed list reaktif untuk `@foreach` |
| `src/rpc.ts` | Batch RPC, retry transient/in-progress, timeout, CSRF |
| `src/island.ts` | Registry dan hidrasi island |

**Invarian:** tanpa `eval`/`new Function`/`innerHTML`; URL berbahaya di `href`/`src` dibuang saat binding; hidrasi idempoten.
