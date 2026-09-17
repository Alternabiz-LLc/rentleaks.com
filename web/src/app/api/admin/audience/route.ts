import { audienceWhere, CAMPAIGN_KINDS, coerceAudience, describeAudience, mergeFields, renderEmail } from "@/lib/marketing";
import { CAMPAIGN_REASON, mailingAddress } from "@/lib/outbox";
import { prisma } from "@/lib/prisma";
import { staffForRoute } from "@/lib/admin/guard";
import { appUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Live numbers for the campaign wizard: how many people an audience reaches,
 * who one of them is, and the email exactly as that person would get it.
 * Read-only; nothing is created or sent here.
 */
export async function POST(req: Request) {
  const user = await staffForRoute("campaigns");
  if (!user) return new Response("Not found", { status: 404 });
  let input: { kind?: string; audience?: unknown; subject?: string; body?: string; sampleId?: string };
  try {
    input = (await req.json()) as typeof input;
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const kind = (CAMPAIGN_KINDS as readonly string[]).includes(input.kind || "") ? (input.kind as string) : "newsletter";
  const audience = coerceAudience(input.audience, kind);
  const where = audienceWhere(audience);

  const [count, sampleRows, suppressed, address] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({ where, orderBy: { updatedAt: "desc" }, take: 8, select: { id: true, name: true, email: true, cityId: true } }),
    prisma.emailSuppression.count(),
    mailingAddress(),
  ]);
  const sample = sampleRows.find((s) => s.id === input.sampleId) ?? sampleRows[0] ?? null;
  const city = sample?.cityId ? (await prisma.city.findUnique({ where: { id: sample.cityId }, select: { name: true } }))?.name : undefined;
  const base = appUrl();
  const data = {
    name: sample?.name || user.name,
    email: sample?.email || user.email,
    city: city || "New York",
    app_url: base,
    unsubscribe_link: `${base}/u/preview`,
  };
  const subject = mergeFields(String(input.subject || "").slice(0, 200), data);
  const { html } = renderEmail(mergeFields(String(input.body || "").slice(0, 50_000), data), {
    address: address || "⚠ Add your mailing address in Admin → System before sending",
    reason: CAMPAIGN_REASON[kind] || CAMPAIGN_REASON.bulk,
    unsubscribeUrl: `${base}/u/preview`,
  });
  return Response.json({
    count,
    describe: describeAudience(audience),
    suppressed,
    hasAddress: Boolean(address),
    samples: sampleRows.map((s) => ({ id: s.id, label: `${s.name || "Unknown"} · ${s.email}` })),
    sample: sample ? { id: sample.id, name: sample.name, email: sample.email } : null,
    preview: { subject, html },
  });
}
