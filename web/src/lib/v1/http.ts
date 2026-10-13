/**
 * HTTP plumbing for the mobile API (/api/v1).
 *
 * Different contract from lib/api.ts on purpose. That module serves the public
 * catalogue to the static site: CORS-open, cacheable, GET-only. This one serves
 * a signed-in native client: private, never cached, and every error comes back
 * in one shape — `{ error: { code, message } }` — so the app can show the
 * message verbatim instead of guessing what a status code meant.
 */
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "../prisma";
import { trustedClientIp } from "../security/request";

export type ApiError = { code: string; message: string };

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
};

export function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

export function fail(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } satisfies ApiError }), { status, headers: HEADERS });
}

export async function readText(req: Request, maxBytes = 128 * 1024): Promise<string> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, "body_too_large", "The request is too large.");
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new HttpError(413, "body_too_large", "The request is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body: unknown = JSON.parse(await readText(req));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    return body as T;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "bad_json", "The request body could not be read.");
  }
}

/**
 * Wraps a handler so thrown HttpErrors become responses, and so a schema that
 * is behind the code says so plainly instead of returning a bare 500. P2021
 * and P2022 are "table/column does not exist" — i.e. the mobile migration has
 * not been applied on this database yet.
 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.code, err.message);
      if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2021" || err.code === "P2022")) {
        console.error("[api/v1] schema behind code:", err.code);
        return fail(
          503,
          "migration_pending",
          "This service is temporarily unavailable. Please retry shortly.",
        );
      }
      console.error("[api/v1] request failed", err instanceof Prisma.PrismaClientKnownRequestError ? err.code : "unexpected_error");
      return fail(500, "server_error", "Something went wrong on our side. Try again in a moment.");
    }
  };
}

/* --- small parsers ------------------------------------------------------ */

export function str(v: unknown, max = 200) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function int(v: unknown, fallback: number, min = -Infinity, max = Infinity) {
  /* Number(null) and Number("") are 0, which is not "absent". */
  if (v === null || v === undefined || v === "") return fallback;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/* --- rate limiting -------------------------------------------------------
   Fixed-window counters. With UPSTASH_REDIS_REST_URL/TOKEN set (production),
   every server instance shares the same counters in Redis; otherwise they
   live in this process's memory, which is fine for one machine. If Redis is
   unavailable, production falls back to a shared Postgres counter. If both
   stores fail, the request is refused; memory is development-only. */

const buckets = new Map<string, { n: number; reset: number }>();

function memoryHit(key: string, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    if (!b && buckets.size >= 50_000) {
      for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
      if (buckets.size >= 50_000) throw new HttpError(503, "protection_unavailable", "This service is temporarily unavailable. Please retry shortly.");
    }
    buckets.set(key, { n: 1, reset: now + windowMs });
    return 1;
  }
  b.n += 1;
  return b.n;
}

const COUNTER_SCRIPT = "local n=redis.call('INCR',KEYS[1]); if redis.call('PTTL',KEYS[1])<0 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end; return n";

async function redisHit(url: string, token: string, key: string, windowMs: number) {
  const res = await fetch(url.replace(/\/+$/, ""), {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(["EVAL", COUNTER_SCRIPT, "1", `rl:${key}`, String(windowMs)]),
    signal: AbortSignal.timeout(3000), cache: "no-store",
  });
  if (!res.ok) throw new Error("Redis rate counter unavailable");
  const data = await res.json() as { result?: unknown; error?: string };
  const n = Number(data.result);
  if (data.error || !Number.isSafeInteger(n) || n < 1) throw new Error("Invalid rate counter");
  return n;
}

export async function databaseHit(key: string, windowMs: number) {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, CURRENT_TIMESTAMP + ${windowMs} * interval '1 millisecond')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."resetAt" <= CURRENT_TIMESTAMP THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= CURRENT_TIMESTAMP THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count"`;
  const n = rows[0]?.count;
  if (!Number.isSafeInteger(n) || n < 1) throw new Error("Invalid database counter");
  return n;
}

export async function rateLimit(key: string, limit: number, windowMs: number) {
  const hashed = createHash("sha256").update(key).digest("hex");
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  let n: number | undefined;
  if (url && token) {
    try { n = await redisHit(url, token, hashed, windowMs); }
    catch { console.error("[rate-limit] Redis unavailable; using protected fallback"); }
  }
  if (n === undefined) {
    if (process.env.NODE_ENV === "production") {
      try { n = await databaseHit(hashed, windowMs); }
      catch { throw new HttpError(503, "protection_unavailable", "This service is temporarily unavailable. Please retry shortly."); }
    } else n = memoryHit(hashed, windowMs);
  }
  if (n > limit) throw new HttpError(429, "rate_limited", "Too many attempts. Wait a minute and try again.");
}

export function clientKey(req: Request) {
  return trustedClientIp(req.headers) ?? "untrusted-client";
}
