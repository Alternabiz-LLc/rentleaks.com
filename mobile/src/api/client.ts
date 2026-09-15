/**
 * The one place the app talks to the server.
 *
 * Every call carries the bearer token when there is one, times out instead of
 * hanging on a bad connection, and turns the server's `{ error: { code,
 * message } }` into an ApiError whose message is safe to show as-is.
 */
import { File, UploadType } from "expo-file-system";
import { API_URL } from "./config";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(next: string | null) {
  token = next;
}

export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

type Opts = { method?: string; body?: unknown; query?: Record<string, unknown>; timeoutMs?: number; signal?: AbortSignal };

export function qs(query?: Record<string, unknown>) {
  if (!query) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    p.set(k, v === true ? "1" : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  opts.signal?.addEventListener("abort", () => controller.abort());

  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${qs(opts.query)}`, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new ApiError(0, aborted ? "timeout" : "offline", aborted ? "The server took too long to answer." : "You appear to be offline.");
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string } } | null)?.error;
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, e?.code ?? "http_" + res.status, e?.message ?? "Something went wrong. Try again.", data);
  }
  return data as T;
}

/** Multipart upload of a local file (photo from the picker/camera). */
export async function uploadFile(localUri: string, mimeType = "image/jpeg") {
  const file = new File(localUri);
  const result = await file.upload(`${API_URL}/api/v1/uploads`, {
    uploadType: UploadType.MULTIPART,
    fieldName: "file",
    mimeType,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  let data: { path?: string; url?: string; error?: { code: string; message: string } } = {};
  try {
    data = JSON.parse(result.body);
  } catch {
    /* fall through */
  }
  if (result.status >= 400 || !data.path) {
    throw new ApiError(result.status, data.error?.code ?? "upload_failed", data.error?.message ?? "That photo did not upload. Try again.");
  }
  return { path: data.path, url: data.url ?? data.path };
}
