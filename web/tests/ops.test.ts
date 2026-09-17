import assert from "node:assert/strict";
import { test } from "node:test";
import { daysToMoveOut, isStage, parseSlots, renewalDue, wallClock, wallLabel } from "../src/lib/ops/bookings";
import { briefDue, nyClock } from "../src/lib/ops/brief";
import { freshnessOf } from "../src/lib/ops/catalogue";
import { bandOf, buildCells } from "../src/lib/ops/demand";
import { gradeOf, nudgeDraft, replyStats, scoreHost, speedScore } from "../src/lib/ops/hosts";
import { readLink, signLink } from "../src/lib/ops/links";
import { rankMatches, scoreMatch, wantedMonths, type MatchHome, type MatchRequest } from "../src/lib/ops/match";
import { isAction, isTrigger, merge, RECIPES, TRIGGERS, waitLabel } from "../src/lib/ops/playbooks";
import { renderShortlist, defaultShortlistBody, SAFETY_NOTE } from "../src/lib/ops/shortlist";
import { ageLabel, median, slaOf } from "../src/lib/ops/sla";
import { jaccard, medianOf, normaliseAddress, shingles } from "../src/lib/ops/trust";

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-20T12:00:00Z");

const req = (over: Partial<MatchRequest> = {}): MatchRequest => ({
  cityId: "nyc",
  housingType: "room",
  budgetMax: 1500,
  currency: "USD",
  moveIn: "2026-10-01",
  moveOut: "2027-04-01",
  stayMonths: null,
  ...over,
});
const home = (over: Partial<MatchHome> = {}): MatchHome => ({
  id: "h1",
  cityId: "nyc",
  housingType: "room",
  allInUsd: 1200,
  availableFrom: "2026-09-25",
  availableUntil: null,
  minStayMonths: 1,
  maxStayMonths: 12,
  verified: false,
  sponsored: false,
  postedAt: new Date(NOW - 3 * DAY),
  ...over,
});

/* ---- Match & send --------------------------------------------------------- */

test("match: hard rules exclude wrong city, far over budget, late or short homes", () => {
  assert.equal(scoreMatch(req(), home({ cityId: "sf" }), NOW), null);
  assert.equal(scoreMatch(req(), home({ allInUsd: 1700 }), NOW), null, "more than 10% over budget");
  assert.ok(scoreMatch(req(), home({ allInUsd: 1600 }), NOW), "up to 10% over is shown");
  assert.equal(scoreMatch(req(), home({ availableFrom: "2026-10-20" }), NOW), null, "free 19 days late");
  assert.equal(scoreMatch(req(), home({ availableUntil: "2027-01-01" }), NOW), null, "ends before move-out");
  assert.equal(scoreMatch(req({ stayMonths: 2, moveOut: null }), home({ minStayMonths: 3 }), NOW), null, "shorter than the minimum");
  assert.equal(scoreMatch(req(), home({ allInUsd: 0 }), NOW), null, "no price, no match");
});

test("match: ranking prefers the asked type within budget, and explains itself", () => {
  const homes = [home({ id: "a", housingType: "studio" }), home({ id: "b" }), home({ id: "c", allInUsd: 1600 })];
  const ranked = rankMatches(req(), homes, 3, NOW);
  assert.equal(ranked[0].id, "b");
  assert.equal(ranked.length, 3);
  assert.ok(ranked[0].reasons.includes("the type asked for"));
  assert.ok(ranked.find((m) => m.id === "c")!.reasons.some((r) => r.includes("over budget")));
  assert.ok(ranked.find((m) => m.id === "a")!.reasons.includes("similar type"));
  assert.equal(rankMatches(req(), homes, 1, NOW).length, 1);
  for (const m of ranked) assert.ok(m.score >= 0 && m.score <= 100);
});

test("match: stay length comes from months or the two dates", () => {
  assert.equal(wantedMonths(req({ stayMonths: 4 })), 4);
  assert.equal(wantedMonths(req()), 6);
  assert.equal(wantedMonths(req({ moveOut: "2026-09-01" })), null);
  assert.equal(wantedMonths(req({ moveOut: null })), null);
});

test("match: scores never read anything about who the renter is", () => {
  const withExtras = { ...req(), name: "Anyone", email: "x@y.z", message: "family with kids", source: "fb_ad" } as MatchRequest;
  assert.deepEqual(scoreMatch(withExtras, home(), NOW), scoreMatch(req(), home(), NOW));
});

