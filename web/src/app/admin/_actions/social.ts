"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { audit, requireAdminAction } from "@/lib/admin/guard";
import { back, field, fields, returnTo } from "@/lib/admin/flash";
import { prisma } from "@/lib/prisma";
import { CHANNEL_LIMIT, parsePostBlock, publishToFacebook, SOCIAL_CHANNELS, splitBulkPosts, spreadSchedule } from "@/lib/social";

const BASE = "/admin/social";
const httpsOrNull = (v: string) => (/^https:\/\/\S+$/.test(v) ? v : null);

function channelsOf(fd: FormData) {
  return fields(fd, "channels").filter((c) => (SOCIAL_CHANNELS as readonly string[]).includes(c));
}

export async function createPost(fd: FormData) {
  const path = returnTo(fd, BASE);
  const guard = await requireAdminAction("social");
  if (!guard.ok) back(path, "err", guard.error);
  const channels = channelsOf(fd);
  const body = field(fd, "body", 63_000);
  if (!channels.length) back(path, "err", "Pick at least one channel.");
  if (!body) back(path, "err", "Write the post first.");
  const tooLong = channels.filter((c) => body.length > (CHANNEL_LIMIT[c] ?? 63_000));
  if (tooLong.length) back(path, "err", `Too long for ${tooLong.join(", ")} (${body.length} characters).`);
  const at = field(fd, "at");
  const scheduledAt = at ? new Date(at) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) back(path, "err", "That date isn't valid.");
  const batch = randomBytes(4).toString("hex");
  await prisma.socialPost.createMany({
    data: channels.map((channel) => ({
      channel,
      body,
      imageUrl: httpsOrNull(field(fd, "imageUrl", 500)),
      link: httpsOrNull(field(fd, "link", 500)),
      status: scheduledAt ? "scheduled" : "draft",
      scheduledAt,
      batch,
    })),
  });
  await audit(guard.user.id, "social.create", "social", batch, { channels, scheduled: Boolean(scheduledAt) });
  revalidatePath(BASE);
  back(path, "ok", `${channels.length} post${channels.length === 1 ? "" : "s"} ${scheduledAt ? "scheduled" : "saved as drafts"}.`);
}

export async function bulkPosts(fd: FormData) {
  const path = returnTo(fd, BASE);
  const guard = await requireAdminAction("social");
  if (!guard.ok) back(path, "err", guard.error);
  const channels = channelsOf(fd);
  const blocks = splitBulkPosts(field(fd, "posts", 200_000)).map(parsePostBlock).filter((b) => b.body);
  if (!channels.length) back(path, "err", "Pick at least one channel.");
  if (!blocks.length) back(path, "err", "Paste posts separated by a line with ---.");
  const start = new Date(field(fd, "start"));
  if (Number.isNaN(start.getTime())) back(path, "err", "Pick a start date and time.");
  const every = Math.max(1, Number(field(fd, "every")) || 24);
  const times = spreadSchedule(start, blocks.length, every);
  const batch = randomBytes(4).toString("hex");
  const rows = blocks.flatMap((b, i) =>
    channels.map((channel) => ({ channel, body: b.body, imageUrl: b.imageUrl, link: b.link, status: "scheduled", scheduledAt: times[i], batch })),
  );
  await prisma.socialPost.createMany({ data: rows });
  await audit(guard.user.id, "social.bulk", "social", batch, { posts: blocks.length, channels });
  revalidatePath(BASE);
  back(path, "ok", `Scheduled ${blocks.length} posts × ${channels.length} channel${channels.length === 1 ? "" : "s"}, every ${every}h from ${start.toISOString().slice(0, 16).replace("T", " ")} UTC.`);
}

export async function postAction(fd: FormData) {
  const path = returnTo(fd, BASE);
  const guard = await requireAdminAction("social");
  if (!guard.ok) back(path, "err", guard.error);
  const id = field(fd, "id", 60);
  const op = field(fd, "op");
  const post = await prisma.socialPost.findUnique({ where: { id } });
  if (!post) back(path, "err", "That post no longer exists.");
  if (op === "publish") {
    if (post.channel !== "facebook") back(path, "err", "Only Facebook Page posts publish automatically. Post it yourself, then mark it posted.");
    const r = await publishToFacebook(post);
    await prisma.socialPost.update({
      where: { id },
      data: r.ok ? { status: "published", publishedAt: new Date(), externalId: r.id, error: null } : { status: "failed", error: r.error.slice(0, 300) },
    });
    await audit(guard.user.id, "social.publish", "social", id, { ok: r.ok });
    back(path, r.ok ? "ok" : "err", r.ok ? "Published to the Facebook Page." : `Facebook said: ${r.error}`);
  }
  if (op === "manual") {
    await prisma.socialPost.update({ where: { id }, data: { status: "manual", publishedAt: new Date(), error: null } });
  } else if (op === "delete") {
    await prisma.socialPost.delete({ where: { id } });
  } else if (op === "unschedule") {
    await prisma.socialPost.update({ where: { id }, data: { status: "draft", scheduledAt: null } });
  } else if (op === "schedule") {
    const at = new Date(field(fd, "at"));
    if (Number.isNaN(at.getTime())) back(path, "err", "Pick a date and time.");
    await prisma.socialPost.update({ where: { id }, data: { status: "scheduled", scheduledAt: at, error: null } });
  } else back(path, "err", "Unknown action.");
  await audit(guard.user.id, `social.${op}`, "social", id);
  revalidatePath(BASE);
  back(path, "ok", "Done.");
}
