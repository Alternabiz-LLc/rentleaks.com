import { timingSafeEqual } from "crypto";

/** Constant-time check for `Authorization: Bearer <secret>`. */
export function bearerMatches(header: string | null, secret: string) {
  const presented = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const got = Buffer.from(presented);
  const want = Buffer.from(secret);
  return got.length === want.length && timingSafeEqual(got, want);
}
