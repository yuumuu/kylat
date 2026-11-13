/**
 * @kylat/runtime - rpc.ts
 * Batch RPC dispatcher client untuk Kylat v0.
 * Mengimplementasikan pengiriman batch microtask POST /_kylat/call sesuai spec/protocol.schema.json.
 */

import {
  type Call,
  type BatchRequest,
  type BatchResponse,
  type CallResult,
  type ProblemDetails,
  PROTOCOL_LIMITS,
  PROTOCOL_HEADERS,
} from '@kylat/protocol';

export interface RpcClientConfig {
  endpoint?: string;
  buildId?: string;
  csrfToken?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface CallOptions {
  idempotencyKey?: string;
  maxRetries?: number; // Kuota retry untuk error transient HTTP (502, 503, 504) atau jaringan
  inProgressRetries?: number; // Kuota retry terpisah khusus untuk respons kylat:in_progress
  retryDelayFn?: (attempt: number, type: 'transient_5xx' | 'in_progress') => number;
  /**
   * Update optimistis: apply dijalankan sinkron sebelum request dikirim,
   * rollback dijalankan sekali bila call berakhir gagal.
   */
  optimistic?: {
    apply: () => void;
    rollback: () => void;
  };
}

export class KylatRpcError extends Error {
  public readonly code?: string;
  public readonly pointer?: string;
  public readonly problemDetails?: ProblemDetails;
  public readonly rawError?: unknown;

  constructor(message: string, options?: { code?: string; pointer?: string; problemDetails?: ProblemDetails; rawError?: unknown }) {
    super(message);
    this.name = 'KylatRpcError';
    this.code = options?.code;
    this.pointer = options?.pointer;
    this.problemDetails = options?.problemDetails;
    this.rawError = options?.rawError;
  }
}

interface QueuedCall {
  call: Call;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  idempotencyKey?: string;
  transientRetriesRemaining: number;
  inProgressRetriesRemaining: number;
  transientAttempt: number;
  inProgressAttempt: number;
  retryDelayFn?: (attempt: number, type: 'transient_5xx' | 'in_progress') => number;
}

interface CsrfToken {
  header: string;
  value: string;
}

export class RpcBatcher {
  private queue: QueuedCall[] = [];
  private isFlushScheduled = false;
  private callCounter = 0;
  private config: RpcClientConfig;

  constructor(config?: RpcClientConfig) {
    this.config = {
      endpoint: '/_kylat/call',
      timeoutMs: 30_000,
      ...config,
    };
  }

  /**
   * Mengambil token CSRF Laravel secara otomatis dari meta tag atau cookie.
   *
   * Meta tag memakai header X-CSRF-Token. Cookie XSRF-TOKEN milik Laravel
   * adalah nilai terenkripsi dan harus dikirim sebagai X-XSRF-TOKEN; mengirimnya
   * sebagai X-CSRF-Token akan menghasilkan 419.
   */
  private getCsrfToken(): CsrfToken | undefined {
    if (this.config.csrfToken) {
      return { header: PROTOCOL_HEADERS.CSRF_TOKEN, value: this.config.csrfToken };
    }

    if (typeof document !== 'undefined') {
      const meta = document.querySelector('meta[name="csrf-token"]');
      if (meta) {
        const content = meta.getAttribute('content');
        if (content) {
          return { header: PROTOCOL_HEADERS.CSRF_TOKEN, value: content };
        }
      }

      const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
      if (match && match[1]) {
        try {
          return { header: 'X-XSRF-TOKEN', value: decodeURIComponent(match[1]) };
        } catch {
          return { header: 'X-XSRF-TOKEN', value: match[1] };
        }
      }
    }

    return undefined;
  }

