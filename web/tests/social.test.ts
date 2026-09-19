import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { MAX_PER_TICK, STALE_HOURS } from "../src/lib/ops/social";
import {
  canAutoPublish,
  CHANNEL_LIMIT,
  facebookConfig,
  instagramConfig,
  publishPost,
  publishToInstagram,
  SOCIAL_CHANNELS,
} from "../src/lib/social";

const QUEUE = join(process.cwd(), "..", "tools", "social", "ig-queue.json");
type Entry = { day: number; id: string; image: string; link: string; caption: string };

/** These readers take whatever the worker's env happens to hold, so the tests
 *  hand them partial envs on purpose. */
const env = (vars: Record<string, string>) => ({ NODE_ENV: "test", ...vars }) as NodeJS.ProcessEnv;

test("instagram publishing: configured only when both halves are there", () => {
  assert.equal(instagramConfig(env({})), null);
  assert.equal(instagramConfig(env({ IG_USER_ID: "1789" })), null, "an id with no token is not a config");
  assert.equal(instagramConfig(env({ IG_TOKEN: "t" })), null, "a token with no id is not a config");

  // The Page token stands in when IG_TOKEN isn't set, because in most setups
  // it is the same token with one more scope on it.
  assert.deepEqual(instagramConfig(env({ IG_USER_ID: "1789", FB_PAGE_TOKEN: "page" })), {
    userId: "1789",
    token: "page",
  });
  assert.deepEqual(instagramConfig(env({ IG_USER_ID: "1789", IG_TOKEN: "own", FB_PAGE_TOKEN: "page" })), {
    userId: "1789",
    token: "own",
  }, "IG_TOKEN wins over the Page token");
});

test("auto-publishing: only the two channels that have an API, and only when armed", () => {
  const armed = env({ FB_PAGE_ID: "1", FB_PAGE_TOKEN: "t", IG_USER_ID: "2" });
  assert.equal(canAutoPublish("facebook", armed), true);
  assert.equal(canAutoPublish("instagram", armed), true);
  for (const c of SOCIAL_CHANNELS) {
    if (c === "facebook" || c === "instagram") continue;
    assert.equal(canAutoPublish(c, armed), false, `${c} has no automatic publishing`);
  }
  // Nothing configured: every channel falls back to the manual checklist.
  for (const c of SOCIAL_CHANNELS) assert.equal(canAutoPublish(c, env({})), false);
  assert.equal(facebookConfig(env({})), null);
});

test("instagram refuses, in words, rather than failing silently", async () => {
  const missing = await publishToInstagram({ body: "hello", imageUrl: "https://rentleaks.com/a.jpg" });
  assert.equal(missing.ok, false);
  assert.match(missing.ok === false ? missing.error : "", /IG_USER_ID/, "says which credential is missing");

  const noImage = await publishPost("instagram", { body: "hello" });
  assert.equal(noImage.ok, false);

  const unknown = await publishPost("tiktok", { body: "hello", imageUrl: "https://rentleaks.com/a.jpg" });
  assert.equal(unknown.ok, false);
  assert.match(unknown.ok === false ? unknown.error : "", /by hand/, "points at the manual route");
});

test("the publisher's limits are sane for a daily feed", () => {
  assert.ok(MAX_PER_TICK >= 1 && MAX_PER_TICK <= 10, "a burst cap, not a floodgate");
  assert.ok(STALE_HOURS >= 12, "a post missed overnight still goes out");
});

test("the Instagram launch queue is publishable as generated", () => {
  const entries: Entry[] = JSON.parse(readFileSync(QUEUE, "utf8"));
  assert.equal(entries.length, 20, "twenty posts, one a day");
  assert.deepEqual(entries.map((e) => e.day), Array.from({ length: 20 }, (_, i) => i + 1), "days run 1..20 in order");
  assert.equal(new Set(entries.map((e) => e.id)).size, entries.length, "ids are unique");

  for (const e of entries) {
    assert.ok(e.caption.length <= CHANNEL_LIMIT.instagram, `${e.id}: caption within Instagram's limit`);
    assert.ok(e.caption.trim().length > 80, `${e.id}: caption says something`);
    // Instagram fetches the picture itself, so it has to be a public JPEG.
    assert.match(e.image, /^https:\/\/rentleaks\.com\/images\/social\/ig\/\d{2}-[a-z0-9-]+\.jpg$/, `${e.id}: public JPEG URL`);
    assert.match(e.link, /^https:\/\/rentleaks\.com\//, `${e.id}: link stays on the site`);
  }
});

test("no post describes who should live somewhere", () => {
  const entries: Entry[] = JSON.parse(readFileSync(QUEUE, "utf8"));
  // The site's own banned-terms list is the reference; these are the shapes a
  // caption would most plausibly drift into.
  const banned = [
    /\bno kids\b/i, /\bno children\b/i, /\badults only\b/i, /\bno families\b/i,
    /\bprofessionals only\b/i, /\bno students\b/i, /\bno vouchers\b/i, /\bno section 8\b/i,
    /\bideal for (a )?(young|single|professional)/i, /\bperfect for (a )?(couple|family)/i,
  ];
  for (const e of entries) {
    for (const re of banned) {
      assert.ok(!re.test(e.caption), `${e.id}: caption must not describe who should live somewhere (${re})`);
    }
  }
});
