/**
 * Marketing email plumbing: merge fields, plain-text → HTML, the compliant
 * footer, unsubscribe tokens and audience filters.
 *
 * Rules this module enforces for every newsletter, bulk or outreach email:
 * - an unsubscribe link in the body and a List-Unsubscribe header (one-click);
 * - the business's postal address in the footer (CAN-SPAM);
 * - unsubscribed and suppressed addresses are never sent to;
 * - newsletters only go to contacts who opted in (and confirmed).
 */
import { createHmac, timingSafeEqual } from "crypto";
import type { Prisma } from "@prisma/client";

export const CONTACT_KINDS = ["renter", "host", "operator", "partner", "press", "other"] as const;
export const CONTACT_STAGES = ["new", "contacted", "qualified", "customer", "lost"] as const;
export const CAMPAIGN_KINDS = ["newsletter", "bulk", "outreach"] as const;

export type Audience = {
  kinds?: string[];
  stages?: string[];
  tags?: string[];
  cityId?: string | null;
  /** Only contacts who opted in to marketing. Always true for newsletters. */
  consentOnly?: boolean;
};

export function coerceAudience(input: unknown, kind: string): Audience {
  const a = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const list = (v: unknown, allowed?: readonly string[]) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && x.length > 0 && (!allowed || allowed.includes(x))).slice(0, 20)
      : [];
  return {
    kinds: list(a.kinds, CONTACT_KINDS),
    stages: list(a.stages, CONTACT_STAGES),
    tags: list(a.tags).map((t) => t.toLowerCase().slice(0, 40)),
    cityId: typeof a.cityId === "string" && a.cityId ? a.cityId.slice(0, 60) : null,
    consentOnly: kind === "newsletter" ? true : a.consentOnly !== false,
  };
}

/** Prisma filter for the contacts an audience reaches. */
export function audienceWhere(a: Audience): Prisma.ContactWhereInput {
  const and: Prisma.ContactWhereInput[] = [{ unsubscribedAt: null }, { confirmToken: null }];
  if (a.consentOnly) and.push({ marketingConsent: true });
  if (a.kinds?.length) and.push({ kind: { in: a.kinds } });
  if (a.stages?.length) and.push({ stage: { in: a.stages } });
  if (a.cityId) and.push({ cityId: a.cityId });
  if (a.tags?.length) and.push({ OR: a.tags.map((t) => ({ tags: { contains: JSON.stringify(t) } })) });
  return { AND: and };
}

export function describeAudience(a: Audience) {
  const parts = [
    a.kinds?.length ? a.kinds.join(" / ") : "all contacts",
    a.stages?.length ? `stage ${a.stages.join(", ")}` : "",
    a.tags?.length ? `tagged ${a.tags.join(", ")}` : "",
    a.cityId ? `in ${a.cityId}` : "",
    a.consentOnly ? "opted in only" : "including contacts without marketing opt-in",
  ];
  return parts.filter(Boolean).join(" · ");
}

/* --- tags --------------------------------------------------------------- */

export function parseTags(value: string | null | undefined): string[] {
  try {
    const v = JSON.parse(value || "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function normaliseTags(input: string | string[]): string[] {
  const raw = Array.isArray(input) ? input : input.split(/[,;]/);
  return [...new Set(raw.map((t) => t.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40)).filter(Boolean))].slice(0, 20);
}

/* --- merge fields ------------------------------------------------------- */

export type MergeData = {
  name?: string;
  email?: string;
  city?: string;
  invite_link?: string;
  app_url?: string;
  unsubscribe_link?: string;
  days?: number | string;
};

export function mergeFields(template: string, data: MergeData): string {
  const first = (data.name || "").trim().split(/\s+/)[0] || "there";
  const values: Record<string, string> = {
    name: data.name?.trim() || "there",
    first_name: first,
    email: data.email || "",
    city: data.city || "your city",
    invite_link: data.invite_link || data.app_url || "",
    app_url: data.app_url || "",
    unsubscribe_link: data.unsubscribe_link || "",
    days: String(data.days ?? 7),
  };
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, key: string) => {
    const k = key.toLowerCase();
    return k in values ? values[k] : whole;
  });
}

