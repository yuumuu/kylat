/**
 * @kylat/runtime - signals.ts
 * Fine-grained signals reactivity primitive berbasis alien-signals.
 */

import { signal, computed, effect } from 'alien-signals';

export type SignalGetter<T> = () => T;
export type SignalSetter<T> = (value: T) => void;
export type SignalTuple<T> = [SignalGetter<T>, SignalSetter<T>];

/**
 * Membuat sinyal reaktif state lokal.
 */
export function createSignal<T>(initialValue: T): SignalTuple<T> {
  const s = signal(initialValue);
  const getter: SignalGetter<T> = () => s();
  const setter: SignalSetter<T> = (val: T) => s(val);
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
