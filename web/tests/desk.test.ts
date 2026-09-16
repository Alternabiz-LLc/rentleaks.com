import assert from "node:assert/strict";
import { test } from "node:test";
import { DESK_ACTIONS, DESK_GROUPS, DESK_MODULES, moduleByHref, moduleFor } from "../src/lib/admin/nav";
import {
  CATEGORY_META,
  followUpDraft,
  laneOf,
  leadReplyDraft,
  rankActions,
  scoreContact,
  scoreLead,
  type NextAction,
} from "../src/lib/admin/score";

const NOW = Date.parse("2026-09-16T15:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);

const lead = (over: Partial<Parameters<typeof scoreLead>[0]> = {}) => ({
  kind: "match",
  status: "new",
  phone: null,
  listingId: null,
  budgetMax: null,
  moveIn: null,
  moveOut: null,
  stayMonths: null,
  viewingSlots: "[]",
  message: "",
  createdAt: hoursAgo(2),
  ...over,
});

test("the desk map has every admin module once, with unique codes", () => {
  const hrefs = DESK_MODULES.map((m) => m.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
  assert.equal(new Set(DESK_MODULES.map((m) => m.code)).size, DESK_MODULES.length);
  assert.deepEqual(
    DESK_GROUPS.map((g) => g.title),
    ["Run", "Grow", "Business"],
  );
  for (const href of ["/admin", "/admin/leads", "/admin/listings", "/admin/accounts", "/admin/reports", "/admin/crm", "/admin/outreach", "/admin/campaigns", "/admin/social", "/admin/ads", "/admin/trials", "/admin/revenue", "/admin/markets", "/admin/system"]) {
    assert.ok(hrefs.includes(href), href);
  }
  for (const a of DESK_ACTIONS) assert.match(a.href, /^\/(admin|api\/admin)\//);
});

test("moduleFor picks the longest matching module and never lets /admin swallow the rest", () => {
  assert.equal(moduleFor("/admin")?.href, "/admin");
  assert.equal(moduleFor("/admin/crm/abc123")?.href, "/admin/crm");
  assert.equal(moduleFor("/admin/campaigns/xyz")?.href, "/admin/campaigns");
  assert.equal(moduleFor("/admin/crmx"), undefined);
  assert.throws(() => moduleByHref("/admin/nope"));
});

test("a booking request with dates and a phone outranks a bare match request", () => {
  const strong = scoreLead(lead({ kind: "stay", phone: "+1 555", listingId: "l1", budgetMax: 1500, moveIn: "2026-10-01", stayMonths: 3 }), NOW);
  const weak = scoreLead(lead(), NOW);
  assert.ok(strong.score > weak.score, `${strong.score} > ${weak.score}`);
  assert.ok(strong.score <= 100 && weak.score >= 0);
  assert.ok(strong.reasons.some((r) => r.includes("book")));
  assert.ok(strong.reasons.some((r) => r.includes("45 days")));
});

test("lead score: spam is zero, stale unanswered leads sink, booked stays high", () => {
  assert.equal(scoreLead(lead({ status: "spam" }), NOW).score, 0);
  const fresh = scoreLead(lead({ createdAt: hoursAgo(3) }), NOW).score;
  const stale = scoreLead(lead({ createdAt: hoursAgo(24 * 10) }), NOW).score;
  assert.ok(fresh > stale);
  assert.ok(scoreLead(lead({ status: "booked", createdAt: hoursAgo(24 * 30) }), NOW).score >= 85);
  // A malformed slots column never throws.
  assert.doesNotThrow(() => scoreLead(lead({ viewingSlots: "not json" }), NOW));
});

test("the lead score never reads anything about who a person is", () => {
  // Only request fields are inputs; adding unrelated keys changes nothing.
  const base = scoreLead(lead({ kind: "viewing" }), NOW);
  const withExtra = scoreLead({ ...lead({ kind: "viewing" }), name: "Anyone", email: "a@b.co" } as ReturnType<typeof lead>, NOW);
  assert.deepEqual(base, withExtra);
});

test("contact score rewards overdue follow-ups and qualified operators, punishes lost and unsubscribed", () => {
  const c = (over: Partial<Parameters<typeof scoreContact>[0]> = {}) => ({
    kind: "renter",
    stage: "new",
    phone: null,
    company: null,
    marketingConsent: false,
    unsubscribedAt: null,
    lastContactedAt: null,
    nextFollowUpAt: null,
    createdAt: hoursAgo(24 * 30),
    ...over,
  });
  const hot = scoreContact(c({ kind: "operator", stage: "qualified", company: "Co", nextFollowUpAt: hoursAgo(24 * 5) }), NOW);
  const cold = scoreContact(c({ stage: "lost", unsubscribedAt: hoursAgo(1) }), NOW);
  assert.ok(hot.score > 70, String(hot.score));
  assert.equal(cold.score, 0);
  assert.ok(hot.reasons.some((r) => r.includes("overdue")));
});

test("next-best ranking and lanes", () => {
  const mk = (id: string, category: NextAction["category"], priority: number): NextAction => ({ id, category, priority, title: id, reason: "", href: "/admin", cta: "Go" });
  const ranked = rankActions([mk("a", "going-quiet", 40), mk("b", "waiting-lead", 90), mk("c", "follow-up", 60)]);
  assert.deepEqual(
    ranked.map((a) => a.id),
    ["b", "c", "a"],
  );
  assert.equal(laneOf(mk("x", "waiting-lead", 90)), "today");
  assert.equal(laneOf(mk("x", "follow-up", 40)), "week");
  assert.equal(laneOf(mk("x", "going-quiet", 80)), "today");
  assert.equal(laneOf(mk("x", "upsell", 95)), "opportunity");
  for (const k of Object.keys(CATEGORY_META)) assert.ok(CATEGORY_META[k as NextAction["category"]].label);
});

test("drafts are addressed right and stay about the home", () => {
  const d = leadReplyDraft({ id: "L1", kind: "viewing", name: "Ada Lovelace", email: "ada@example.com", listingTitle: "Sunny room", moveIn: "2026-10-01", appUrl: "https://app.rentleaks.com" });
  assert.equal(d.to, "ada@example.com");
  assert.equal(d.kind, "lead");
  assert.match(d.subject, /viewing/i);
  assert.match(d.body, /^Hi Ada,/);
  assert.match(d.body, /Sunny room/);
  assert.doesNotMatch(d.body, /income|children|nationality|age\b/i);
  const f = followUpDraft({ id: "C1", name: "", email: "x@y.co", kind: "host", stage: "contacted", appUrl: "https://app.rentleaks.com" });
  assert.match(f.body, /^Hi there,/);
  assert.match(f.body, /\/list/);
});
