import Link from "next/link";
import { bulkPosts, createPost, postAction } from "@/app/admin/_actions/social";
import { Columns, Kpi } from "@/components/admin/desk/charts";
import { DeskHeader } from "@/components/admin/desk/DeskHeader";
import { Icon } from "@/components/admin/desk/Icon";
import { Chip, CommandRail, Empty, Panel, ViewSwitch } from "@/components/admin/desk/parts";
import { flashOf, qs, readParams, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/metrics";
import { prisma } from "@/lib/prisma";
import { canAutoPublish, CHANNEL_LABEL, CHANNEL_LIMIT, facebookConfig, SOCIAL_CHANNELS } from "@/lib/social";

export const metadata = { title: "Social posts — RentLeaks desk" };

const DAY = 86_400_000;
const TABS = ["overview", "compose", "queue", "library", "calendar", "channels"] as const;
type Tab = (typeof TABS)[number];

const TONE: Record<string, "" | "good" | "warn" | "bad" | "brand"> = { draft: "", scheduled: "brand", published: "good", manual: "good", failed: "bad" };

/** Brand-neutral channel marks: a coloured tile with the channel's initial. */
const MARK: Record<string, { bg: string; letter: string }> = {
  facebook: { bg: "#1f4fbf", letter: "f" },
  instagram: { bg: "linear-gradient(135deg,#d0417a,#e8913c)", letter: "IG" },
  linkedin: { bg: "#1d5f99", letter: "in" },
  x: { bg: "#18181b", letter: "X" },
  tiktok: { bg: "#111827", letter: "TT" },
  threads: { bg: "#27272a", letter: "@" },
};

function Mark({ channel }: { channel: string }) {
  const m = MARK[channel] ?? { bg: "#56696f", letter: channel.slice(0, 1).toUpperCase() };
  return (
    <span className="dk-railcard__mark" style={{ background: m.bg }} aria-hidden="true">
      {m.letter}
    </span>
  );
}

function ChannelPicks({ picked }: { picked: string[] }) {
  return (
    <fieldset className="dk-fieldset dk-field--wide">
      <legend>Channels</legend>
      <div className="dk-chiprow">
        {SOCIAL_CHANNELS.map((c) => (
          <label key={c} className="dk-check" style={{ marginRight: 10 }}>
            <input type="checkbox" name="channels" value={c} defaultChecked={picked.includes(c)} /> <Mark channel={c} /> {CHANNEL_LABEL[c]}
            {canAutoPublish(c) ? <Chip tone="good">auto</Chip> : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default async function SocialPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage("/admin/social");
  const p = await readParams(searchParams);
  const t = nowMs();
  const now = new Date(t);
  const tab: Tab = (TABS as readonly string[]).includes(p.tab) ? (p.tab as Tab) : "overview";
  const channel = (SOCIAL_CHANNELS as readonly string[]).includes(p.channel) ? p.channel : "";
  const q = (p.q || "").trim();
  const fb = facebookConfig();

  const listWhere =
    tab === "library"
      ? { status: { in: ["published", "manual"] } }
      : tab === "queue"
        ? { status: { in: ["draft", "scheduled", "failed"] } }
        : {};
  const [posts, counts, byChannel, upcoming, published30] = await Promise.all([
    prisma.socialPost.findMany({
      where: {
        ...listWhere,
        ...(channel ? { channel } : {}),
        ...(p.status ? { status: p.status } : {}),
        ...(q ? { body: { contains: q, mode: "insensitive" as const } } : {}),
      },
      orderBy: tab === "library" ? [{ publishedAt: "desc" }] : [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: tab === "overview" ? 8 : 150,
    }),
    prisma.socialPost.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.socialPost.groupBy({ by: ["channel", "status"], _count: { _all: true } }),
    prisma.socialPost.findMany({
      where: { status: "scheduled", scheduledAt: { gte: new Date(t - DAY), lte: new Date(t + 14 * DAY) } },
      orderBy: { scheduledAt: "asc" },
      select: { id: true, channel: true, body: true, scheduledAt: true },
    }),
    prisma.socialPost.findMany({ where: { publishedAt: { gte: new Date(t - 30 * DAY) } }, select: { publishedAt: true } }),
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const perChannel = (c: string, statuses: string[]) => byChannel.filter((b) => b.channel === c && statuses.includes(b.status)).reduce((x, b) => x + b._count._all, 0);
  const dueManual = upcoming.filter((u) => u.scheduledAt && u.scheduledAt <= now && !canAutoPublish(u.channel)).length;
  const tomorrow9 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 13, 0)).toISOString().slice(0, 16);
  const self = (over: Record<string, string | undefined> = {}) => `/admin/social${qs(p, { ok: undefined, err: undefined, ...over })}`;
  const back = self();
  const armed = SOCIAL_CHANNELS.filter((c) => canAutoPublish(c)).length;

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(t + i * DAY);
    return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) };
  });
  const perDay = Array.from({ length: 30 }, (_, i) => new Date(t - (29 - i) * DAY).toISOString().slice(0, 10)).map((d) => ({
    label: d.slice(8),
    value: published30.filter((x) => x.publishedAt?.toISOString().slice(0, 10) === d).length,
  }));

  const postList = (empty: string) =>
    posts.length === 0 ? (
      <Empty title={empty}>
        <Link prefetch={false} className="dk-btn dk-btn--primary" href={self({ tab: "compose" })}>
          <Icon name="plus" size={14} /> Create post
        </Link>
      </Empty>
    ) : (
      <div className="dk-stack">
        {posts.map((post) => {
          const due = post.status === "scheduled" && post.scheduledAt && post.scheduledAt <= now;
          const text = post.link ? `${post.body}\n\n${post.link}` : post.body;
          return (
            <article key={post.id} className="dk-post">
              <div className="dk-post__top">
                <Mark channel={post.channel} />
                <b>{CHANNEL_LABEL[post.channel] || post.channel}</b>
                <Chip tone={(TONE[post.status] || "ink") as "brand"}>{post.status}</Chip>
                {due && !canAutoPublish(post.channel) ? <Chip tone="warn">due — post it now</Chip> : null}
                <span className="dk-hint">
                  {post.scheduledAt ? `for ${when(post.scheduledAt)} UTC` : ""}
                  {post.publishedAt ? ` · posted ${when(post.publishedAt)}` : ""}
                  {` · ${post.body.length}/${CHANNEL_LIMIT[post.channel] ?? "∞"} chars`}
                </span>
              </div>
              <pre className="dk-post__body">{text}</pre>
              {post.imageUrl ? (
                <p className="dk-hint">
                  Image:{" "}
                  <a href={post.imageUrl} target="_blank" rel="noreferrer">
                    {post.imageUrl}
                  </a>
                </p>
              ) : null}
              {post.error ? <p className="dk-flash dk-flash--err">{post.error}</p> : null}
              {post.status !== "published" && post.status !== "manual" ? (
                <form action={postAction} className="dk-inline">
                  <input type="hidden" name="id" value={post.id} />
                  <input type="hidden" name="returnTo" value={back} />
                  {post.channel === "facebook" && fb ? (
                    <button className="dk-btn dk-btn--primary dk-btn--sm" name="op" value="publish">
                      Publish now
                    </button>
                  ) : null}
                  <button className="dk-btn dk-btn--sm" name="op" value="manual">
                    <Icon name="check" size={13} /> Mark posted
                  </button>
                  <input name="at" type="datetime-local" defaultValue={(post.scheduledAt ?? new Date(tomorrow9)).toISOString().slice(0, 16)} aria-label="Schedule for (UTC)" />
                  <button className="dk-btn dk-btn--sm" name="op" value="schedule">
                    {post.status === "scheduled" ? "Reschedule" : "Schedule"}
                  </button>
                  {post.status === "scheduled" ? (
                    <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="unschedule">
                      Unschedule
                    </button>
                  ) : null}
                  <button className="dk-btn dk-btn--ghost dk-btn--sm" name="op" value="delete">
                    Delete
                  </button>
                </form>
              ) : post.externalId ? (
                <p className="dk-hint">Facebook post id {post.externalId}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    );

  return (
    <div className="dk-stack">
      <DeskHeader
        href="/admin/social"
        title="Social media command center"
        brief="Write once, schedule across channels, and publish without leaving the desk. Facebook posts go out on their own; the others come up here when due, ready to copy."
        flash={flashOf(p)}
        signals={[
          { label: "Network coverage", value: `${armed}/${SOCIAL_CHANNELS.length} channels auto-publish`, tone: armed ? "live" : "warn", href: self({ tab: "channels" }) },
          { label: "Publishing queue", value: n("scheduled") ? `${n("scheduled")} scheduled` : "nothing scheduled", tone: "ok", href: self({ tab: "queue" }) },
          { label: "Editorial desk", value: dueManual ? `${dueManual} due to post by hand` : n("failed") ? `${n("failed")} failed` : "queue is clear", tone: dueManual || n("failed") ? "critical" : "ok", href: self({ tab: "queue" }) },
        ]}
        actions={
          <>
            <a className="dk-btn dk-btn--onink" href="https://business.facebook.com/latest/content_calendar" target="_blank" rel="noreferrer">
              <Icon name="external" size={15} /> Meta planner
            </a>
            <Link prefetch={false} className="dk-btn dk-btn--light" href={self({ tab: "compose" })}>
              <Icon name="plus" size={15} /> Create post
            </Link>
          </>
        }
      />

      <div className="dk-kpis">
        <Kpi label="Live inventory" value={n("published") + n("manual") + n("scheduled") + n("draft")} sub="published + queued + drafts" href={self({ tab: "library" })} />
        <Kpi label="On the wire" value={n("published") + n("manual")} sub="posted across channels" href={self({ tab: "library" })} tone="good" />
        <Kpi label="On the calendar" value={n("scheduled")} sub={n("scheduled") ? "scheduled posts" : "nothing queued yet"} href={self({ tab: "calendar" })} />
        <Kpi label="Drafts" value={n("draft")} href={self({ tab: "queue", status: "draft" })} />
        <Kpi label="Failed" value={n("failed")} href={self({ tab: "queue", status: "failed" })} tone={n("failed") ? "alert" : undefined} />
        <Kpi label="Channels armed" value={SOCIAL_CHANNELS.length} sub={`${armed} auto · ${SOCIAL_CHANNELS.length - armed} copy & post`} href={self({ tab: "channels" })} tone="value" />
      </div>

      <div className="dk-grid dk-grid--rail">
        <CommandRail
          title="Command rail"
          sub="Draft · schedule · publish"
          tabs={[
            { key: "overview", label: "Overview", href: self({ tab: undefined, status: undefined, channel: undefined }), on: tab === "overview" },
            { key: "compose", label: "Compose", href: self({ tab: "compose" }), on: tab === "compose" },
            { key: "queue", label: "Queue", href: self({ tab: "queue" }), on: tab === "queue", count: n("scheduled") + n("draft") + n("failed") },
            { key: "library", label: "Library", href: self({ tab: "library", status: undefined }), on: tab === "library", count: n("published") + n("manual") },
            { key: "calendar", label: "Schedule", href: self({ tab: "calendar" }), on: tab === "calendar" },
            { key: "channels", label: "Channels", href: self({ tab: "channels" }), on: tab === "channels" },
          ]}
          quick={{
            title: "Quick create",
            items: SOCIAL_CHANNELS.map((c) => ({
              label: CHANNEL_LABEL[c],
              href: self({ tab: "compose", channel: c }),
              mark: <Mark channel={c} />,
              note: canAutoPublish(c) ? "auto" : undefined,
            })),
          }}
        />

        <div className="dk-stack">
          <Panel kicker="Channel status" title="Platform connections" sub={`${armed} publishing automatically · the rest are copy-and-post, with a reminder here when each one is due.`}>
            <div className="dk-channels">
              {SOCIAL_CHANNELS.map((c) => (
                <div key={c} className="dk-channel">
                  <div className="dk-channel__top">
                    <Mark channel={c} />
                    <div>
                      <b>{CHANNEL_LABEL[c]}</b>
                      <span className={`dk-channel__state dk-channel__state--${canAutoPublish(c) ? "on" : "manual"}`}>
                        <i /> {canAutoPublish(c) ? "Connected" : c === "facebook" ? "Token not set" : "Copy & post"}
                      </span>
                    </div>
                  </div>
                  <div className="dk-channel__foot">
                    <span>
                      {perChannel(c, ["published", "manual"])} posted · {perChannel(c, ["scheduled"])} queued
                    </span>
                    <Link prefetch={false} href={self({ tab: "compose", channel: c })}>+ Create</Link>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <div className="dk-toolbar" style={{ marginBottom: 14 }}>
              <ViewSwitch
                items={[
                  { key: "overview", label: "01 Overview", href: self({ tab: undefined }), on: tab === "overview" },
                  { key: "queue", label: "02 Queue", href: self({ tab: "queue" }), on: tab === "queue" },
                  { key: "library", label: "03 Library", href: self({ tab: "library" }), on: tab === "library" },
                  { key: "calendar", label: "04 Schedule", href: self({ tab: "calendar" }), on: tab === "calendar" },
                  { key: "channels", label: "05 Channels", href: self({ tab: "channels" }), on: tab === "channels" },
                ]}
              />
              {tab === "queue" || tab === "library" || tab === "overview" ? (
                <form method="get" className="dk-inline">
                  {tab !== "overview" ? <input type="hidden" name="tab" value={tab} /> : null}
                  <input name="q" defaultValue={q} placeholder="Search every channel…" aria-label="Search posts" />
                  <select name="channel" defaultValue={channel} aria-label="Channel">
                    <option value="">All platforms</option>
                    {SOCIAL_CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {CHANNEL_LABEL[c]}
                      </option>
                    ))}
                  </select>
                  <select name="status" defaultValue={p.status} aria-label="Status">
                    <option value="">All status</option>
                    {(tab === "library" ? ["published", "manual"] : ["draft", "scheduled", "failed", "published", "manual"]).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button className="dk-btn dk-btn--sm">Filter</button>
                </form>
              ) : null}
            </div>

            {tab === "overview" ? (
              <div className="dk-stack">
                <div className="dk-grid dk-grid--2">
                  <div>
                    <p className="dk-kicker" style={{ marginBottom: 8 }}>
                      Posted per day · 30 days
                    </p>
                    <Columns rows={perDay} height={120} />
                  </div>
                  <div>
                    <p className="dk-kicker" style={{ marginBottom: 8 }}>
                      Next up
                    </p>
                    {upcoming.filter((u) => u.scheduledAt && u.scheduledAt >= now).length === 0 ? (
                      <p className="dk-hint">Nothing scheduled. Paste a week of posts in Compose → Bulk and space them out.</p>
                    ) : (
                      <ul className="dk-feed">
                        {upcoming
                          .filter((u) => u.scheduledAt && u.scheduledAt >= now)
                          .slice(0, 5)
                          .map((u) => (
                            <li key={u.id}>
                              <Mark channel={u.channel} />
                              <div>
                                <b>{u.body.slice(0, 60)}</b>
                                <p>{CHANNEL_LABEL[u.channel]}</p>
                              </div>
                              <time>{when(u.scheduledAt)}</time>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </div>
                <p className="dk-kicker">Recent posts</p>
                {postList("No posts yet — create your first post to get started.")}
              </div>
            ) : null}

            {tab === "queue" ? postList("The queue is clear.") : null}
            {tab === "library" ? postList("Nothing posted yet.") : null}

            {tab === "calendar" ? (
              <>
                <p className="dk-hint" style={{ marginBottom: 12 }}>
                  The next two weeks (UTC). Facebook posts are shown in blue — they publish on their own.
                </p>
                <div className="dk-cal">
                  {days.map((d, i) => {
                    const items = upcoming.filter((u) => u.scheduledAt?.toISOString().slice(0, 10) === d.key);
                    return (
                      <div key={d.key} className={`dk-cal__day${i === 0 ? " is-today" : ""}`}>
                        <b>{d.label}</b>
                        <ul>
                          {items.map((u) => (
                            <li key={u.id} className={u.channel === "facebook" ? "is-fb" : undefined} title={u.body}>
                              {u.scheduledAt?.toISOString().slice(11, 16)} {CHANNEL_LABEL[u.channel]?.split(" ")[0]}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}

            {tab === "channels" ? (
              <ul className="dk-health">
                {SOCIAL_CHANNELS.map((c) => (
                  <li key={c} className={canAutoPublish(c) ? undefined : "is-bad"}>
                    <b>
                      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                        <Mark channel={c} /> {CHANNEL_LABEL[c]}
                      </span>
                      <Chip tone={canAutoPublish(c) ? "good" : "warn"}>{canAutoPublish(c) ? "auto-publish" : "copy & post"}</Chip>
                    </b>
                    <span>
                      Limit {CHANNEL_LIMIT[c]?.toLocaleString("en-US")} characters · {perChannel(c, ["published", "manual"])} posted · {perChannel(c, ["scheduled"])} queued
                    </span>
                    {c === "facebook" && !fb ? <small>Set FB_PAGE_ID and FB_PAGE_TOKEN with the deploy script (--secrets) to publish automatically.</small> : null}
                    {c === "facebook" && fb ? <span>Page {fb.pageId}</span> : null}
                    {c !== "facebook" ? <small>Due posts appear on the Overview and in Next best moves, ready to copy.</small> : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {tab === "compose" ? (
              <div className="dk-grid dk-grid--2" id="compose">
                <div>
                  <p className="dk-kicker" style={{ marginBottom: 10 }}>
                    One post
                  </p>
                  <form action={createPost} className="dk-form">
                    <input type="hidden" name="returnTo" value={self({ tab: "queue", channel: undefined })} />
                    <ChannelPicks picked={channel ? [channel] : ["facebook"]} />
                    <label className="dk-field dk-field--wide">
                      <span>Text</span>
                      <textarea name="body" rows={7} required placeholder="Rooms from $900 all-in in Brooklyn this month…" />
                    </label>
                    <label className="dk-field">
                      <span>Image URL (https)</span>
                      <input name="imageUrl" placeholder="https://media.rentleaks.com/…" />
                    </label>
                    <label className="dk-field">
                      <span>Link</span>
                      <input name="link" placeholder="https://rentleaks.com/facebook.html?src=fb_post" />
                    </label>
                    <label className="dk-field dk-field--wide">
                      <span>Schedule (UTC) — leave empty for a draft</span>
                      <input name="at" type="datetime-local" />
                    </label>
                    <p className="dk-hint">X allows 280 characters, Threads 500, Instagram and TikTok 2,200. Keep copy about the home, never about who may live there.</p>
                    <button className="dk-btn dk-btn--primary">
                      <Icon name="plus" size={14} /> Save post
                    </button>
                  </form>
                </div>
                <div>
                  <p className="dk-kicker" style={{ marginBottom: 10 }}>
                    Bulk — a week at once
                  </p>
                  <form action={bulkPosts} className="dk-form">
                    <input type="hidden" name="returnTo" value={self({ tab: "calendar", channel: undefined })} />
                    <ChannelPicks picked={channel ? [channel] : ["facebook"]} />
                    <label className="dk-field dk-field--wide">
                      <span>Posts — separate them with a line containing only ---</span>
                      <textarea
                        name="posts"
                        rows={11}
                        required
                        placeholder={"Rooms in Brooklyn from $900 all-in.\nimage: https://rentleaks.com/images/facebook/rooms.png\nlink: https://rentleaks.com/facebook.html?src=fb_post\n---\nCo-living: furnished, bills in, 1 month minimum.\n---\nLease-breaks: take over a lease for 3–10 months."}
                      />
                    </label>
                    <label className="dk-field">
                      <span>First post at (UTC)</span>
                      <input name="start" type="datetime-local" defaultValue={tomorrow9} required />
                    </label>
                    <label className="dk-field">
                      <span>Then every (hours)</span>
                      <input name="every" type="number" min={1} defaultValue={24} />
                    </label>
                    <button className="dk-btn dk-btn--primary">
                      <Icon name="clock" size={14} /> Schedule all
                    </button>
                  </form>
                </div>
              </div>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}
