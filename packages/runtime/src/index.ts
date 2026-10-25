/**
 * @kylat/runtime
 * Runtime reaktif fine-grained signals di browser untuk Kylat v0.
 *
 * Menggabungkan:
 * - Fine-grained signals reactivity (alien-signals)
 * - Direct DOM binding (bindText, bindAttr, bindClass, bindStyle, bindInput, on)
 * - Keyed list reconciler tanpa virtual DOM (reconcileKeyedList)
 * - Batch RPC microtask client dispatcher (POST /_kylat/call)
 * - Island registry & hydration (hydrateIsland, hydrateAll)
 */

export * from './signals.js';
export * from './dom.js';
export * from './reconciler.js';
export * from './rpc.js';
export * from './island.js';
