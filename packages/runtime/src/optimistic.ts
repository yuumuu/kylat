/**
 * @kylat/runtime - optimistic.ts
 * Optimistic update dan rollback untuk sinyal lokal.
 *
 * Pola: terapkan nilai sementara segera, jalankan operasi server, lalu:
 * - commit: pertahankan nilai (atau rekonsiliasi dengan hasil server);
 * - rollback: kembalikan snapshot sebelumnya bila operasi gagal.
 */

import type { SignalGetter, SignalSetter } from './signals.js';

export interface OptimisticTransaction<T> {
  /** Menyelesaikan transaksi; nilai server opsional untuk rekonsiliasi. */
  commit(value?: T): void;
  /** Mengembalikan nilai ke snapshot sebelum update. */
  rollback(): void;
  readonly settled: boolean;
}

/**
 * Menerapkan nilai optimistis secara sinkron dan mengembalikan handle transaksi.
 * Handle idempoten: commit/rollback kedua tidak berefek.
 */
export function beginOptimistic<T>(
  get: SignalGetter<T>,
  set: SignalSetter<T>,
  next: T
): OptimisticTransaction<T> {
  const previous = get();
  let settled = false;

  set(next);

  return {
    get settled(): boolean {
      return settled;
    },
    commit(value?: T): void {
      if (settled) return;
      settled = true;
      if (arguments.length > 0) {
        set(value as T);
      }
    },
    rollback(): void {
      if (settled) return;
      settled = true;
      set(previous);
    },
  };
}

/**
 * Menjalankan operasi async dengan update optimistis.
 * Bila operasi mengembalikan nilai selain undefined, nilai itu dipakai untuk
 * rekonsiliasi sinyal; bila undefined, nilai optimistis dipertahankan.
 */
export async function withOptimistic<T, R>(
  get: SignalGetter<T>,
  set: SignalSetter<T>,
  next: T,
  operation: () => Promise<R>
): Promise<R> {
  const transaction = beginOptimistic(get, set, next);

  try {
    const result = await operation();
    if (result === undefined) {
      transaction.commit();
    } else {
      transaction.commit(result as unknown as T);
    }
    return result;
  } catch (error) {
    transaction.rollback();
    throw error;
  }
}
