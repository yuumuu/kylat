/**
 * @kylat/runtime
 * Runtime reaktif fine-grained signals di browser untuk Kylat v0.
 * Dibangun di atas alien-signals (Spike S2 - KEP-07).
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

/**
 * Mengikat nilai sinyal langsung ke node DOM textContent tanpa virtual DOM.
 */
export function bindText(node: Node, getter: SignalGetter<unknown>): () => void {
  return effect(() => {
    node.textContent = String(getter() ?? '');
  });
}

/**
 * Mengikat nilai sinyal ke atribut elemen DOM.
 */
export function bindAttr(el: HTMLElement, attrName: string, getter: SignalGetter<unknown>): () => void {
  return effect(() => {
    const val = getter();
    if (val === false || val === null || val === undefined) {
      el.removeAttribute(attrName);
    } else if (val === true) {
      el.setAttribute(attrName, '');
    } else {
      el.setAttribute(attrName, String(val));
    }
  });
}

/**
 * Two-way data binding untuk input elemen (bind:value).
 */
export function bindInput(
  el: HTMLInputElement | HTMLTextAreaElement,
  getter: SignalGetter<string>,
  setter: SignalSetter<string>
): () => void {
  const unbindEffect = effect(() => {
    const currentVal = getter();
    if (el.value !== currentVal) {
      el.value = currentVal;
    }
  });

  const onInput = () => {
    setter(el.value);
  };

  el.addEventListener('input', onInput);

  return () => {
    unbindEffect();
    el.removeEventListener('input', onInput);
  };
}

export interface IslandProps {
  [key: string]: unknown;
}

export type ComponentFactory = (props: IslandProps) => HTMLElement;
const islandRegistry = new Map<string, ComponentFactory>();

export function registerIsland(name: string, factory: ComponentFactory): void {
  islandRegistry.set(name, factory);
}

/**
 * Hidrasi island wadah HTML yang dihasilkan oleh direktif backend (misal @kylat('Nama', $props)).
 */
export function hydrateIsland(el: HTMLElement): void {
  const islandName = el.getAttribute('data-island');
  const propsRaw = el.getAttribute('data-props');

  if (!islandName) return;

  const factory = islandRegistry.get(islandName);
  if (!factory) {
    console.warn(`[Kylat] Komponen island '${islandName}' belum terdaftar di registry client.`);
    return;
  }

  let props: IslandProps = {};
  if (propsRaw) {
    try {
      props = JSON.parse(propsRaw) as IslandProps;
    } catch (e) {
      console.error(`[Kylat] Gagal mengurai data-props untuk island '${islandName}':`, e);
      return;
    }
  }

  const renderedEl = factory(props);
  el.replaceChildren(renderedEl);
}

/**
 * Memindai seluruh DOM dan menghidrasi seluruh elemen island data-island.
 */
export function hydrateAll(root: Document | HTMLElement = document): void {
  const elements = root.querySelectorAll<HTMLElement>('[data-island]');
  elements.forEach((el) => hydrateIsland(el));
}
