export type MetaFluxErrorCode =
  | "bad_request" | "not_found" | "provider_error" | "provider_timeout"
  | "rate_limited" | "circuit_open" | "unsupported" | "offline" | "internal";

export class MetaFluxError extends Error {
  readonly code: MetaFluxErrorCode;
  readonly status: number;
  readonly details?: unknown;
  constructor(code: MetaFluxErrorCode, message: string, status = 500, details?: unknown) {
    super(message);
    this.name = "MetaFluxError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown) {
  return new MetaFluxError("bad_request", message, 400, details);
}
export function notFound(message = "Not found", details?: unknown) {
  return new MetaFluxError("not_found", message, 404, details);
}
export function providerError(provider: string, message: string, details?: unknown) {
  return new MetaFluxError("provider_error", `${provider}: ${message}`, 502, details);
}
export function unsupported(message: string) {
  return new MetaFluxError("unsupported", message, 422);
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof MetaFluxError) {
    return json({ error: { code: err.code, message: err.message, details: err.details ?? undefined } }, err.status);
  }
  const message = err instanceof Error ? err.message : String(err);
  return json({ error: { code: "internal", message } }, 500);
}
