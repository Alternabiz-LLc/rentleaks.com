import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/access";
import { staffForRoute } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

type Hit = { kind: "lead" | "contact" | "listing" | "account" | "request" | "engagement" | "property"; id: string; title: string; sub: string; href: string };

/**
 * Record search for the desk's ⌘K palette: leads, contacts, listings and
 * accounts by name, email or id. Desk accounts only, and only the record types
 * their access includes; anyone else gets a 404 so the endpoint does not
 * advertise itself.
 */
export async function GET(req: Request) {
  const user = await staffForRoute("any");
  if (!user) return new Response("Not found", { status: 404 });
  const can = {
    leads: canAccess(user, "leads"),
    crm: canAccess(user, "crm"),
    listings: canAccess(user, "listings"),
    accounts: canAccess(user, "accounts"),
    enterprise: canAccess(user, "enterprise"),
  };
  const none = Promise.resolve([] as never[]);
  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ hits: [] });
  const has = { contains: q, mode: "insensitive" as const };

  const [leads, contacts, listings, accounts, requests, engagements, properties] = await Promise.all([
    !can.leads ? none : prisma.lead
      .findMany({
        where: { OR: [{ name: has }, { email: has }, { phone: { contains: q } }, { id: q }] },
        select: { id: true, name: true, email: true, status: true, kind: true },
        orderBy: { createdAt: "desc" },
        take: 6,
      })
      .catch(() => []),
    !can.crm ? none : prisma.contact
      .findMany({
        where: { OR: [{ name: has }, { email: has }, { company: has }, { phone: { contains: q } }] },
        select: { id: true, name: true, email: true, stage: true, kind: true },
        orderBy: { updatedAt: "desc" },
        take: 6,
      })
      .catch(() => []),
    !can.listings ? none : prisma.listing
      .findMany({
        where: { OR: [{ title: has }, { id: has }, { neighborhood: has }] },
        select: { id: true, title: true, moderation: true, city: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 6,
      })
      .catch(() => []),
    !can.accounts ? none : prisma.user
      .findMany({
        where: { OR: [{ name: has }, { email: has }] },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
      .catch(() => []),
    !can.enterprise ? none : prisma.serviceRequest
      .findMany({
        where: { status: { not: "spam" }, OR: [{ name: has }, { email: has }, { company: has }, { address: has }, { market: has }] },
        select: { id: true, name: true, company: true, status: true, units: true, market: true },
        orderBy: { createdAt: "desc" },
        take: 4,
      })
      .catch(() => []),
    !can.enterprise ? none : prisma.engagement
      .findMany({
        where: { OR: [{ title: has }, { clientName: has }, { clientEmail: has }, { clientCompany: has }, { address: has }] },
        select: { id: true, title: true, status: true, clientEmail: true },
        orderBy: { updatedAt: "desc" },
        take: 4,
      })
      .catch(() => []),
    !can.enterprise ? none : prisma.managedProperty
      .findMany({
        where: { OR: [{ name: has }, { address: has }, { ownerName: has }, { ownerEmail: has }] },
        select: { id: true, name: true, units: true, status: true, ownerName: true },
        orderBy: { updatedAt: "desc" },
        take: 4,
      })
      .catch(() => []),
  ]);

  const hits: Hit[] = [
    ...leads.map((l) => ({
      kind: "lead" as const,
      id: l.id,
      title: l.name || l.email,
      sub: `${l.status} · ${l.kind} · ${l.email}`,
      href: `/admin/leads?open=${l.id}`,
    })),
    ...contacts.map((c) => ({
      kind: "contact" as const,
      id: c.id,
      title: c.name || c.email,
      sub: `${c.stage} · ${c.kind} · ${c.email}`,
      href: `/admin/crm/${c.id}`,
    })),
    ...listings.map((l) => ({
      kind: "listing" as const,
      id: l.id,
      title: l.title,
      sub: `${l.city.name} · ${l.moderation}`,
      href: `/admin/listings?q=${encodeURIComponent(l.id)}`,
    })),
    ...accounts.map((u) => ({
      kind: "account" as const,
      id: u.id,
      title: u.name || u.email,
      sub: `${u.role} · ${u.email}`,
      href: `/admin/accounts/${u.id}`,
    })),
    ...requests.map((r) => ({
      kind: "request" as const,
      id: r.id,
      title: r.company || r.name,
      sub: `${r.status}${r.units ? ` · ${r.units} units` : ""}${r.market ? ` · ${r.market}` : ""}`,
      href: `/admin/enterprise?open=${r.id}`,
    })),
    ...engagements.map((e) => ({
      kind: "engagement" as const,
      id: e.id,
      title: e.title,
      sub: `${e.status} · ${e.clientEmail}`,
      href: `/admin/enterprise?tab=engagements&eng=${e.id}`,
    })),
    ...properties.map((p) => ({
      kind: "property" as const,
      id: p.id,
      title: p.name,
      sub: `${p.status} · ${p.units} units · ${p.ownerName}`,
      href: `/admin/enterprise?tab=portfolio&prop=${p.id}`,
    })),
  ];
  return Response.json({ hits });
}
