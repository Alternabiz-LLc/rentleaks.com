/**
 * Where sponsored listings go in a result list. One rule for the web app, the
 * mobile API and (mirrored in rentleaks-x.js) the static site:
 *
 * - up to SPONSORED_TOP sponsored listings open the results;
 * - after that, one sponsored listing follows every SPONSORED_EVERY regular ones;
 * - each sponsored listing appears once; if the regular results run out, the
 *   remaining sponsored listings follow them;
 * - the sponsors' order rotates with `sponsorSeed()` (the date and the city, or
 *   "all"), so every paying listing takes its turn at the top.
 *
 * Sponsored listings must already match the search: callers pass them from the
 * same filtered set. With a city chosen, only that city's sponsors appear (a
 * Berlin sponsor never shows in a New York search); with no city, sponsors from
 * every city compete, exactly as the regular results do. The card itself
 * carries the "Sponsored" label.
 *
 * No server imports: safe for client components.
 */
export const SPONSORED_TOP = 3;
export const SPONSORED_EVERY = 6;

export type Slot = { kind: "sponsored"; index: number } | { kind: "organic"; index: number };

/** FNV-1a, enough to shuffle a handful of IDs the same way on server and client. */
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Rotation seed: changes daily (UTC) and differs per city. */
export function sponsorSeed(city?: string | null, now: Date = new Date()) {
  return `${now.toISOString().slice(0, 10)}:${city || "all"}`;
}

export function rotateSponsors<T extends { id: string }>(items: T[], seed: string): T[] {
  return items
    .map((item) => ({ item, key: hash(`${seed}:${item.id}`) }))
    .sort((a, b) => a.key - b.key || (a.item.id < b.item.id ? -1 : 1))
    .map((x) => x.item);
}

/** The order of slots for `organic` regular and `sponsored` paid results. */
export function* slots(organic: number, sponsored: number, top = SPONSORED_TOP, every = SPONSORED_EVERY): Generator<Slot> {
  let s = 0;
  let o = 0;
  for (; s < Math.min(top, sponsored); s++) yield { kind: "sponsored", index: s };
  while (o < organic) {
    yield { kind: "organic", index: o++ };
    if (o % every === 0 && s < sponsored && o < organic) yield { kind: "sponsored", index: s++ };
  }
  for (; s < sponsored; s++) yield { kind: "sponsored", index: s };
}

/** Whole list, for pages that render everything at once. */
export function placeSponsored<T>(organic: T[], sponsored: T[]): Array<{ item: T; sponsored: boolean }> {
  const out: Array<{ item: T; sponsored: boolean }> = [];
  for (const slot of slots(organic.length, sponsored.length)) {
    out.push(
      slot.kind === "sponsored"
        ? { item: sponsored[slot.index], sponsored: true }
        : { item: organic[slot.index], sponsored: false },
    );
  }
  return out;
}

/**
 * One page of the combined list, for paginated APIs: which regular rows to
 * fetch (skip/take) and where the sponsored ones go on this page.
 */
export function pageSlots(page: number, pageSize: number, organic: number, sponsored: number) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const onPage: Slot[] = [];
  let i = 0;
  for (const slot of slots(organic, sponsored)) {
    if (i >= end) break;
    if (i >= start) onPage.push(slot);
    i++;
  }
  const organicIdx = onPage.filter((s) => s.kind === "organic").map((s) => s.index);
  return {
    slots: onPage,
    organicSkip: organicIdx.length ? organicIdx[0] : 0,
    organicTake: organicIdx.length,
    total: organic + sponsored,
    hasMore: end < organic + sponsored,
  };
}
