/**
 * Loads the Instagram launch feed into the publishing queue — 20 posts, one a
 * day, starting tomorrow.
 *
 *   npm run ig:queue                  # 20 posts, one a day at 15:00 UTC
 *   npm run ig:queue -- --hour 13     # a different hour
 *   npm run ig:queue -- --start 2026-10-01
 *   npm run ig:queue -- --dry         # print the plan, write nothing
 *
 * Reads ../tools/social/ig-queue.json, which tools/build-ig-feed.py writes from
 * tools/social/ig-posts.json. Re-running is safe: a post is matched by its
 * batch tag and id, so an existing row is updated rather than duplicated, and a
 * post that has already gone out is left alone.
 *
 * The rows are ordinary SocialPost rows on the instagram channel. If Instagram
 * publishing is configured the cron sends them; if it isn't, they show up in
 * Admin → Social as due, to post by hand. Either way the desk is the record.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const BATCH = "ig-launch-20";
const QUEUE = join(process.cwd(), "..", "tools", "social", "ig-queue.json");

type Entry = { day: number; id: string; image: string; link: string; caption: string };

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
}

async function main() {
  const dry = process.argv.includes("--dry");
  const hour = Number(arg("hour", "15"));
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error("--hour must be 0–23 (UTC).");

  const startArg = arg("start");
  const start = startArg ? new Date(`${startArg}T00:00:00Z`) : new Date(Date.now() + 86_400_000);
  if (Number.isNaN(start.getTime())) throw new Error("--start must be a date like 2026-10-01.");
  start.setUTCHours(hour, 0, 0, 0);

  const entries: Entry[] = JSON.parse(readFileSync(QUEUE, "utf8"));
  if (!entries.length) throw new Error(`${QUEUE} is empty — run tools/build-ig-feed.py first.`);

  const plan = entries.map((e) => {
    const at = new Date(start.getTime() + (e.day - 1) * 86_400_000);
    return { e, at, line: `day ${String(e.day).padStart(2, "0")}  ${at.toISOString().slice(0, 16).replace("T", " ")}  ${e.id}` };
  });

  /* --dry answers "what would this do" and must not need a database for it. */
  if (dry) {
    for (const p of plan) console.log(p.line);
    console.log(`\n${plan.length} posts planned, nothing written (--dry).`);
    return;
  }

  const prisma = new PrismaClient();
  let created = 0;
  let updated = 0;
  let left = 0;
  try {
    for (const { e, at, line } of plan) {
      const existing = await prisma.socialPost.findFirst({ where: { batch: BATCH, link: e.link, body: e.caption } });
      if (existing?.status === "published" || existing?.status === "manual") {
        left += 1;
        continue;
      }
      const data = {
        channel: "instagram",
        body: e.caption,
        imageUrl: e.image,
        link: e.link,
        status: "scheduled",
        scheduledAt: at,
        batch: BATCH,
        error: null,
      };
      if (existing) {
        await prisma.socialPost.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await prisma.socialPost.create({ data });
        created += 1;
      }
      console.log(line);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n${created} scheduled, ${updated} updated, ${left} already out.`);
  console.log("Admin → Social → Queue shows them. Publishing needs IG_USER_ID and a token;");
  console.log("without those they come up as 'due — post it now' instead.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
