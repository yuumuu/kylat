/**
 * @kylat/runtime - reconciler.ts
 * Fine-grained keyed list reconciler tanpa virtual DOM.
 * Digunakan untuk merender dan memperbarui direktif @foreach ($items as $item).
 */

import { effect, effectScope, signal } from 'alien-signals';
import { untrack, type SignalGetter } from './signals.js';

export interface RenderedItemRecord<T> {
  key: string | number;
  item: T;
  nodes: Node[];
  cleanup?: () => void;
  setIndex: (index: number) => void;
}

export type KeySelector<T> = (item: T, index: number) => string | number;
export type ItemRenderer<T> = (
  item: T,
  index: SignalGetter<number>
) => { node: Node; cleanup?: () => void };

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
  const anchor = marker ?? parent.appendChild(document.createComment('kylat-list-end'));
  let currentRecords: RenderedItemRecord<T>[] = [];

  const createRecord = (item: T, index: number, key: string | number): RenderedItemRecord<T> => {
    const indexSignal = signal(index);
    let rendered: { node: Node; cleanup?: () => void } | undefined;
    const stopScope = effectScope(() => {
      rendered = untrack(() => renderFn(item, () => indexSignal()));
    });
    if (!rendered) throw new Error('[Kylat] render @foreach tidak mengembalikan node.');
    const nodes =
      rendered.node.nodeType === 11
        ? Array.from((rendered.node as DocumentFragment).childNodes)
        : [rendered.node];
    if (nodes.length === 0) {
      nodes.push(document.createComment('kylat-empty-item'));
    }
    return {
      key,
      item,
      nodes,
      cleanup: () => {
        if (rendered?.cleanup) rendered.cleanup();
        stopScope();
      },
      setIndex: (next) => indexSignal(next),
    };
  };

  const insertRecord = (record: RenderedItemRecord<T>, before: Node): void => {
    for (const node of record.nodes) {
      parent.insertBefore(node, before);
    }
  };

  const removeRecord = (record: RenderedItemRecord<T>): void => {
    if (record.cleanup) record.cleanup();
    for (const node of record.nodes) {
      if (node.parentNode === parent) {
        parent.removeChild(node);
      }
    }
  };

  const unbindEffect = effect(() => {
    const nextItems = getter() ?? [];
    const oldMap = new Map<string | number, RenderedItemRecord<T>>();
    for (const record of currentRecords) {
      oldMap.set(record.key, record);
    }

    const nextRecords: RenderedItemRecord<T>[] = [];
    const retainedKeys = new Set<string | number>();

    for (let i = 0; i < nextItems.length; i++) {
      const item = nextItems[i];
      if (item === undefined) continue;
      const key = keyFn(item, i);
      if (retainedKeys.has(key)) {
        throw new Error(`[Kylat] key duplikat pada @foreach: ${String(key)}`);
      }
      retainedKeys.add(key);

      const existing = oldMap.get(key);
      if (existing && existing.item === item) {
        existing.setIndex(i);
        nextRecords.push(existing);
        continue;
      }

      if (existing) {
        removeRecord(existing);
      }
      const record = createRecord(item, i, key);
      insertRecord(record, anchor);
      nextRecords.push(record);
    }

    for (const record of currentRecords) {
      if (!retainedKeys.has(record.key)) {
        removeRecord(record);
      }
    }

    // Susun ulang posisi node sesuai urutan list baru.
    let nextSibling: Node = anchor;
    for (let i = nextRecords.length - 1; i >= 0; i--) {
      const record = nextRecords[i]!;
      const lastNode = record.nodes[record.nodes.length - 1]!;
      if (lastNode.nextSibling !== nextSibling) {
        for (const node of record.nodes) {
          parent.insertBefore(node, nextSibling);
        }
      }
      nextSibling = record.nodes[0]!;
    }

    currentRecords = nextRecords;
  });

  return () => {
    unbindEffect();
    for (const record of currentRecords) {
      removeRecord(record);
    }
    currentRecords = [];
  };
}
