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

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body = (await req.json()) as unknown;
    if (!body || typeof body !== "object") throw new Error("not an object");
    return body as T;
  } catch {
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
        console.error("[api/v1] schema behind code:", err.message);
        return fail(
          503,
          "migration_pending",
          "The server database is missing the mobile tables. Run `npx prisma migrate deploy && npx prisma generate` in web/.",
        );
      }
      console.error("[api/v1]", err);
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
   In-memory, per process. Enough to blunt password spraying and message
   floods from one client on a single instance; a multi-instance deployment
   should move this to Redis or the edge. */

const buckets = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return;
  }
  b.n += 1;
  if (b.n > limit) {
    throw new HttpError(429, "rate_limited", "Too many attempts. Wait a minute and try again.");
  }
}

export function clientKey(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
}
