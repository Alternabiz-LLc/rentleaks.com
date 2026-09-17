/** "Chrome on Mac" from a user-agent string — enough to recognise a device. */
export function deviceLabel(ua: string | null | undefined) {
  const s = String(ua || "");
  if (!s) return "Unknown device";
  if (/RentLeaks app|okhttp|Expo|CFNetwork/i.test(s)) return /Android|okhttp/i.test(s) ? "RentLeaks app on Android" : "RentLeaks app on iPhone";
  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\//.test(s)
      ? "Opera"
      : /Firefox\//.test(s)
        ? "Firefox"
        : /Chrome\//.test(s)
          ? "Chrome"
          : /Safari\//.test(s)
            ? "Safari"
            : "Browser";
  const os = /iPhone|iPad/.test(s)
    ? "iPhone"
    : /Android/.test(s)
      ? "Android"
      : /Mac OS X|Macintosh/.test(s)
        ? "Mac"
        : /Windows/.test(s)
          ? "Windows"
          : /Linux/.test(s)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}
