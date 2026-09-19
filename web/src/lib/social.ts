/**
 * Social posting.
 *
 * Two channels can publish on their own, and both need credentials that are
 * set once and never live in this file:
 *
 *   Facebook   FB_PAGE_ID + FB_PAGE_TOKEN (a long-lived Page token with
 *              pages_manage_posts).
 *   Instagram  IG_USER_ID + IG_TOKEN — or FB_PAGE_TOKEN, when the same token
 *              carries instagram_content_publish. The account has to be a
 *              Professional account linked to the Page; Instagram has no API
 *              for personal accounts.
 *
 * Every other channel — and either of those without credentials — is "manual":
 * the admin copies the text, posts it, and marks it posted. That is deliberate.
 * LinkedIn, X and TikTok each need their own app review, and a scheduler that
 * silently fails is worse than an honest checklist.
 */
export const SOCIAL_CHANNELS = ["facebook", "instagram", "linkedin", "x", "tiktok", "threads"] as const;
export type SocialChannel = (typeof SOCIAL_CHANNELS)[number];

export const CHANNEL_LABEL: Record<string, string> = {
  facebook: "Facebook Page",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
  threads: "Threads",
};

export const CHANNEL_LIMIT: Record<string, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  x: 280,
  tiktok: 2200,
  threads: 500,
};

const GRAPH = "https://graph.facebook.com/v21.0";

export function facebookConfig(env: NodeJS.ProcessEnv = process.env) {
  const pageId = env.FB_PAGE_ID?.trim();
  const token = env.FB_PAGE_TOKEN?.trim();
  return pageId && token ? { pageId, token } : null;
}

/**
 * Instagram publishing needs the Instagram user id of the Professional account
 * and a token allowed to publish for it. IG_TOKEN wins when set; otherwise the
 * Page token is tried, because in most setups it is the same token with the
 * instagram_content_publish scope added.
 */
export function instagramConfig(env: NodeJS.ProcessEnv = process.env) {
  const userId = env.IG_USER_ID?.trim();
  const token = env.IG_TOKEN?.trim() || env.FB_PAGE_TOKEN?.trim();
  return userId && token ? { userId, token } : null;
}

export function canAutoPublish(channel: string, env: NodeJS.ProcessEnv = process.env) {
  if (channel === "facebook") return Boolean(facebookConfig(env));
  if (channel === "instagram") return Boolean(instagramConfig(env));
  return false;
}

export type PublishResult = { ok: true; id: string } | { ok: false; error: string };

export async function publishToFacebook(post: { body: string; imageUrl?: string | null; link?: string | null }): Promise<PublishResult> {
  const cfg = facebookConfig();
  if (!cfg) return { ok: false, error: "FB_PAGE_ID and FB_PAGE_TOKEN are not set." };
  const form = new URLSearchParams();
  form.set("access_token", cfg.token);
  let endpoint: string;
  if (post.imageUrl) {
    endpoint = `${GRAPH}/${cfg.pageId}/photos`;
    form.set("url", post.imageUrl);
    form.set("caption", post.link ? `${post.body}\n\n${post.link}` : post.body);
  } else {
    endpoint = `${GRAPH}/${cfg.pageId}/feed`;
    form.set("message", post.body);
    if (post.link) form.set("link", post.link);
  }
  try {
    const res = await fetch(endpoint, { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as { id?: string; post_id?: string; error?: { message?: string } };
    if (!res.ok || !(data.post_id || data.id)) {
      return { ok: false, error: data.error?.message || `Facebook returned ${res.status}` };
    }
    return { ok: true, id: String(data.post_id || data.id) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Instagram publishes in two steps: create a media container that points at a
 * public image URL, then publish that container. Both can fail on their own,
 * so both are reported separately — "container" and "publish" in the error tell
 * you which half to look at.
 *
 * The image has to be a JPEG that Instagram can fetch anonymously. Ours live on
 * rentleaks.com (images/social/ig/), which is why the art is generated into the
 * website rather than kept beside the marketing copy.
 */
export async function publishToInstagram(post: { body: string; imageUrl?: string | null; link?: string | null }): Promise<PublishResult> {
  const cfg = instagramConfig();
  if (!cfg) return { ok: false, error: "IG_USER_ID and a publishing token are not set." };
  if (!post.imageUrl) return { ok: false, error: "Instagram needs an image — a text-only post cannot be published." };

  /* A link in an Instagram caption is not clickable, so appending the URL adds
     noise and nothing else. The bio link is the route, and the captions say so. */
  const caption = post.body.slice(0, CHANNEL_LIMIT.instagram);

  const call = async (path: string, params: Record<string, string>) => {
    const form = new URLSearchParams({ ...params, access_token: cfg.token });
    const res = await fetch(`${GRAPH}/${path}`, { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    return { ok: res.ok && Boolean(data.id), id: data.id, error: data.error?.message || `Instagram returned ${res.status}` };
  };

  try {
    const made = await call(`${cfg.userId}/media`, { image_url: post.imageUrl, caption });
    if (!made.ok || !made.id) return { ok: false, error: `container: ${made.error}` };
    const done = await call(`${cfg.userId}/media_publish`, { creation_id: made.id });
    if (!done.ok || !done.id) return { ok: false, error: `publish: ${done.error}` };
    return { ok: true, id: String(done.id) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** The one entry point the scheduler uses, so adding a channel is one case. */
export async function publishPost(channel: string, post: { body: string; imageUrl?: string | null; link?: string | null }): Promise<PublishResult> {
  if (channel === "facebook") return publishToFacebook(post);
  if (channel === "instagram") return publishToInstagram(post);
  return { ok: false, error: `${CHANNEL_LABEL[channel] || channel} has no automatic publishing — post it by hand and mark it posted.` };
}

/**
 * Bulk composer input: posts separated by a line containing only "---".
 * Returns trimmed, non-empty post bodies.
 */
export function splitBulkPosts(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*-{3,}\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 100);
}

/**
 * Schedule `count` posts starting at `start`, one every `everyHours` hours.
 */
export function spreadSchedule(start: Date, count: number, everyHours: number): Date[] {
  const step = Math.max(1, everyHours) * 3_600_000;
  return Array.from({ length: count }, (_, i) => new Date(start.getTime() + i * step));
}

/**
 * Pulls optional "image: URL" and "link: URL" lines out of a post block.
 */
export function parsePostBlock(block: string): { body: string; imageUrl: string | null; link: string | null } {
  let imageUrl: string | null = null;
  let link: string | null = null;
  const lines = block.split("\n").filter((line) => {
    const m = /^\s*(image|link)\s*:\s*(https:\/\/\S+)\s*$/i.exec(line);
    if (!m) return true;
    if (m[1].toLowerCase() === "image") imageUrl = m[2];
    else link = m[2];
    return false;
  });
  return { body: lines.join("\n").trim(), imageUrl, link };
}
