/**
 * Trust Radar: the patterns behind most rental fraud, found before a renter
 * pays. Copied listings (the same photo, text or address under a different
 * account), rent far below the market, scam wording in a listing, brand-new
 * accounts moving fast, and messages the scam guard flagged.
 *
 * Every signal carries its evidence. Nothing here acts on its own: a person
 * looks, then pauses, suspends, warns — or dismisses it for good.
 */
import { mediaFromDetail } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { sampleCatalogIds } from "@/lib/sample-catalog";
import { scanMessage, signalsFromFlags } from "@/lib/v1/scam-guard";

export type TrustKind = "photo" | "text" | "address" | "price" | "wording" | "velocity" | "messages" | "reports";
export type Severity = "high" | "medium" | "low";

export type TrustSignal = {
  id: string;
  kind: TrustKind;
  severity: Severity;
  title: string;
  detail: string;
  listingIds: string[];
  userIds: string[];
  evidence: Array<{ label: string; value: string; image?: string; href?: string }>;
  at: Date;
  /** Filled at the end: who and what the actions on this card touch, newest first. */
  people?: Array<{ id: string; name: string; since: string }>;
  homes?: Array<{ id: string; title: string; posted: string }>;
};

export const KIND_LABEL: Record<TrustKind, string> = {
  photo: "Copied photo",
  text: "Copied description",
  address: "Same address, other account",
  price: "Too cheap for the market",
  wording: "Scam wording in listing",
  velocity: "New account moving fast",
  messages: "Flagged messages",
  reports: "Repeat reports",
};

const DAY = 86_400_000;

/* ---- pure helpers (tested) ---------------------------------------------- */

export function normaliseText(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function shingles(s: string, size = 5): Set<string> {
  const words = normaliseText(s).split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + size <= words.length; i++) out.add(words.slice(i, i + size).join(" "));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const x of small) if (big.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

export function normaliseAddress(s: string) {
  return normaliseText(s)
    .replace(/\b(apt|apartment|unit|suite|ste|fl|floor|room|rm)\b.*$/, "")
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(road)\b/g, "rd")
    .trim();
}

