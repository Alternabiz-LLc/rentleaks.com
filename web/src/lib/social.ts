/**
 * Social posting.
 *
 * Facebook Page posts are published through the Graph API when FB_PAGE_ID and
 * FB_PAGE_TOKEN (a long-lived Page access token with pages_manage_posts) are
 * set. Every other channel — and Facebook without a token — is "manual": the
 * admin copies the text, posts it, and marks it posted. That is deliberate:
 * Instagram, LinkedIn, X and TikTok each need their own app review, and a
 * scheduler that silently fails is worse than an honest checklist.
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

export function canAutoPublish(channel: string, env: NodeJS.ProcessEnv = process.env) {
  return channel === "facebook" && Boolean(facebookConfig(env));
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
