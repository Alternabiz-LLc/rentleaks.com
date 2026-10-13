/** Trusted deployment configuration only; never derived from request headers. */
export function applicationOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const production = env.NODE_ENV === "production";
  const raw = env.APP_URL || env.NEXT_PUBLIC_APP_URL || (production ? "https://app.rentleaks.com" : "http://localhost:3100");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Invalid application origin configuration"); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error("Application URL must be an HTTP(S) origin without credentials, path or query");
  }
  if (production && (url.protocol !== 'https:' || url.port || !['app.rentleaks.com', 'rentleaks.com', 'www.rentleaks.com'].includes(url.hostname))) {
    throw new Error("Production application origin must use HTTPS on a RentLeaks domain");
  }
  return url.origin;
}

/** Block development endpoints even in manually composed production messages. */
export function containsDevelopmentUrl(content: string): boolean {
  const urls = content.match(/https?:\/\/[^\s<>"']+/gi) || [];
  return urls.some((raw) => {
    try {
      const host = new URL(raw).hostname.toLowerCase();
      return host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' || host === '0.0.0.0' || /^127\./.test(host);
    } catch { return false; }
  });
}
