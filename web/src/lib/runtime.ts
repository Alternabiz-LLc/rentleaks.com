/** True when running inside Cloudflare Workers (workerd), false on Node. */
export function onWorkers() {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}