/* --- rendering ---------------------------------------------------------- */

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function safeHref(url: string) {
  return /^(https?:|mailto:)/i.test(url) ? url : "#";
}

/** Inline formatting on already-escaped text: [label](url), **bold**, bare URLs. */
function inline(escaped: string) {
  const parts: string[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(escaped))) {
    parts.push(escaped.slice(last, m.index));
    if (m[1]) parts.push(`<a href="${safeHref(m[2])}" style="color:#1f6f63">${m[1]}</a>`);
    else parts.push(`<a href="${safeHref(m[3])}" style="color:#1f6f63">${m[3]}</a>`);
    last = m.index + m[0].length;
  }
  parts.push(escaped.slice(last));
  return parts.join("").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/** Plain text with blank-line paragraphs, "- " bullets and "# " headings → HTML body. */
export function textToHtml(text: string) {
  const blocks = text.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        return `<ul style="margin:0 0 16px;padding-left:20px">${lines
          .map((l) => `<li style="margin:0 0 6px">${inline(escapeHtml(l.replace(/^\s*[-*]\s+/, "")))}</li>`)
          .join("")}</ul>`;
      }
      if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) {
        return `<h2 style="margin:24px 0 8px;font-size:20px;line-height:1.3">${inline(escapeHtml(lines[0].replace(/^#{1,3}\s+/, "")))}</h2>`;
      }
      return `<p style="margin:0 0 16px">${lines.map((l) => inline(escapeHtml(l))).join("<br>")}</p>`;
    })
    .join("\n");
}

/** Markdown-ish → plain text for the text/plain part. */
export function textToPlain(text: string) {
  return text
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#{1,3}\s+/gm, "");
}

export type Footer = { address: string; unsubscribeUrl?: string; reason: string };

export function renderEmail(body: string, footer: Footer) {
  const unsub = footer.unsubscribeUrl
    ? `Unsubscribe: ${footer.unsubscribeUrl}`
    : "";
  const text = [textToPlain(body).trim(), "", "—", footer.reason, footer.address, unsub].filter((l) => l !== undefined).join("\n").trim();
  const html = `<!doctype html><html><body style="margin:0;background:#f5f3ee;padding:24px 12px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d1d1b">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 28px 8px;font-size:16px;line-height:1.6">
<div style="font-weight:700;font-size:18px;margin:0 0 20px"><span style="display:inline-block;background:#1f6f63;color:#fff;border-radius:6px;padding:2px 6px;margin-right:6px;font-size:13px">RL</span>RentLeaks</div>
${textToHtml(body)}
</div>
<div style="max-width:600px;margin:14px auto 0;font-size:12px;line-height:1.6;color:#6b6b66;text-align:center">
${escapeHtml(footer.reason)}<br>${escapeHtml(footer.address)}${
    footer.unsubscribeUrl
      ? `<br><a href="${safeHref(footer.unsubscribeUrl)}" style="color:#6b6b66">Unsubscribe</a>`
      : ""
  }
</div></body></html>`;
  return { text, html };
}

/* --- unsubscribe tokens -------------------------------------------------- */

function secret() {
  return process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "rentleaks-dev-unsubscribe";
}

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function unsubscribeToken(email: string, key = secret()) {
  const e = email.trim().toLowerCase();
  const sig = createHmac("sha256", key).update(`unsub:${e}`).digest();
  return `${b64url(Buffer.from(e))}.${b64url(sig).slice(0, 32)}`;
}

/** The address a token was issued for, or null if it was tampered with. */
export function verifyUnsubscribeToken(token: string, key = secret()): string | null {
  const [head, sig] = String(token || "").split(".");
  if (!head || !sig) return null;
  let email: string;
  try {
    email = Buffer.from(head.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) return null;
  const expected = unsubscribeToken(email, key).split(".")[1];
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? email : null;
}

export function unsubscribeHeaders(url: string, mailto?: string): Record<string, string> {
  return {
    "List-Unsubscribe": mailto ? `<${url}>, <mailto:${mailto}?subject=unsubscribe>` : `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