test("shortlist: {{homes}} is replaced, content is escaped, and the safety note is in the default", () => {
  process.env.NEXT_PUBLIC_APP_URL ||= "https://rentleaks.test";
  const body = defaultShortlistBody("Ana Diaz", 1);
  assert.ok(body.startsWith("Hi Ana,"));
  assert.ok(body.includes(SAFETY_NOTE));
  const homes = [{ id: "L1", title: "Sunny <room>", neighborhood: "Astoria", cityName: "New York", allIn: 1200, currency: "USD", housingType: "room", image: "", availableFrom: "2026-10-01", minStayMonths: 1 }];
  const out = renderShortlist("lead1", body, homes);
  assert.ok(!out.text.includes("{{homes}}"));
  assert.ok(out.text.includes("Sunny <room>"));
  assert.ok(!out.html.includes("Sunny <room>"), "html escapes titles");
  assert.ok(out.html.includes("/go/s/"), "links are tracked and signed");
  const appended = renderShortlist("lead1", "Hello", homes);
  assert.ok(appended.text.startsWith("Hello\n\n"));
});

/* ---- Signed links ------------------------------------------------------- */

test("links: round-trip, reject tampering, wrong key and expiry", () => {
  const exp = new Date(NOW + DAY);
  const token = signLink(["f", "L1", "available"], exp, "k1");
  assert.deepEqual(readLink(token, NOW, "k1"), ["f", "L1", "available"]);
  assert.equal(readLink(token, NOW, "k2"), null);
  assert.equal(readLink(token, NOW + 2 * DAY, "k1"), null);
  const [head, sig] = token.split(".");
  const forged = Buffer.from(Buffer.from(head, "base64url").toString().replace("available", "rented")).toString("base64url");
  assert.equal(readLink(`${forged}.${sig}`, NOW, "k1"), null);
  assert.equal(readLink("", NOW, "k1"), null);
  assert.equal(readLink("garbage", NOW, "k1"), null);
});

/* ---- Speed to lead ------------------------------------------------------ */

