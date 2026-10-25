/**
 * @kylat/runtime - dom.ts
 * Fine-grained DOM binding primitives tanpa virtual DOM.
 */

import { effect } from 'alien-signals';
import type { SignalGetter, SignalSetter } from './signals.js';

/**
 * Mengikat nilai sinyal langsung ke node DOM (biasanya Text node) tanpa VDOM.
 */
export function bindText(node: Node, getter: SignalGetter<unknown>): () => void {
  return effect(() => {
    node.textContent = String(getter() ?? '');
  });
}

/**
 * Mengikat nilai sinyal ke atribut elemen HTML.
 * Menangani boolean attributes (cth: disabled, checked, hidden).
 */
export function bindAttr(
  el: HTMLElement,
  attrName: string,
  getter: SignalGetter<unknown>
): () => void {
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
 * Mengikat nilai sinyal boolean ke kelas CSS elemen HTML.
 */
export function bindClass(
  el: HTMLElement,
  className: string,
  getter: SignalGetter<boolean>
): () => void {
  return effect(() => {
    const active = Boolean(getter());
    if (active) {
      el.classList.add(className);
    } else {
      el.classList.remove(className);
    }
  });
}

/**
 * Mengikat nilai sinyal ke properti inline style elemen HTML.
 */
export function bindStyle(
  el: HTMLElement,
  propName: string,
  getter: SignalGetter<string | null | undefined>
): () => void {
  return effect(() => {
    const val = getter();
    if (val === null || val === undefined) {
      el.style.removeProperty(propName);
    } else {
      el.style.setProperty(propName, String(val));
    }
  });
}

/**
 * Two-way data binding untuk input dan textarea (bind:value).
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

/**
 * Menambahkan event listener dengan pembersihan otomatis.
 */
export function on<E extends Event>(
  el: EventTarget,
  eventName: string,
  handler: (e: E) => void,
  options?: boolean | AddEventListenerOptions
): () => void {
  const listener = handler as EventListener;
  el.addEventListener(eventName, listener, options);
  return () => {
    el.removeEventListener(eventName, listener, options);
  };
}