export function medianOf(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Share of the market median below which rent is suspicious. */
export const PRICE_FLOOR = 0.55;

/* ---- loader -------------------------------------------------------------- */

type Row = {
  id: string;
  title: string;
  hostId: string;
  cityId: string;
  housingType: string;
  allInUsd: number;
  address: string;
  description: string;
  image: string;
  detail: unknown;
  status: string;
  moderation: string;
  createdAt: Date;
  host: { id: string; name: string; email: string; createdAt: Date; role: string };
  city: { name: string };
};

export async function loadTrustSignals(now = new Date()): Promise<{ signals: TrustSignal[]; scanned: number; samplesSkipped: boolean }> {
  const t = now.getTime();
  let sample = new Set<string>();
  let samplesSkipped = true;
  try {
    sample = await sampleCatalogIds();
  } catch {
    samplesSkipped = false;
  }
  const rows: Row[] = (
    await prisma.listing.findMany({
      where: { status: { not: "paused" }, moderation: { not: "declined" } },
      select: {
        id: true,
        title: true,
        hostId: true,
        cityId: true,
        housingType: true,
        allInUsd: true,
        address: true,
        description: true,
        image: true,
        detail: true,
        status: true,
        moderation: true,
        createdAt: true,
        host: { select: { id: true, name: true, email: true, createdAt: true, role: true } },
        city: { select: { name: true } },
      },
      take: 5000,
    })
  ).filter((r) => !sample.has(r.id));

  const signals: TrustSignal[] = [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const who = (r: Row) => `${r.host.name} <${r.host.email}>`;
  const href = (id: string) => `/admin/listings?q=${encodeURIComponent(id)}`;

  /* 1. The same photo file under more than one account. */
  const photoHosts = new Map<string, Row[]>();
  for (const r of rows) {
    const photos = new Set([r.image, ...mediaFromDetail(r.detail).photos].filter((p) => p && !p.includes("placeholder")));
    for (const p of photos) {
      const list = photoHosts.get(p) ?? [];
      list.push(r);
      photoHosts.set(p, list);
    }
  }
  const photoPairs = new Set<string>();
  for (const [photo, list] of photoHosts) {
    const hosts = new Set(list.map((r) => r.hostId));
    if (hosts.size < 2) continue;
    const ids = [...new Set(list.map((r) => r.id))].sort();
    const key = ids.join("+");
    if (photoPairs.has(key)) continue;
    photoPairs.add(key);
    const newest = [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    signals.push({
      id: `photo:${key}`,
      kind: "photo",
      severity: "high",
      title: `“${newest.title}” uses a photo from another account`,
      detail: `${hosts.size} accounts share this exact photo. The newest listing is usually the copy.`,
      listingIds: ids,
      userIds: [...hosts],
      evidence: [
        { label: "Photo", value: photo, image: photo },
        ...list.slice(0, 4).map((r) => ({ label: `${r.city.name} · ${r.createdAt.toISOString().slice(0, 10)}`, value: `${r.title} — ${who(r)}`, href: href(r.id) })),
      ],
      at: newest.createdAt,
    });
  }

  /* 2. The same description under another account (same city). */
  const byCity = new Map<string, Row[]>();
  for (const r of rows) {
    if (normaliseText(r.description).split(" ").length < 25) continue;
    const list = byCity.get(r.cityId) ?? [];
    list.push(r);
    byCity.set(r.cityId, list);
  }
  for (const list of byCity.values()) {
    const capped = list.slice(0, 400);
    const sh = capped.map((r) => shingles(r.description));
    for (let i = 0; i < capped.length; i++) {
      for (let j = i + 1; j < capped.length; j++) {
        if (capped[i].hostId === capped[j].hostId) continue;
        const sim = jaccard(sh[i], sh[j]);
        if (sim < 0.6) continue;
        const [a, b] = [capped[i], capped[j]].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
        signals.push({
          id: `text:${[a.id, b.id].sort().join("+")}`,
          kind: "text",
          severity: sim > 0.85 ? "high" : "medium",
          title: `“${b.title}” repeats another account's description`,
          detail: `${Math.round(sim * 100)}% of the wording matches a listing posted earlier by someone else.`,
          listingIds: [a.id, b.id],
          userIds: [a.hostId, b.hostId],
          evidence: [
            { label: `Original · ${a.createdAt.toISOString().slice(0, 10)}`, value: `${a.title} — ${who(a)}`, href: href(a.id) },
            { label: `Later · ${b.createdAt.toISOString().slice(0, 10)}`, value: `${b.title} — ${who(b)}`, href: href(b.id) },
            { label: "Shared wording", value: `${a.description.slice(0, 180)}…` },
          ],
          at: b.createdAt,
        });
      }
    }
  }

  /* 3. The same street address under more than one account. */
  const byAddress = new Map<string, Row[]>();
  for (const r of rows) {
    const a = normaliseAddress(r.address);
    if (a.length < 8) continue;
    const key = `${r.cityId}|${a}`;
    const list = byAddress.get(key) ?? [];
    list.push(r);
    byAddress.set(key, list);
  }
  for (const [key, list] of byAddress) {
    const hosts = new Set(list.map((r) => r.hostId));
    if (hosts.size < 2) continue;
    const ids = list.map((r) => r.id).sort();
    signals.push({
      id: `address:${ids.join("+")}`,
      kind: "address",
      severity: "medium",
      title: `${list[0].address} is listed by ${hosts.size} different accounts`,
      detail: "Sometimes a building with several landlords — often a copied ad. Check who holds the lease.",
      listingIds: ids,
      userIds: [...hosts],
      evidence: list.slice(0, 5).map((r) => ({ label: r.createdAt.toISOString().slice(0, 10), value: `${r.title} — ${who(r)}`, href: href(r.id) })),
      at: list[list.length - 1].createdAt,
    });
    void key;
  }

  /* 4. Rent far below the market for the same type and city. */
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    if (r.allInUsd <= 0 || r.moderation !== "approved") continue;
    const k = `${r.cityId}|${r.housingType}`;
    const list = groups.get(k) ?? [];
    list.push(r.allInUsd);
    groups.set(k, list);
  }
  for (const r of rows) {
    const peers = groups.get(`${r.cityId}|${r.housingType}`) ?? [];
    if (peers.length < 5 || r.allInUsd <= 0) continue;
    const med = medianOf(peers);
    const ratio = r.allInUsd / med;
    if (ratio >= PRICE_FLOOR) continue;
    signals.push({
      id: `price:${r.id}`,
      kind: "price",
      severity: ratio < 0.4 ? "high" : "medium",
      title: `“${r.title}” is ${Math.round((1 - ratio) * 100)}% under the market`,
      detail: `$${r.allInUsd.toLocaleString("en-US")}/mo all-in against a median of $${Math.round(med).toLocaleString("en-US")} for this type in ${r.city.name} (${peers.length} homes). The FTC's first tip for spotting a rental scam is a price far below the area.`,
      listingIds: [r.id],
      userIds: [r.hostId],
      evidence: [
        { label: "This home", value: `$${r.allInUsd.toLocaleString("en-US")}/mo`, href: href(r.id) },
        { label: "Market median", value: `$${Math.round(med).toLocaleString("en-US")}/mo` },
        { label: "Host", value: who(r) },
      ],
      at: r.createdAt,
    });
  }

  /* 5. Scam wording inside the listing itself. */
  for (const r of rows) {
    const hits = scanMessage(`${r.title}\n${r.description}`);
    if (!hits.length) continue;
    signals.push({
      id: `wording:${r.id}`,
      kind: "wording",
      severity: hits.some((h) => h.key === "untraceable-payment" || h.key === "pay-before-viewing") ? "high" : "medium",
      title: `“${r.title}” asks for money in a risky way`,
      detail: hits.map((h) => h.label).join(" · "),
      listingIds: [r.id],
      userIds: [r.hostId],
      evidence: [{ label: "Listing", value: r.title, href: href(r.id) }, ...hits.map((h) => ({ label: "Signal", value: `${h.label} — ${h.advice}` }))],
      at: r.createdAt,
    });
  }

  /* 6. New accounts moving fast. */
  const perHost = new Map<string, Row[]>();
  for (const r of rows) {
    const list = perHost.get(r.hostId) ?? [];
    list.push(r);
    perHost.set(r.hostId, list);
  }
  for (const [hostId, list] of perHost) {
    const host = list[0].host;
    if (host.role === "admin" || host.role === "staff") continue;
    if (t - host.createdAt.getTime() > 7 * DAY || list.length < 3) continue;
    signals.push({
      id: `velocity:${hostId}:${list.length}`,
      kind: "velocity",
      severity: list.length >= 6 ? "high" : "medium",
      title: `${host.name} posted ${list.length} listings in their first week`,
      detail: "Real hosts do this too — check identity status and whether the homes look alike.",
      listingIds: list.map((r) => r.id),
      userIds: [hostId],
      evidence: [{ label: "Account created", value: host.createdAt.toISOString().slice(0, 10), href: `/admin/accounts?q=${encodeURIComponent(host.email)}` }, ...list.slice(0, 4).map((r) => ({ label: r.city.name, value: r.title, href: href(r.id) }))],
      at: list[list.length - 1].createdAt,
    });
  }

  /* 7. Messages the scam guard flagged, grouped by sender (14 days). */
  const flagged = await prisma.message.findMany({
    where: { createdAt: { gte: new Date(t - 14 * DAY) }, NOT: { flags: "[]" } },
    select: { id: true, body: true, flags: true, createdAt: true, sender: { select: { id: true, name: true, email: true, role: true } }, conversationId: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const bySender = new Map<string, typeof flagged>();
  for (const m of flagged) {
    if (m.sender.role === "admin" || m.sender.role === "staff") continue;
    const list = bySender.get(m.sender.id) ?? [];
    list.push(m);
    bySender.set(m.sender.id, list);
  }
  for (const [senderId, list] of bySender) {
    const threads = new Set(list.map((m) => m.conversationId)).size;
    const labels = [...new Set(list.flatMap((m) => signalsFromFlags(m.flags).map((s) => s.label)))];
    signals.push({
      id: `messages:${senderId}:${list.length}`,
      kind: "messages",
      severity: threads >= 3 || labels.length >= 2 ? "high" : "medium",
      title: `${list[0].sender.name} sent ${list.length} flagged message${list.length === 1 ? "" : "s"} in ${threads} conversation${threads === 1 ? "" : "s"}`,
      detail: labels.join(" · "),
      listingIds: [],
      userIds: [senderId],
      evidence: list.slice(0, 3).map((m) => ({ label: m.createdAt.toISOString().slice(0, 16).replace("T", " "), value: m.body.slice(0, 200) })),
      at: list[0].createdAt,
    });
  }

  /* 8. Accounts or listings reported more than once (open reports). */
  const reports = await prisma.report.findMany({ where: { status: "open" }, select: { listingId: true, subjectUserId: true, reason: true, createdAt: true } });
  const reportCount = new Map<string, { n: number; reasons: Set<string>; at: Date; listingId?: string; userId?: string }>();
  for (const rep of reports) {
    const key = rep.listingId ? `l:${rep.listingId}` : rep.subjectUserId ? `u:${rep.subjectUserId}` : "";
    if (!key) continue;
    const cur = reportCount.get(key) ?? { n: 0, reasons: new Set<string>(), at: rep.createdAt, listingId: rep.listingId ?? undefined, userId: rep.subjectUserId ?? undefined };
    cur.n += 1;
    cur.reasons.add(rep.reason);
    if (rep.createdAt > cur.at) cur.at = rep.createdAt;
    reportCount.set(key, cur);
  }
  for (const [key, v] of reportCount) {
    if (v.n < 2) continue;
    const listing = v.listingId ? byId.get(v.listingId) : undefined;
    signals.push({
      id: `reports:${key}:${v.n}`,
      kind: "reports",
      severity: v.reasons.has("scam") ? "high" : "medium",
      title: listing ? `“${listing.title}” has ${v.n} open reports` : `An account has ${v.n} open reports`,
      detail: [...v.reasons].join(" · "),
      listingIds: v.listingId ? [v.listingId] : [],
      userIds: listing ? [listing.hostId] : v.userId ? [v.userId] : [],
      evidence: [{ label: "Reports", value: `${v.n} open`, href: "/admin/reports" }],
      at: v.at,
    });
  }

  const dismissed = new Set((await prisma.trustDismissal.findMany({ select: { signal: true } })).map((d) => d.signal));
  const allUsers = [...new Set(signals.flatMap((s) => s.userIds))];
  const users = allUsers.length ? await prisma.user.findMany({ where: { id: { in: allUsers } }, select: { id: true, name: true, email: true, createdAt: true } }) : [];
  for (const s of signals) {
    s.people = s.userIds
      .map((id) => users.find((u) => u.id === id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((u) => ({ id: u.id, name: `${u.name} (${u.email})`, since: u.createdAt.toISOString().slice(0, 10) }));
    s.homes = s.listingIds
      .map((id) => byId.get(id))
      .filter((r): r is Row => Boolean(r))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => ({ id: r.id, title: r.title, posted: r.createdAt.toISOString().slice(0, 10) }));
  }
  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return {
    signals: signals.filter((s) => !dismissed.has(s.id)).sort((a, b) => rank[a.severity] - rank[b.severity] || b.at.getTime() - a.at.getTime()),
    scanned: rows.length,
    samplesSkipped,
  };
}
