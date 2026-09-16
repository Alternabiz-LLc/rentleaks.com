/**
 * The outbox: everything that goes out on a schedule.
 *
 * Run every five minutes by the Worker cron (worker.ts → /api/cron/outbox)
 * and on demand from the admin ("Send next batch now"). Each run:
 *   1. starts campaigns whose scheduled time has come (freezing recipients);
 *   2. sends the next batch of queued campaign emails, paced for the
 *      provider's rate limit;
 *   3. publishes due social posts that can be published automatically;
 *   4. expires old trial invites.
 *
 * Everything is idempotent: a run that dies half-way leaves rows `queued`,
 * and the next run carries on.
 */
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/crm";
import {
  audienceWhere,
  coerceAudience,
  mergeFields,
  renderEmail,
  unsubscribeHeaders,
  unsubscribeToken,
} from "@/lib/marketing";
import { getSettings, setSetting, SETTING_KEYS } from "@/lib/settings";
import { appUrl } from "@/lib/site";
import { canAutoPublish, publishToFacebook } from "@/lib/social";
import { sendMail } from "@/lib/v1/mail";

const PACE_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const CAMPAIGN_REASON: Record<string, string> = {
  newsletter: "You're receiving this because you subscribed to RentLeaks updates.",
  bulk: "You're receiving this because you have a RentLeaks account or contacted RentLeaks about a home.",
  outreach: "You're receiving this because we think RentLeaks can help your rental business.",
};

export async function mailingAddress() {
  const s = await getSettings([SETTING_KEYS.mailingAddress]);
  return (s[SETTING_KEYS.mailingAddress] || "").trim();
}

/** Freezes the audience into CampaignSend rows and marks the campaign sending. */
export async function startCampaign(campaignId: string): Promise<{ ok: true; total: number } | { ok: false; error: string }> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { ok: false, error: "That campaign no longer exists." };
  if (!["draft", "scheduled"].includes(campaign.status)) return { ok: false, error: `The campaign is already ${campaign.status}.` };
  if (!(await mailingAddress())) {
    return { ok: false, error: "Add your business mailing address in Admin → System first. The law requires it in every marketing email." };
  }
  const audience = coerceAudience(campaign.audience, campaign.kind);
  const [contacts, suppressed] = await Promise.all([
    prisma.contact.findMany({ where: audienceWhere(audience), select: { id: true, email: true, name: true }, take: 50_000 }),
    prisma.emailSuppression.findMany({ select: { email: true } }),
  ]);
  const blocked = new Set(suppressed.map((s) => s.email));
  const rows = contacts
    .filter((c) => !blocked.has(c.email))
    .map((c) => ({ campaignId, contactId: c.id, email: c.email, name: c.name }));
  if (!rows.length) return { ok: false, error: "Nobody matches this audience yet." };
  for (let i = 0; i < rows.length; i += 1000) {
    await prisma.campaignSend.createMany({ data: rows.slice(i, i + 1000), skipDuplicates: true });
  }
  const total = await prisma.campaignSend.count({ where: { campaignId } });
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "sending", startedAt: new Date(), total },
  });
  return { ok: true, total };
}

async function finishIfDone(campaignId: string) {
  const [queued, sent, failed] = await Promise.all([
    prisma.campaignSend.count({ where: { campaignId, status: "queued" } }),
    prisma.campaignSend.count({ where: { campaignId, status: "sent" } }),
    prisma.campaignSend.count({ where: { campaignId, status: "failed" } }),
  ]);
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { sent, failed, ...(queued === 0 ? { status: "sent", finishedAt: new Date() } : {}) },
  });
  return queued;
}

