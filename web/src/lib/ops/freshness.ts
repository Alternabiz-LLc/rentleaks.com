/**
 * Freshness Check: "Is this home still available?"
 *
 * Weekly, hosts of live listings not confirmed in two weeks get one email with
 * a one-tap answer per home. No answer within a week pauses the listing (it
 * comes back with one tap). Example listings are never touched.
 */
import { liveListingWhere } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { sampleCatalogIds } from "@/lib/sample-catalog";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { appUrl } from "@/lib/site";
import { sendMail } from "@/lib/v1/mail";
import { ANSWER_DAYS, FRESH_DAYS, freshnessOf } from "./catalogue";
import { freshnessLink, type FreshAnswer } from "./links";

const DAY = 86_400_000;

export async function freshnessOn() {
  return (await getSetting(SETTING_KEYS.freshness, "on")) !== "off";
}

async function samples() {
  try {
    return await sampleCatalogIds();
  } catch {
    return null;
  }
}

/**
 * Asks hosts about the given listings (or every listing that is due).
 * One email per host. Returns how many listings were asked about.
 */
export async function askFreshness(opts: { ids?: string[]; now?: Date; limit?: number } = {}) {
  const now = opts.now ?? new Date();
  const sample = await samples();
  if (!sample) return 0;
  const live = await liveListingWhere();
  const cutoff = new Date(now.getTime() - FRESH_DAYS * DAY);
  const rows = await prisma.listing.findMany({
    where: {
      AND: [
        live,
        opts.ids
          ? { id: { in: opts.ids } }
          : {
              AND: [
                { OR: [{ confirmedAt: null }, { confirmedAt: { lt: cutoff } }] },
                { postedAt: { lt: cutoff } },
                { OR: [{ freshnessAskedAt: null }, { freshnessAskedAt: { lt: new Date(now.getTime() - ANSWER_DAYS * DAY) } }] },
              ],
            },
      ],
    },
    select: { id: true, title: true, neighborhood: true, hostId: true, host: { select: { name: true, email: true, suspendedAt: true } }, confirmedAt: true, postedAt: true },
    take: opts.limit ?? 300,
  });
  const due = rows.filter((r) => !sample.has(r.id) && !r.host.suspendedAt);
  const byHost = new Map<string, typeof due>();
  for (const r of due) byHost.set(r.hostId, [...(byHost.get(r.hostId) ?? []), r]);
  let asked = 0;
  for (const list of byHost.values()) {
    const host = list[0].host;
    const lines = list.map(
      (r) =>
        `• ${r.title} (${r.neighborhood})\n  Still available: ${freshnessLink(r.id, "available")}\n  Rented — take it down: ${freshnessLink(r.id, "rented")}\n  Pause for now: ${freshnessLink(r.id, "pause")}`,
    );
    const mail = await sendMail({
      to: host.email,
      subject: list.length === 1 ? `Is “${list[0].title}” still available?` : `Are your ${list.length} RentLeaks homes still available?`,
      text:
        `Hi ${host.name.split(/\s+/)[0] || "there"},\n\nRenters only see homes we know are available. One tap per home:\n\n${lines.join("\n\n")}\n\n` +
        `If we don't hear back within ${ANSWER_DAYS} days we pause the listing — you can switch it back on from the same link or from ${appUrl().replace(/\/$/, "")}/account.\n\nThank you,\nRentLeaks`,
    });
    if (mail.delivered || mail.transport === "console") {
      await prisma.listing.updateMany({ where: { id: { in: list.map((r) => r.id) } }, data: { freshnessAskedAt: now } });
      asked += list.length;
    }
  }
  return asked;
}

/** Pauses listings whose host never answered (cron). */
export async function pauseSilent(now = new Date()) {
  const sample = await samples();
  if (!sample) return 0;
  const rows = await prisma.listing.findMany({
    where: { status: { not: "paused" }, freshnessAskedAt: { lt: new Date(now.getTime() - ANSWER_DAYS * DAY) } },
    select: { id: true, title: true, postedAt: true, confirmedAt: true, freshnessAskedAt: true, updatedAt: true, host: { select: { name: true, email: true } } },
    take: 200,
  });
  const silent = rows.filter((r) => !sample.has(r.id) && freshnessOf(r, now.getTime()).state === "silent");
  for (const r of silent) {
    await prisma.listing.update({ where: { id: r.id }, data: { status: "paused" } });
    await prisma.adminAction
      .create({ data: { actorId: "system", action: "listing.freshness.paused", targetType: "listing", targetId: r.id, detail: { askedAt: r.freshnessAskedAt } } })
      .catch(() => undefined);
    await sendMail({
      to: r.host.email,
      subject: `We paused “${r.title}”`,
      text: `Hi ${r.host.name.split(/\s+/)[0] || "there"},\n\nWe didn't hear whether “${r.title}” is still available, so it's hidden from renters for now.\n\nStill available? One tap brings it back:\n${freshnessLink(r.id, "available")}\n\nRentLeaks`,
    }).catch(() => undefined);
  }
  return silent.length;
}

/** Applies a host's answer. `available` also brings back a listing we paused. */
export async function applyFreshAnswer(listingId: string, answer: FreshAnswer, now = new Date()) {
  const l = await prisma.listing.findUnique({ where: { id: listingId }, select: { id: true, title: true, status: true, moderation: true } });
  if (!l) return null;
  const status = answer === "available" ? (l.moderation === "approved" && l.status === "paused" ? "active" : l.status) : "paused";
  await prisma.listing.update({ where: { id: l.id }, data: { confirmedAt: now, status, freshnessAskedAt: null } });
  await prisma.adminAction
    .create({ data: { actorId: "host", action: `listing.freshness.${answer}`, targetType: "listing", targetId: l.id } })
    .catch(() => undefined);
  return { title: l.title, status };
}
