/**
 * The single swap point between the mock driver and Sameer's backend.
 *
 * The dashboard talks to the REST + SSE contract in CLAUDE.md §8.2/§8.3 and
 * nothing else. Point `NEXT_PUBLIC_API_BASE` at the real API and every screen
 * follows — no component knows where its data comes from.
 *
 *     NEXT_PUBLIC_API_BASE=https://sentinel-api.up.railway.app
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export const IS_MOCK = API_BASE === "";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(path), { signal, cache: "no-store" });
  if (!response.ok) {
    throw new ApiError(
      response.status === 404 ? "Not found" : `Request failed (${response.status})`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}