test("sla: marks at 5 minutes, an hour and a day; answered leads show how long it took", () => {
  const at = (mins: number) => ({ status: "new", createdAt: new Date(NOW - mins * 60_000), contactedAt: null });
  assert.equal(slaOf(at(2), NOW).stage, "fresh");
  assert.equal(slaOf(at(30), NOW).stage, "hour");
  assert.equal(slaOf(at(300), NOW).stage, "day");
  assert.equal(slaOf(at(3000), NOW).stage, "late");
  assert.equal(slaOf(at(3000), NOW).tone, "bad");
  const answered = slaOf({ status: "contacted", createdAt: new Date(NOW - 90 * 60_000), contactedAt: new Date(NOW - 60 * 60_000) }, NOW);
  assert.equal(answered.stage, "answered");
  assert.equal(answered.label, "answered in 30m");
  assert.equal(ageLabel(0.2), "now");
  assert.equal(ageLabel(150), "2h");
  assert.equal(ageLabel(3 * 1440), "3d");
  assert.equal(median([]), null);
  assert.equal(median([4, 1, 3]), 3);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

/* ---- Trust radar -------------------------------------------------------- */

test("trust: copied text scores high, different text low; addresses normalise", () => {
  const a = shingles("Bright furnished room in a quiet Astoria apartment close to the N train and parks");
  const b = shingles("BRIGHT furnished room in a quiet Astoria apartment, close to the N train and parks!");
  const c = shingles("Spacious studio with a private terrace in downtown Brooklyn near many restaurants");
  assert.ok(jaccard(a, b) >= 0.9);
  assert.ok(jaccard(a, c) < 0.1);
  assert.equal(jaccard(new Set(), a), 0);
  assert.equal(normaliseAddress("12 Main Street, Apt 4B"), normaliseAddress("12 main st"));
  assert.equal(normaliseAddress("5 Park Avenue"), "5 park ave");
  assert.equal(medianOf([]), 0);
  assert.equal(medianOf([3, 1, 2]), 2);
});

/* ---- Freshness ------------------------------------------------------------ */

test("freshness: fresh → due → stale; asked → silent after 7 days; an answer resets", () => {
  const l = (postedDays: number, confirmedDays: number | null, askedDays: number | null) => ({
    postedAt: new Date(NOW - postedDays * DAY),
    confirmedAt: confirmedDays === null ? null : new Date(NOW - confirmedDays * DAY),
    freshnessAskedAt: askedDays === null ? null : new Date(NOW - askedDays * DAY),
    updatedAt: new Date(NOW),
  });
  assert.equal(freshnessOf(l(3, null, null), NOW).state, "fresh");
  assert.equal(freshnessOf(l(20, null, null), NOW).state, "due");
  assert.equal(freshnessOf(l(40, null, null), NOW).state, "stale");
  assert.equal(freshnessOf(l(40, 2, null), NOW).state, "fresh");
  assert.equal(freshnessOf(l(20, null, 2), NOW).state, "asked");
  assert.equal(freshnessOf(l(30, null, 8), NOW).state, "silent");
  assert.equal(freshnessOf(l(30, 1, 8), NOW).state, "fresh", "confirmed after the ask");
});

/* ---- Bookings ------------------------------------------------------------- */

test("bookings: stages, renewal window, slots and wall-clock times", () => {
  assert.ok(isStage("moved_in"));
  assert.ok(!isStage("drop table"));
  assert.equal(daysToMoveOut("2026-09-30", NOW), 10);
  assert.equal(daysToMoveOut("bad", NOW), null);
  assert.ok(renewalDue({ stage: "moved_in", moveOut: "2026-11-01" }, NOW));
  assert.ok(!renewalDue({ stage: "moved_in", moveOut: "2027-06-01" }, NOW), "too far out");
  assert.ok(!renewalDue({ stage: "viewing", moveOut: "2026-11-01" }, NOW), "not an active stay");
  assert.ok(!renewalDue({ stage: "signed", moveOut: "2026-09-01" }, NOW), "already past");
  assert.deepEqual(parseSlots('[{"date":"2026-10-02","window":"evening"},{"date":"x"}]'), [{ date: "2026-10-02", window: "evening" }]);
  assert.deepEqual(parseSlots("not json"), []);
  const d = wallClock("2026-09-20T14:30");
  assert.ok(d);
  assert.equal(d.toISOString(), "2026-09-20T14:30:00.000Z");
  assert.match(wallLabel(d), /Sep 20.*2:30/);
  assert.equal(wallClock("2026-09-20 14:30"), null);
});

/* ---- Demand map ----------------------------------------------------------- */

test("demand: gaps count renters above affordable supply, per city and type", () => {
  const wants = [
    { cityId: "nyc", type: "room", maxUsd: 1000, source: "request" as const },
    { cityId: "nyc", type: "room", maxUsd: 1200, source: "search" as const },
    { cityId: "nyc", type: "room", maxUsd: 1400, source: "request" as const },
    { cityId: "nyc", type: null, maxUsd: null, source: "search" as const },
    { cityId: "sf", type: "studio", maxUsd: 3000, source: "request" as const },
  ];
  const haves = [
    { cityId: "nyc", type: "room", usd: 1100 },
    { cityId: "nyc", type: "room", usd: 2000 },
    { cityId: "sf", type: "studio", usd: 2500 },
  ];
  const cells = buildCells(wants, haves);
  const room = cells.find((c) => c.cityId === "nyc" && c.type === "room")!;
  assert.equal(room.demand, 3);
  assert.equal(room.budget, 1200);
  assert.equal(room.supply, 2);
  assert.equal(room.affordable, 1);
  assert.equal(room.gap, 2);
  const any = cells.find((c) => c.type === "any")!;
  assert.equal(any.supply, 2, "typeless demand counts every home in the city");
  assert.equal(any.gap, 0);
  assert.equal(cells.find((c) => c.cityId === "sf")!.gap, 0);
  assert.equal(cells[0], room, "biggest gap first");
  assert.equal(bandOf(999), "lt1000");
  assert.equal(bandOf(1000), "1000");
  assert.equal(bandOf(9000), "3000");
});

/* ---- Host scorecards ------------------------------------------------------ */

test("hosts: reply stats use the first host answer after the renter's first message", () => {
  const m = (sender: string, mins: number) => ({ senderId: sender, createdAt: new Date(NOW + mins * 60_000) });
  const stats = replyStats([
    { hostId: "h", messages: [m("r1", 0), m("h", 30)] },
    { hostId: "h", messages: [m("r2", 0), m("r2", 5), m("h", 90)] },
    { hostId: "h", messages: [m("r3", 0)] },
    { hostId: "h", messages: [m("h", 0)] },
  ]);
  assert.equal(stats.threads, 3, "host-only threads don't count");
  assert.equal(stats.replyRate, 67);
  assert.equal(stats.replyMins, 60);
  assert.deepEqual(replyStats([]), { threads: 0, replyRate: null, replyMins: null });
});

test("hosts: grade, weakest part and the nudge that goes with it", () => {
  assert.equal(speedScore(null), 60);
  assert.equal(speedScore(30), 100);
  assert.equal(speedScore(5000), 20);
  assert.equal(gradeOf(90), "A");
  assert.equal(gradeOf(54), "D");
  const good = scoreHost({ quality: 100, freshPct: 100, replyRate: 100, replyMins: 20 });
  assert.equal(good.grade, "A");
  assert.equal(good.weakest, null);
  const slow = scoreHost({ quality: 100, freshPct: 90, replyRate: 95, replyMins: 3000 });
  assert.equal(slow.weakest, "speed");
  const n = nudgeDraft({ name: "Sam Lee", weakest: "quality", homes: [{ id: "1", title: "Loft", live: true, quality: 60, fresh: "fresh", failing: ["Four real photos"] }], replyMins: null, replyRate: null }, "https://x.test");
  assert.ok(n.body.startsWith("Hi Sam,"));
  assert.ok(n.body.includes("Loft: Four real photos"));
  assert.ok(n.body.includes("https://x.test/account"));
});

/* ---- Playbooks ------------------------------------------------------------ */

test("playbooks: merge fills known fields and blanks unknown ones; recipes are valid", () => {
  assert.equal(merge("Hi {{first_name}}, {{ city }}{{nope}}!", { first_name: "Ana", city: "Queens" }), "Hi Ana, Queens!");
  for (const r of RECIPES) {
    assert.ok(isTrigger(r.trigger), r.id);
    assert.ok(isAction(r.action), r.id);
    if (r.action === "send_email") assert.ok(r.subject && r.body.length > 20, r.id);
    assert.doesNotMatch(`${r.subject} ${r.body}`, /\{\{(?!first_name|name|city|home|date|link)[a-z_]+\}\}/, `${r.id} only uses known fields`);
  }
  assert.equal(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length);
  assert.ok(!isTrigger("__proto__"));
  assert.ok(!isTrigger("toString"));
  assert.equal(Object.keys(TRIGGERS).length, 10);
  assert.equal(waitLabel(45), "45 min");
  assert.equal(waitLabel(120), "2 h");
  assert.equal(waitLabel(1440), "1 day");
});

/* ---- Morning brief -------------------------------------------------------- */

test("brief: New York clock, due once per day inside the chosen hour window", () => {
  const summer = new Date("2026-07-01T11:30:00Z"); // 7:30 EDT
  assert.deepEqual(nyClock(summer), { hour: 7, date: "2026-07-01" });
  const winter = new Date("2026-01-15T12:10:00Z"); // 7:10 EST
  assert.equal(nyClock(winter).hour, 7);
  const lateUtc = new Date("2026-07-02T02:00:00Z"); // 22:00 on July 1 in NY
  assert.equal(nyClock(lateUtc).date, "2026-07-01");
  assert.ok(briefDue({ briefHour: 7, briefLastSentAt: null }, summer));
  assert.ok(!briefDue({ briefHour: 8, briefLastSentAt: null }, summer), "before the hour");
  assert.ok(!briefDue({ briefHour: null, briefLastSentAt: null }, summer), "off");
  assert.ok(!briefDue({ briefHour: 7, briefLastSentAt: new Date("2026-07-01T11:05:00Z") }, summer), "already sent today");
  assert.ok(briefDue({ briefHour: 7, briefLastSentAt: new Date("2026-06-30T11:05:00Z") }, summer));
  assert.ok(briefDue({ briefHour: 5, briefLastSentAt: null }, summer), "a missed tick still sends within two hours");
  assert.ok(!briefDue({ briefHour: 4, briefLastSentAt: null }, summer), "more than two hours late: skip the day");
});
