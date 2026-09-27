/**
 * Universal/app links.
 *
 * The public site publishes a home at `/listings/<title-slug>-<id>.html`, and
 * since the translated sites went live the same page also exists under a
 * locale prefix (`/fr/…`, `/de/…`, `/it/…`). The app's own route is
 * `/listing/:id`, and the API resolves either an id or a page slug — the id
 * cannot be split out here, because city ids and housing types both contain
 * hyphens ("san-antonio", "short-term"), so counting segments would guess.
 *
 * Password-reset emails link to /reset?token=… on the app domain. Anything
 * else opens the app at its own path.
 */
const LOCALES = ["fr", "de", "it", "es", "nl"];

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, "https://rentleaks.com");

    /* Drop a locale prefix so a translated link lands on the same screen. */
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length && LOCALES.includes(segments[0].toLowerCase())) segments.shift();
    const pathname = `/${segments.join("/")}`;

    if (segments[0] === "listings" && segments[1]) {
      /* Strip the page extension; the rest is an id or a slug ending in one. */
      const key = segments[1].replace(/\.html?$/i, "");
      return key ? `/listing/${encodeURIComponent(key)}` : "/";
    }
    if (pathname === "/reset") {
      const token = url.searchParams.get("token");
      return token ? `/auth/reset?token=${encodeURIComponent(token)}` : "/auth/forgot";
    }
    /* The pre-2026 catalogue used /listing.html?id=… */
    const legacy = /^\/listing\.html$/.test(pathname) ? url.searchParams.get("id") : null;
    if (legacy) return `/listing/${encodeURIComponent(legacy)}`;
    return path;
  } catch {
    return "/";
  }
}
