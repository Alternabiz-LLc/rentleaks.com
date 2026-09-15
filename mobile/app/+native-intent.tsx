/**
 * Universal/app links. The website serves homes at /listings/:id; the app's
 * route is /listing/:id. Password-reset emails link to /reset?token=… on the
 * app domain. Anything else opens the app at its own path.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path, "https://rentleaks.com");
    const m = /^\/listings\/([^/?#]+)/.exec(url.pathname);
    if (m) return `/listing/${m[1]}`;
    if (url.pathname === "/reset") {
      const token = url.searchParams.get("token");
      return token ? `/auth/reset?token=${encodeURIComponent(token)}` : "/auth/forgot";
    }
    const html = /^\/listing\.html$/.test(url.pathname) ? url.searchParams.get("id") : null;
    if (html) return `/listing/${encodeURIComponent(html)}`;
    return path;
  } catch {
    return "/";
  }
}
