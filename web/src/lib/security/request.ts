import { isIP } from "node:net";
import { onWorkers } from "../runtime";

/** Forwarded addresses count only behind the configured trusted ingress. */
export function trustedClientIp(headers: Headers, env: Record<string, string | undefined> = process.env, workers = onWorkers()): string | null {
  const name = workers ? "cf-connecting-ip" : env.TRUSTED_PROXY_HEADER;
  if (name !== "cf-connecting-ip" && name !== "x-forwarded-for" && name !== "x-real-ip") return null;
  const ip = (headers.get(name) ?? "").split(",")[0].trim();
  return isIP(ip) ? ip : null;
}
