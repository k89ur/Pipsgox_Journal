export type ApiErrorCode =
  | 'INVALID_JSON_BODY'
  | 'BODY_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'UNAUTHENTICATED'
  | 'CORS_FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function normalizeHttpError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) {
    if (error.message === 'BODY_TOO_LARGE') return new ApiError(413, 'BODY_TOO_LARGE');
    if (error.message === 'INVALID_JSON_BODY') return new ApiError(400, 'INVALID_JSON_BODY');
    if (error.message === 'UNSUPPORTED_MEDIA_TYPE') return new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE');
  }
  return new ApiError(500, 'INTERNAL_ERROR');
}