/** Sends up to `limit` queued emails across sending campaigns. */
export async function sendCampaignBatch(limit = 40, onlyCampaignId?: string) {
  const address = await mailingAddress();
  const campaigns = await prisma.campaign.findMany({
    where: { status: "sending", ...(onlyCampaignId ? { id: onlyCampaignId } : {}) },
    orderBy: { startedAt: "asc" },
  });
  if (!campaigns.length) return { sent: 0, failed: 0, skipped: 0, remaining: 0 };
  const cities = new Map((await prisma.city.findMany({ select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  const base = appUrl();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let remaining = 0;

  for (const campaign of campaigns) {
    if (sent + failed + skipped >= limit) break;
    const batch = await prisma.campaignSend.findMany({
      where: { campaignId: campaign.id, status: "queued" },
      include: { contact: { select: { id: true, unsubscribedAt: true, cityId: true, name: true } } },
      orderBy: { createdAt: "asc" },
      take: limit - (sent + failed + skipped),
    });
    const emails = batch.map((b) => b.email);
    const suppressed = new Set(
      (await prisma.emailSuppression.findMany({ where: { email: { in: emails } }, select: { email: true } })).map((s) => s.email),
    );

    for (const row of batch) {
      if (suppressed.has(row.email) || row.contact?.unsubscribedAt) {
        await prisma.campaignSend.update({ where: { id: row.id }, data: { status: "skipped", error: "unsubscribed" } });
        skipped += 1;
        continue;
      }
      const token = unsubscribeToken(row.email);
      const pageUrl = `${base}/u/${token}`;
      const data = {
        name: row.contact?.name || row.name,
        email: row.email,
        city: row.contact?.cityId ? cities.get(row.contact.cityId) : undefined,
        app_url: base,
        unsubscribe_link: pageUrl,
      };
      const { text, html } = renderEmail(mergeFields(campaign.body, data), {
        address: address || "RentLeaks",
        reason: CAMPAIGN_REASON[campaign.kind] || CAMPAIGN_REASON.bulk,
        unsubscribeUrl: pageUrl,
      });
      const result = await sendMail({
        to: row.email,
        subject: mergeFields(campaign.subject, data),
        text,
        html,
        purpose: "bulk",
        headers: unsubscribeHeaders(`${base}/api/unsubscribe?t=${encodeURIComponent(token)}`),
      });
      const ok = result.delivered || result.transport === "console";
      await prisma.campaignSend.update({
        where: { id: row.id },
        data: ok ? { status: "sent", sentAt: new Date(), error: null } : { status: "failed", error: (result.error || "not delivered").slice(0, 300) },
      });
      if (ok) {
        sent += 1;
        if (row.contact) {
          await prisma.contact.update({ where: { id: row.contact.id }, data: { lastContactedAt: new Date() } }).catch(() => undefined);
          await logActivity(row.contact.id, "campaign", `${campaign.kind}: ${campaign.name}`, "").catch(() => undefined);
        }
      } else failed += 1;
      await sleep(PACE_MS);
    }
    remaining += await finishIfDone(campaign.id);
  }
  return { sent, failed, skipped, remaining };
}

export async function publishDueSocial(limit = 5) {
  const due = await prisma.socialPost.findMany({
    where: { status: "scheduled", scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    take: 20,
  });
  let published = 0;
  let failed = 0;
  for (const post of due) {
    if (published + failed >= limit) break;
    if (!canAutoPublish(post.channel)) continue;
    const result = await publishToFacebook(post);
    await prisma.socialPost.update({
      where: { id: post.id },
      data: result.ok
        ? { status: "published", publishedAt: new Date(), externalId: result.id, error: null }
        : { status: "failed", error: result.error.slice(0, 300) },
    });
    if (result.ok) published += 1;
    else failed += 1;
  }
  return { published, failed };
}

export async function expireInvites() {
  const r = await prisma.trialInvite.updateMany({
    where: { status: { in: ["pending", "sent"] }, expiresAt: { lt: new Date() } },
    data: { status: "expired" },
  });
  return r.count;
}

export async function processOutbox(opts: { batch?: number } = {}) {
  const now = new Date();
  const due = await prisma.campaign.findMany({
    where: { status: "scheduled", scheduledAt: { lte: now } },
    select: { id: true },
  });
  const started: string[] = [];
  for (const c of due) {
    const r = await startCampaign(c.id);
    if (r.ok) started.push(c.id);
    else {
      console.error("[outbox] could not start campaign", c.id, r.error);
      await prisma.campaign.update({ where: { id: c.id }, data: { status: "draft" } }).catch(() => undefined);
    }
  }
  const email = await sendCampaignBatch(opts.batch ?? 40);
  const social = await publishDueSocial();
  const expired = await expireInvites();
  await setSetting(SETTING_KEYS.outboxHeartbeat, new Date().toISOString()).catch(() => undefined);
  return { started: started.length, email, social, expired };
}
