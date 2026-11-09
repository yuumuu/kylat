/**
 * @kylat/runtime - dom.ts
 * Fine-grained DOM binding primitives tanpa virtual DOM.
 */

import { effect, effectScope } from 'alien-signals';
import { untrack, type SignalGetter, type SignalSetter } from './signals.js';

const URL_ATTRIBUTES = new Set(['href', 'src', 'formaction', 'xlink:href']);

function isSafeUrl(value: string): boolean {
  const normalized = value.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
  return !(
    normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('data:')
  );
}

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
 * Menangani boolean attributes dan sanitasi URL untuk href/src.
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
      return;
    }
    if (val === true) {
      el.setAttribute(attrName, '');
      return;
    }
    const stringValue = String(val);
    if (URL_ATTRIBUTES.has(attrName.toLowerCase()) && !isSafeUrl(stringValue)) {
      el.removeAttribute(attrName);
      return;
    }
    el.setAttribute(attrName, stringValue);
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
 * Two-way data binding untuk checkbox/radio (bind:checked).
 */
export function bindChecked(
  el: HTMLInputElement,
  getter: SignalGetter<boolean>,
  setter: SignalSetter<boolean>
): () => void {
  const unbindEffect = effect(() => {
    el.checked = Boolean(getter());
  });

  const onChange = () => {
    setter(el.checked);
  };

  el.addEventListener('change', onChange);

  return () => {
    unbindEffect();
    el.removeEventListener('change', onChange);
  };
}

/**
 * Render kondisional reaktif tanpa VDOM.
 *
 * `render` dipanggil hanya saat kondisi berubah dari false ke true. Isi yang
 * dikembalikan boleh berupa Node tunggal atau DocumentFragment.
 */
export function bindIf(
  parent: Node,
  getter: SignalGetter<unknown>,
  render: () => Node,
  marker?: Node
): () => void {
  const anchor = marker ?? parent.appendChild(document.createComment('kylat-if-end'));
  let current: Node[] = [];
  let active = false;
  let stopScope: (() => void) | undefined;

  const unbindEffect = effect(() => {
    const shouldRender = Boolean(getter());
    if (shouldRender && !active) {
      let rendered: Node | undefined;
      stopScope = effectScope(() => {
        rendered = untrack(render);
      });
      if (!rendered) return;
      active = true;
      const nodes =
        rendered.nodeType === 11
          ? Array.from((rendered as DocumentFragment).childNodes)
          : [rendered];
      current = nodes;
      for (const node of nodes) {
        parent.insertBefore(node, anchor);
      }
      return;
    }
    if (!shouldRender && active) {
      for (const node of current) {
        if (node.parentNode === parent) parent.removeChild(node);
      }
      current = [];
      active = false;
      if (stopScope) {
        stopScope();
        stopScope = undefined;
      }
    }
  });

  return () => {
    unbindEffect();
    if (stopScope) stopScope();
    active = false;
    for (const node of current) {
      if (node.parentNode === parent) parent.removeChild(node);
    }
    current = [];
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
