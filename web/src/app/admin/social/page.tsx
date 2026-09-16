import Link from "next/link";
import { bulkPosts, createPost, postAction } from "@/app/admin/_actions/social";
import { Empty, flashOf, PageHead, Pill, readParams, Section, Stats, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { canAutoPublish, CHANNEL_LABEL, facebookConfig, SOCIAL_CHANNELS } from "@/lib/social";

export const metadata = { title: "Social posts — RentLeaks admin" };

const TONE: Record<string, "" | "good" | "warn" | "bad" | "brand"> = { draft: "", scheduled: "brand", published: "good", manual: "good", failed: "bad" };

function Channels({ defaults = ["facebook"] }: { defaults?: string[] }) {
  return (
    <div className="adm-checks">
      {SOCIAL_CHANNELS.map((c) => (
        <label key={c} className="adm-check">
          <input type="checkbox" name="channels" value={c} defaultChecked={defaults.includes(c)} /> {CHANNEL_LABEL[c]}
          {canAutoPublish(c) ? " (auto)" : ""}
        </label>
      ))}
    </div>
  );
}

export default async function SocialPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage();
  const p = await readParams(searchParams);
  const now = new Date();
  const filter = p.show || "upcoming";
  const [posts, counts] = await Promise.all([
    prisma.socialPost.findMany({
      where:
        filter === "upcoming"
          ? { status: { in: ["draft", "scheduled", "failed"] } }
          : filter === "done"
            ? { status: { in: ["published", "manual"] } }
            : {},
      orderBy: filter === "done" ? [{ publishedAt: "desc" }] : [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.socialPost.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const fb = facebookConfig();
  const tomorrow9 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 16, 0)).toISOString().slice(0, 16);

  return (
    <>
      <PageHead
        title="Social posts"
        sub="Write once, schedule for several channels. Facebook Page posts publish automatically when a Page token is set; other channels come up here when due, to copy and post."
        flash={flashOf(p)}
      >
        <a className="btn btn--outline" href="https://business.facebook.com/latest/content_calendar" target="_blank" rel="noreferrer">Meta planner ↗</a>
      </PageHead>
      <Stats
        items={[
          { k: "Scheduled", v: n("scheduled") },
          { k: "Drafts", v: n("draft") },
          { k: "Posted", v: n("published") + n("manual") },
          { k: "Failed", v: n("failed") },
          { k: "Facebook auto-publish", v: fb ? "On" : "Off", s: fb ? `Page ${fb.pageId}` : "set FB_PAGE_ID + FB_PAGE_TOKEN" },
        ]}
      />

      <nav className="l-filters">
        {[
          ["upcoming", "Upcoming & drafts"],
          ["done", "Posted"],
          ["all", "All"],
        ].map(([k, label]) => (
          <Link key={k} className={`x-chip${filter === k ? " is-on" : ""}`} href={`/admin/social?show=${k}`}>{label}</Link>
        ))}
      </nav>

      <Section title="Queue">
        {posts.length === 0 ? (
          <Empty>Nothing here.</Empty>
        ) : (
          <ul className="adm-cards">
            {posts.map((post) => {
              const due = post.status === "scheduled" && post.scheduledAt && post.scheduledAt <= now;
              return (
                <li key={post.id} className="adm-card">
                  <div className="adm-card__top">
                    <div>
                      <b>{CHANNEL_LABEL[post.channel] || post.channel}</b> <Pill tone={TONE[post.status]}>{post.status}</Pill>
                      {due && !canAutoPublish(post.channel) ? <Pill tone="warn">due — post it now</Pill> : null}
                      <span className="a-dim"> {post.scheduledAt ? `for ${when(post.scheduledAt)} UTC` : ""}{post.publishedAt ? ` · posted ${when(post.publishedAt)}` : ""}</span>
                    </div>
                  </div>
                  <textarea className="adm-copy" readOnly rows={Math.min(8, post.body.split("\n").length + 1)} defaultValue={post.link ? `${post.body}\n\n${post.link}` : post.body} />
                  {post.imageUrl ? <p className="a-dim">Image: <a href={post.imageUrl} target="_blank" rel="noreferrer">{post.imageUrl}</a></p> : null}
                  {post.error ? <p className="a-bad">{post.error}</p> : null}
                  {post.status !== "published" && post.status !== "manual" ? (
                    <form action={postAction} className="adm-actions">
                      <input type="hidden" name="id" value={post.id} />
                      {post.channel === "facebook" && fb ? <button className="btn btn--primary" name="op" value="publish">Publish now</button> : null}
                      <button className="btn btn--outline" name="op" value="manual">Mark posted</button>
                      <input name="at" type="datetime-local" defaultValue={(post.scheduledAt ?? new Date(tomorrow9)).toISOString().slice(0, 16)} aria-label="Schedule for (UTC)" />
                      <button className="btn btn--outline" name="op" value="schedule">{post.status === "scheduled" ? "Reschedule" : "Schedule"}</button>
                      {post.status === "scheduled" ? <button className="btn btn--ghost" name="op" value="unschedule">Unschedule</button> : null}
                      <button className="btn btn--ghost" name="op" value="delete">Delete</button>
                    </form>
                  ) : post.externalId ? (
                    <p className="a-dim">Facebook post id {post.externalId}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <div className="a-cols">
        <Section title="New post">
          <form action={createPost} className="adm-form">
            <Channels />
            <label>Text<textarea name="body" rows={6} required placeholder="Rooms from $900 all-in in Brooklyn this month…" /></label>
            <div className="adm-row">
              <label>Image URL (https)<input name="imageUrl" placeholder="https://rentleaks.com/images/facebook/rooms.png" /></label>
              <label>Link<input name="link" placeholder="https://rentleaks.com/facebook.html?src=fb_post" /></label>
            </div>
            <label>Schedule (UTC, leave empty for a draft)<input name="at" type="datetime-local" /></label>
            <button className="btn btn--primary">Save</button>
          </form>
        </Section>

        <Section title="Bulk schedule" sub="Paste many posts separated by a line containing only ---. Optional lines inside a post: image: https://… and link: https://…">
          <form action={bulkPosts} className="adm-form">
            <Channels />
            <label>
              Posts
              <textarea
                name="posts"
                rows={10}
                required
                placeholder={"Rooms in Brooklyn from $900 all-in.\nimage: https://rentleaks.com/images/facebook/rooms.png\nlink: https://rentleaks.com/facebook.html?src=fb_post\n---\nCo-living: furnished, bills in, 1 month minimum.\n---\nLease-breaks: take over a lease for 3–10 months."}
              />
            </label>
            <div className="adm-row">
              <label>First post at (UTC)<input name="start" type="datetime-local" defaultValue={tomorrow9} required /></label>
              <label>Then every (hours)<input name="every" type="number" min={1} defaultValue={24} className="adm-num" /></label>
            </div>
            <button className="btn btn--primary">Schedule all</button>
          </form>
        </Section>
      </div>
    </>
  );
}
