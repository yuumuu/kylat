/**
 * @kylat/runtime - signals.ts
 * Fine-grained signals reactivity primitive berbasis alien-signals.
 */

import { signal, computed, effect, getActiveSub, setActiveSub } from 'alien-signals';

export type SignalGetter<T> = () => T;
export type SignalSetter<T> = (value: T) => void;
export type SignalTuple<T> = [SignalGetter<T>, SignalSetter<T>];

/**
 * Membuat sinyal reaktif state lokal.
 */
export function createSignal<T>(initialValue: T): SignalTuple<T> {
  const s = signal(initialValue);
  const getter: SignalGetter<T> = () => s();
  const setter: SignalSetter<T> = (value: T) => s(value);
  return [getter, setter];
}

/**
 * Membuat sinyal terkomputasi (computed getter) dengan auto-dependency tracking.
 */
export function createComputed<T>(fn: () => T): SignalGetter<T> {
  const c = computed(fn);
  return () => c();
}

/**
 * Menjalankan efek samping reaktif yang secara otomatis melacak sinyal yang dibacanya.
 */
export function createEffect(fn: () => void): () => void {
  return effect(fn);
}

/**
 * Membuat Idempotency-Key yang unik dan cukup panjang (8-128 karakter).
 * Memakai crypto.randomUUID bila tersedia; fallback yang aman untuk lingkungan
 * lama tetap menyertakan waktu + randomness.
 */
export function createIdempotencyKey(): string {
  const cryptoObject = globalThis.crypto as Crypto | undefined;
  if (cryptoObject && typeof cryptoObject.randomUUID === 'function') {
    return `kylat_${cryptoObject.randomUUID()}`;
  }
  return `kylat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Menjalankan fungsi tanpa melacak/menjadikannya child dari effect aktif.
 * Dipakai saat render bercabang membuat binding baru.
 */
export function untrack<T>(fn: () => T): T {
  const previous = getActiveSub();
  setActiveSub(undefined);
  try {
    return fn();
  } finally {
    setActiveSub(previous);
  }
}
