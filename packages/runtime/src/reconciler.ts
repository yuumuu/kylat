/**
 * @kylat/runtime - reconciler.ts
 * Fine-grained keyed list reconciler tanpa virtual DOM.
 * Digunakan untuk merender dan memperbarui direktif @foreach ($items as $item).
 */

import { effect } from 'alien-signals';
import type { SignalGetter } from './signals.js';

export interface RenderedItemRecord<T> {
  key: string | number;
  item: T;
  node: Node;
  cleanup?: () => void;
}

export type KeySelector<T> = (item: T, index: number) => string | number;
export type ItemRenderer<T> = (item: T, index: SignalGetter<number>) => { node: Node; cleanup?: () => void };

/**
 * Merekonsiliasi array data ke DOM children berdasarkan kunci unik (key).
 */
export function reconcileKeyedList<T>(
  parent: Node,
  getter: SignalGetter<T[]>,
  keyFn: KeySelector<T>,
  renderFn: ItemRenderer<T>,
  marker?: Node
): () => void {
  // Gunakan marker comment jika belum ada anchor
  const anchor = marker ?? parent.appendChild(document.createComment('kylat-list-end'));
  let currentRecords: RenderedItemRecord<T>[] = [];

  const unbindEffect = effect(() => {
    const nextItems = getter() ?? [];
    const nextLength = nextItems.length;

    // Jika list baru kosong, hapus semua record lama
    if (nextLength === 0) {
      for (const rec of currentRecords) {
        if (rec.cleanup) rec.cleanup();
        if (rec.node.parentNode === parent) {
          parent.removeChild(rec.node);
        }
      }
      currentRecords = [];
      return;
    }

    // Jika list lama kosong, buat semua item baru
    if (currentRecords.length === 0) {
      const newRecords: RenderedItemRecord<T>[] = [];
      for (let i = 0; i < nextLength; i++) {
        const item = nextItems[i];
        if (item === undefined) continue;
        const key = keyFn(item, i);
        const rendered = renderFn(item, () => i);
        parent.insertBefore(rendered.node, anchor);
        newRecords.push({
          key,
          item,
          node: rendered.node,
          cleanup: rendered.cleanup,
        });
      }
      currentRecords = newRecords;
      return;
    }

    // Algoritma diffing berbasis key map
    const oldMap = new Map<string | number, RenderedItemRecord<T>>();
    for (const rec of currentRecords) {
      oldMap.set(rec.key, rec);
    }

    const nextRecords: RenderedItemRecord<T>[] = [];
    const retainedKeys = new Set<string | number>();

    // 1. Identifikasi atau ciptakan item baru
    for (let i = 0; i < nextLength; i++) {
      const item = nextItems[i];
      if (item === undefined) continue;

      const key = keyFn(item, i);
      retainedKeys.add(key);

      const existing = oldMap.get(key);
      if (existing) {
        existing.item = item;
        nextRecords.push(existing);
      } else {
        const rendered = renderFn(item, () => i);
        nextRecords.push({
          key,
          item,
          node: rendered.node,
          cleanup: rendered.cleanup,
        });
      }
    }

    // 2. Hapus node yang tidak ada di list baru
    for (const rec of currentRecords) {
      if (!retainedKeys.has(rec.key)) {
        if (rec.cleanup) rec.cleanup();
        if (rec.node.parentNode === parent) {
          parent.removeChild(rec.node);
        }
      }
    }

    // 3. Susun ulang posisi node di DOM agar sesuai urutan nextRecords
    let nextSibling: Node = anchor;
    for (let i = nextRecords.length - 1; i >= 0; i--) {
      const rec = nextRecords[i];
      if (!rec) continue;
      if (rec.node.nextSibling !== nextSibling) {
        parent.insertBefore(rec.node, nextSibling);
      }
      nextSibling = rec.node;
    }

    currentRecords = nextRecords;
  });

  return () => {
    unbindEffect();
    for (const rec of currentRecords) {
      if (rec.cleanup) rec.cleanup();
      if (rec.node.parentNode === parent) {
        parent.removeChild(rec.node);
      }
    }
    currentRecords = [];
  };
}
