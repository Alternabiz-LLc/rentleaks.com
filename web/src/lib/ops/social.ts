/**
 * The social publisher, called by the five-minute cron.
 *
 * It takes scheduled posts whose time has come and publishes the ones whose
 * channel can publish on its own. A channel without credentials is left alone
 * on purpose: those posts stay "scheduled", the desk shows them as "due — post
 * it now", and nothing is silently dropped or silently faked.
 *
 * Deliberately small per tick. A daily feed only ever has one post due, and a
 * cap means a bad backlog can't turn into a burst that trips a rate limit or
 * dumps a week of posts in one minute.
 */
import { prisma } from "@/lib/prisma";
import { canAutoPublish, publishPost } from "@/lib/social";

/** Most posts to publish in a single five-minute tick. */
export const MAX_PER_TICK = 3;

/** A post older than this was missed while something was broken; publishing it
 *  days late is worse than leaving it for a person to decide about. */
export const STALE_HOURS = 36;

export type SocialRun = {
  published: number;
  failed: number;
  manual: number;
  stale: number;
};

export async function publishDueSocial(now = new Date()): Promise<SocialRun> {
  const out: SocialRun = { published: 0, failed: 0, manual: 0, stale: 0 };
  const due = await prisma.socialPost.findMany({
    where: { status: "scheduled", scheduledAt: { lte: now } },
    orderBy: { scheduledAt: "asc" },
    take: 25,
  });
  if (!due.length) return out;

  const staleBefore = new Date(now.getTime() - STALE_HOURS * 3_600_000);
  for (const post of due) {
    if (!canAutoPublish(post.channel)) {
      out.manual += 1;
      continue;
    }
    if (post.scheduledAt && post.scheduledAt < staleBefore) {
      out.stale += 1;
      continue;
    }
    if (out.published + out.failed >= MAX_PER_TICK) break;

    const res = await publishPost(post.channel, { body: post.body, imageUrl: post.imageUrl, link: post.link });
    if (res.ok) {
      out.published += 1;
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: "published", publishedAt: now, externalId: res.id, error: null },
      });
    } else {
      out.failed += 1;
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: "failed", error: res.error.slice(0, 400) },
      });
    }
  }
  return out;
}