  /**
   * Memanggil server action secara asynchronous.
   * Panggilan dalam microtask yang sama akan digabungkan otomatis menjadi 1 request HTTP batch.
   */
  public call<T = unknown>(
    action: string,
    args: Record<string, unknown> = {},
    options?: CallOptions
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.callCounter++;
      const id = `c_${Date.now()}_${this.callCounter}`;

      const hasIdempotency = Boolean(options?.idempotencyKey);
      const queued: QueuedCall = {
        call: { id, action, args },
        resolve: resolve as (value: unknown) => void,
        reject,
        idempotencyKey: options?.idempotencyKey,
        // Budget 5xx transient: default 2 kali (sekitar 450 ms - 2s)
        transientRetriesRemaining: options?.maxRetries ?? (hasIdempotency ? 2 : 0),
        // Budget in_progress terpisah: default 30 kali untuk menutupi lease server ~30 detik
        inProgressRetriesRemaining: options?.inProgressRetries ?? (hasIdempotency ? 30 : 0),
        transientAttempt: 0,
        inProgressAttempt: 0,
        retryDelayFn: options?.retryDelayFn,
      };

      const optimistic = options?.optimistic;
      let optimisticSettled = false;

      if (optimistic) {
        const originalResolve = queued.resolve;
        const originalReject = queued.reject;

        queued.resolve = (value: unknown) => {
          optimisticSettled = true;
          originalResolve(value);
        };
        queued.reject = (reason: unknown) => {
          if (!optimisticSettled) {
            optimisticSettled = true;
            optimistic.rollback();
          }
          originalReject(reason);
        };

        try {
          optimistic.apply();
        } catch (error) {
          queued.reject(error);
          return;
        }
      }

      this.queue.push(queued);

      if (!this.isFlushScheduled) {
        this.isFlushScheduled = true;
        queueMicrotask(() => this.flush());
      }
    });
  }

  /**
   * Mengirim seluruh antrean call dalam batch hingga batas PROTOCOL_LIMITS.MAX_CALLS_PER_BATCH (20).
   */
  private async flush(): Promise<void> {
    this.isFlushScheduled = false;

    while (this.queue.length > 0) {
      const batchChunk = this.queue.splice(0, PROTOCOL_LIMITS.MAX_CALLS_PER_BATCH);
      const requestPayload: BatchRequest = {
        calls: batchChunk.map((q) => ({
          ...q.call,
          ...(q.idempotencyKey ? { idempotencyKey: q.idempotencyKey } : {}),
        })),
      };

      const controller = new AbortController();
      const timeoutMs = this.config.timeoutMs ?? 30_000;
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const fetchImplementation = this.config.fetchFn ?? fetch;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json, application/problem+json',
        };

        const csrf = this.getCsrfToken();
        if (csrf) {
          headers[csrf.header] = csrf.value;
        }

        if (this.config.buildId) {
          headers[PROTOCOL_HEADERS.BUILD_ID] = this.config.buildId;
        }

        // Jika satu call memiliki idempotency key dan batch berukuran 1, pasang juga di header HTTP
        const singleCall = batchChunk[0];
        if (batchChunk.length === 1 && singleCall?.idempotencyKey) {
          headers[PROTOCOL_HEADERS.IDEMPOTENCY_KEY] = singleCall.idempotencyKey;
        }

        const endpoint = this.config.endpoint ?? '/_kylat/call';
        const response = await fetchImplementation(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });

        if (!response.ok) {
          const isTransient = [502, 503, 504].includes(response.status);
          const contentType = response.headers.get('content-type') || '';
          let err: KylatRpcError;

          if (contentType.includes('application/problem+json') || contentType.includes('application/json')) {
            const problem = (await response.json()) as ProblemDetails;
            err = new KylatRpcError(problem.detail || problem.title || `Server returned ${response.status}`, {
              code: `HTTP_${response.status}`,
              problemDetails: problem,
            });
          } else {
            err = new KylatRpcError(`Server error HTTP ${response.status}`, {
              code: `HTTP_${response.status}`,
            });
          }

          for (const q of batchChunk) {
            if (isTransient && q.idempotencyKey && q.transientRetriesRemaining > 0) {
              q.transientRetriesRemaining--;
              q.transientAttempt++;
              const delay = q.retryDelayFn
                ? q.retryDelayFn(q.transientAttempt, 'transient_5xx')
                : Math.min(2000, 150 * Math.pow(2, q.transientAttempt - 1)) + Math.random() * 50;

              setTimeout(() => {
                this.queue.push(q);
                this.scheduleFlush();
              }, delay);
            } else {
              q.reject(err);
            }
          }
          continue;
        }

        const responseData = (await response.json()) as BatchResponse;
        const resultMap = new Map<string, CallResult>();
        for (const res of responseData.results || []) {
          resultMap.set(res.id, res);
        }

        for (const queued of batchChunk) {
          const result = resultMap.get(queued.call.id);
          if (!result) {
            queued.reject(new KylatRpcError(`Hasil call '${queued.call.id}' tidak ditemukan dalam response server.`));
          } else if (result.ok) {
            queued.resolve(result.data);
          } else {
            if (result.error.type === 'kylat:in_progress' && queued.idempotencyKey && queued.inProgressRetriesRemaining > 0) {
              queued.inProgressRetriesRemaining--;
              queued.inProgressAttempt++;
              const delay = queued.retryDelayFn
                ? queued.retryDelayFn(queued.inProgressAttempt, 'in_progress')
                : Math.min(2000, 500 * Math.pow(1.25, queued.inProgressAttempt - 1)) + Math.random() * 100;

              setTimeout(() => {
                this.queue.push(queued);
                this.scheduleFlush();
              }, delay);
            } else {
              queued.reject(
                new KylatRpcError(result.error.message, {
                  code: result.error.type,
                  rawError: result.error,
                })
              );
            }
          }
        }
      } catch (networkError) {
        const error = networkError instanceof Error ? networkError : new Error(String(networkError));
        const timedOut = controller.signal.aborted;
        for (const q of batchChunk) {
          if (!timedOut && q.idempotencyKey && q.transientRetriesRemaining > 0) {
            q.transientRetriesRemaining--;
            q.transientAttempt++;
            const delay = q.retryDelayFn
              ? q.retryDelayFn(q.transientAttempt, 'transient_5xx')
              : Math.min(2000, 150 * Math.pow(2, q.transientAttempt - 1)) + Math.random() * 50;

            setTimeout(() => {
              this.queue.push(q);
              this.scheduleFlush();
            }, delay);
          } else {
            q.reject(
              timedOut
                ? new KylatRpcError(`Permintaan Kylat melebihi batas waktu ${timeoutMs} ms.`, {
                    code: 'kylat:timeout',
                    rawError: error,
                  })
                : error
            );
          }
        }
      } finally {
        clearTimeout(timer);
      }
    }
  }

  private scheduleFlush(): void {
    if (!this.isFlushScheduled) {
      this.isFlushScheduled = true;
      queueMicrotask(() => this.flush());
    }
  }
}

// Instance default singleton untuk pemanggilan instan
export const defaultRpcBatcher = new RpcBatcher();

/**
 * Helper global untuk memanggil aksi server Kylat.
 */
export function callServerAction<T = unknown>(
  action: string,
  args: Record<string, unknown> = {},
  options?: CallOptions
): Promise<T> {
  return defaultRpcBatcher.call<T>(action, args, options);
}
