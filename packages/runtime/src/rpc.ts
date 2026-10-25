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
  fetchFn?: typeof fetch;
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
}

export class RpcBatcher {
  private queue: QueuedCall[] = [];
  private isFlushScheduled = false;
  private callCounter = 0;
  private config: RpcClientConfig;

  constructor(config?: RpcClientConfig) {
    this.config = {
      endpoint: '/_kylat/call',
      ...config,
    };
  }

  /**
   * Mengambil token CSRF Laravel secara otomatis dari meta tag atau cookie jika tersedia.
   */
  private getCsrfToken(): string | undefined {
    if (this.config.csrfToken) {
      return this.config.csrfToken;
    }

    if (typeof document !== 'undefined') {
      const meta = document.querySelector('meta[name="csrf-token"]');
      if (meta) {
        const content = meta.getAttribute('content');
        if (content) return content;
      }

      // Fallback: baca dari cookie XSRF-TOKEN Laravel
      const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
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
    options?: { idempotencyKey?: string }
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.callCounter++;
      const id = `c_${Date.now()}_${this.callCounter}`;

      this.queue.push({
        call: { id, action, args },
        resolve: resolve as (value: unknown) => void,
        reject,
        idempotencyKey: options?.idempotencyKey,
      });

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
      // Potong batch maksimal 20 calls
      const batchChunk = this.queue.splice(0, PROTOCOL_LIMITS.MAX_CALLS_PER_BATCH);
      const requestPayload: BatchRequest = {
        calls: batchChunk.map((q) => ({
          ...q.call,
          ...(q.idempotencyKey ? { idempotencyKey: q.idempotencyKey } : {}),
        })),
      };

      try {
        const fetchImplementation = this.config.fetchFn ?? fetch;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json, application/problem+json',
        };

        const csrf = this.getCsrfToken();
        if (csrf) {
          headers[PROTOCOL_HEADERS.CSRF_TOKEN] = csrf;
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
        });

        // Tangani Problem Details HTTP level (RFC 9457)
        if (!response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/problem+json') || contentType.includes('application/json')) {
            const problem = (await response.json()) as ProblemDetails;
            const err = new KylatRpcError(problem.detail || problem.title || `Server returned ${response.status}`, {
              code: `HTTP_${response.status}`,
              problemDetails: problem,
            });
            batchChunk.forEach((q) => q.reject(err));
          } else {
            const err = new KylatRpcError(`Server error HTTP ${response.status}`, {
              code: `HTTP_${response.status}`,
            });
            batchChunk.forEach((q) => q.reject(err));
          }
          continue;
        }

        const responseData = (await response.json()) as BatchResponse;
        const resultMap = new Map<string, CallResult>();
        for (const res of responseData.results || []) {
          resultMap.set(res.id, res);
        }

        // Resolusikan setiap call dalam chunk
        for (const queued of batchChunk) {
          const result = resultMap.get(queued.call.id);
          if (!result) {
            queued.reject(new KylatRpcError(`Hasil call '${queued.call.id}' tidak ditemukan dalam response server.`));
          } else if (result.ok) {
            queued.resolve(result.data);
          } else {
            queued.reject(
              new KylatRpcError(result.error.message, {
                code: result.error.type,
                rawError: result.error,
              })
            );
          }
        }
      } catch (networkError) {
        const error = networkError instanceof Error ? networkError : new Error(String(networkError));
        batchChunk.forEach((q) => q.reject(error));
      }
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
  options?: { idempotencyKey?: string }
): Promise<T> {
  return defaultRpcBatcher.call<T>(action, args, options);
}
