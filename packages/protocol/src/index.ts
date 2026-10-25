/**
 * @kylat/protocol
 * Definisi tipe dan kontrak wire RPC batch Kylat v0.
 */

export interface Call {
  id: string;
  action: string;
  args: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface BatchRequest {
  calls: Call[];
}

export interface ValidationError {
  pointer: string;
  code: string;
  message: string;
}

export type CallErrorType =
  | 'kylat:validation'
  | 'kylat:unauthorized'
  | 'kylat:forbidden'
  | 'kylat:not_found'
  | 'kylat:server_error'
  | 'kylat:action_error'
  | 'kylat:idempotency_conflict';

export interface CallError {
  type: CallErrorType;
  title?: string;
  message: string;
  errors?: ValidationError[];
}

export interface CallSuccessResult<T = unknown> {
  id: string;
  ok: true;
  data: T;
}

export interface CallFailureResult {
  id: string;
  ok: false;
  error: CallError;
}

export type CallResult<T = unknown> = CallSuccessResult<T> | CallFailureResult;

export interface BatchResponse {
  results: CallResult[];
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

export const PROTOCOL_LIMITS = {
  MAX_BODY_SIZE_BYTES: 256 * 1024, // 256 KB
  MAX_CALLS_PER_BATCH: 20,
  MAX_JSON_DEPTH: 16,
  MAX_ARRAY_ITEMS: 1000,
  MAX_STRING_LENGTH: 10000,
  ACTION_TIMEOUT_SECONDS: 10,
  IDEMPOTENCY_TTL_SECONDS: 24 * 60 * 60, // 24 jam
} as const;

export const PROTOCOL_HEADERS = {
  BUILD_ID: 'X-Kylat-Build',
  CSRF_TOKEN: 'X-CSRF-Token',
  IDEMPOTENCY_KEY: 'Idempotency-Key',
  AUTHORIZATION: 'Authorization',
} as const;
