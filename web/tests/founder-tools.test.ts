import assert from "node:assert/strict";
import { test } from "node:test";
import { bucketWeeks, lastWeeks, recurringMonthly, weekKey } from "../src/lib/admin/metrics";
import { csvCell, csvObjects, parseCsv, toCsv } from "../src/lib/csv";
import {
  audienceWhere,
  coerceAudience,
  mergeFields,
  normaliseTags,
  renderEmail,
  textToHtml,
  unsubscribeToken,
  verifyUnsubscribeToken,
} from "../src/lib/marketing";
import { parsePostBlock, splitBulkPosts, spreadSchedule } from "../src/lib/social";
import { inviteCode, inviteState, normaliseCode } from "../src/lib/trials";
import { parseAddress, pickTransport } from "../src/lib/v1/mail";

test("merge fields fill known keys and leave unknown ones", () => {
  const out = mergeFields("Hi {{first_name}} in {{ city }} {{unknown}} {{days}}d", { name: "Ada Lovelace", city: "Brooklyn", days: 7 });
  assert.equal(out, "Hi Ada in Brooklyn {{unknown}} 7d");
  assert.equal(mergeFields("Hi {{first_name}}", {}), "Hi there");
});

test("email HTML escapes content and only links http(s)/mailto", () => {
  const html = textToHtml('<script>x</script>\n\n- **bold** item\n- [ok](https://a.b/c?x=1&y=2)\n\n[bad](javascript:alert(1))');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<ul/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /href="https:\/\/a\.b\/c\?x=1&amp;y=2"/);
  assert.doesNotMatch(html, /javascript:/);
  const { text, html: full } = renderEmail("Hello", { address: "1 Main St", reason: "Because", unsubscribeUrl: "https://x.y/u/t" });
  assert.match(text, /1 Main St/);
  assert.match(text, /Unsubscribe: https:\/\/x\.y\/u\/t/);
  assert.match(full, /Unsubscribe<\/a>/);
});

test("unsubscribe tokens round-trip and reject tampering", () => {
  const t = unsubscribeToken("Ada@Example.com", "k1");
  assert.equal(verifyUnsubscribeToken(t, "k1"), "ada@example.com");
  assert.equal(verifyUnsubscribeToken(t, "k2"), null);
  const [head, sig] = t.split(".");
  const other = Buffer.from("eve@example.com").toString("base64url");
  assert.equal(verifyUnsubscribeToken(`${other}.${sig}`, "k1"), null);
  assert.equal(verifyUnsubscribeToken(`${head}.${sig.slice(0, -1)}A`, "k1"), null);
  assert.equal(verifyUnsubscribeToken("garbage", "k1"), null);
});

test("newsletters always require consent; audiences never include unsubscribed", () => {
  const a = coerceAudience({ consentOnly: false, kinds: ["host", "hacker"], tags: ["NY"] }, "newsletter");
  assert.equal(a.consentOnly, true);
  assert.deepEqual(a.kinds, ["host"]);
  assert.deepEqual(a.tags, ["ny"]);
  const b = coerceAudience({ consentOnly: false }, "outreach");
  assert.equal(b.consentOnly, false);
  const where = JSON.stringify(audienceWhere(b));
  assert.match(where, /"unsubscribedAt":null/);
  assert.match(where, /"confirmToken":null/);
  assert.doesNotMatch(where, /marketingConsent/);
  assert.deepEqual(normaliseTags("A b, a b; c"), ["a-b", "c"]);
});

test("CSV escapes quotes and formula injection, and parses quoted cells", () => {
  assert.equal(csvCell('a "b", c'), '"a ""b"", c"');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  const csv = toCsv(["a", "b"], [["x,y", 2]]);
  assert.deepEqual(parseCsv(csv), [["a", "b"], ["x,y", "2"]]);
  const objs = csvObjects('Email,First Name\r\n"jo@x.io","Jo ""J"""\n\n');
  assert.deepEqual(objs, [{ email: "jo@x.io", first_name: 'Jo "J"' }]);
});

test("transport choice prefers SMTP only for personal mail on Workers", () => {
  assert.equal(pickTransport("personal", { resend: true, smtp: true, workers: true }), "smtp");
  assert.equal(pickTransport("bulk", { resend: true, smtp: true, workers: true }), "resend");
  assert.equal(pickTransport("personal", { resend: true, smtp: true, workers: false }), "resend");
  assert.equal(pickTransport("bulk", { resend: false, smtp: true, workers: true }), "smtp");
  assert.equal(pickTransport("transactional", { resend: false, smtp: false, workers: true }), "console");
  assert.deepEqual(parseAddress("RentLeaks <no-reply@rentleaks.com>"), { name: "RentLeaks", email: "no-reply@rentleaks.com" });
  assert.deepEqual(parseAddress("a@b.co"), { email: "a@b.co" });
});

test("bulk social posts split on --- and carry image/link lines", () => {
  const posts = splitBulkPosts("One\nimage: https://x.io/a.png\n---\n\nTwo\nlink: https://x.io\n  ---  \nThree");
  assert.equal(posts.length, 3);
  assert.deepEqual(parsePostBlock(posts[0]), { body: "One", imageUrl: "https://x.io/a.png", link: null });
  assert.deepEqual(parsePostBlock(posts[1]), { body: "Two", imageUrl: null, link: "https://x.io" });
  const times = spreadSchedule(new Date("2026-10-01T16:00:00Z"), 3, 24);
  assert.equal(times[2].toISOString(), "2026-10-03T16:00:00.000Z");
});

test("invite codes are unambiguous and states follow expiry", () => {
  const code = inviteCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{10}$/);
  assert.equal(normaliseCode(" ab-c 12 "), "ABC12");
  const past = new Date(Date.now() - 1000);
  const future = new Date(Date.now() + 86_400_000);
  assert.equal(inviteState({ status: "sent", expiresAt: past }), "expired");
  assert.equal(inviteState({ status: "redeemed", expiresAt: past }), "redeemed");
  assert.equal(inviteState({ status: "pending", expiresAt: future }), "pending");
});

test("metrics: week buckets and recurring revenue", () => {
  assert.equal(weekKey(new Date("2026-09-16T12:00:00Z")), "2026-09-14");
  assert.equal(weekKey(new Date("2026-09-14T00:00:00Z")), "2026-09-14");
  const weeks = lastWeeks(2, new Date("2026-09-16T00:00:00Z"));
  assert.deepEqual(weeks, ["2026-09-07", "2026-09-14"]);
  assert.deepEqual(
    bucketWeeks([new Date("2026-09-15T00:00:00Z"), new Date("2026-09-08T00:00:00Z"), new Date("2020-01-01")], weeks).map((w) => w.count),
    [1, 1],
  );
  const r = recurringMonthly([
    { status: "active", housingType: "room", plan: "month", sponsored: true },
    { status: "paused", housingType: "room", plan: "month", sponsored: false },
    { status: "active", housingType: "lease-break", plan: "week", sponsored: true },
  ]);
  assert.equal(r, 180);
});
