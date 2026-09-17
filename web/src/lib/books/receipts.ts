/**
 * Receipt files: what may be uploaded and how it is served back.
 *
 * The type is decided from the file's first bytes, never from the name or
 * the browser's claim, so a renamed HTML or SVG file can't ride in as a
 * "photo". Files live in the database (private by construction) and are
 * only ever served to desk members with Books access.
 */

export const RECEIPT_MAX_BYTES = 4 * 1024 * 1024;
export const RECEIPTS_PER_LINE = 10;
/** Uploads not attached to a line within this long are removed. */
export const ORPHAN_HOURS = 24;

export type ReceiptType = "image/jpeg" | "image/png" | "image/webp" | "image/heic" | "application/pdf";

const EXT: Record<ReceiptType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

/** The real type from the magic bytes, or null when it isn't an allowed receipt. */
export function sniffReceipt(b: Uint8Array): ReceiptType | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(b, 1, 4) === "PNG" && b[4] === 0x0d && b[5] === 0x0a) return "image/png";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp";
  if (ascii(b, 4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(ascii(b, 8, 12))) return "image/heic";
  // "%PDF-" within the first kilobyte (some scanners prepend a few bytes).
  const head = ascii(b, 0, Math.min(b.length, 1024));
  if (head.startsWith("%PDF-") || (head.includes("%PDF-") && head.indexOf("%PDF-") < 1024)) return "application/pdf";
  return null;
}

export function isImage(type: string) {
  return type.startsWith("image/") && type !== "image/heic";
}

/** A safe display name: no path, no control characters, the right extension. */
export function cleanFileName(raw: string, type: ReceiptType) {
  const base = String(raw || "")
    .split(/[\\/]/)
    .pop()!
    .replace(/[\u0000-\u001f\u007f"<>|*?:]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .slice(0, 100);
  return `${base || "receipt"}.${EXT[type]}`;
}

/** RFC 6266 Content-Disposition with an ASCII fallback and a UTF-8 name. */
export function contentDisposition(name: string, download: boolean) {
  const fallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${download ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Headers for serving a receipt back: private, never cached, never sniffed. */
export function receiptHeaders(r: { contentType: string; fileName: string; size: number }, download: boolean): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": r.contentType,
    "Content-Length": String(r.size),
    "Content-Disposition": contentDisposition(r.fileName, download),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
  };
  // Images can't run code; lock the document down anyway. PDFs need the
  // browser's own viewer, which a sandboxing CSP would block.
  if (r.contentType !== "application/pdf") h["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'";
  return h;
}

/** Same-origin check for cookie-authenticated POST/DELETE routes. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
