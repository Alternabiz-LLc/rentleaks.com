import Link from "next/link";
import { CITIES, HOUSING_TYPES } from "@/lib/catalog";
import { money } from "@/lib/site";

/**
 * The browse hero.
 *
 * Elliman's rentals page puts a photographic band above the results with a
 * line of copy in it and nothing else. The band is the right idea — a wall of
 * cards with no opening reads like a spreadsheet — but an image and a slogan
 * is a wasted six hundred pixels. This one carries the same weight visually
 * and answers the three questions someone arriving on a filtered URL actually
 * has: how many homes are here, what they cost, and what the other four
 * categories are.
 *
 * Every figure is computed from the rows being rendered below it. If the
 * filter returns eleven homes, the hero says eleven.
 */

type Row = {
  allIn: number;
  allInUsd: number;
  cityId: string;
  minStayMonths: number;
  neighborhood: string;
  housingType: string;
  noFee: boolean;
  verified: boolean;
};

const shot = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=2000&q=75`;

const COPY: Record<
  string,
  { kicker: string; title: string; lede: string; image: string }
> = {
  "": {
    kicker: "Every category · 30-day minimum",
    title: "Somewhere to live, not somewhere to stay",
    lede:
      "Rooms, co-living, furnished apartments, month-plus stays and lease-breaks — in one place, at one honest price. The number on the card is the number you pay.",
    image: shot("photo-1502672260266-1c1ef2d93688"),
  },
  room: {
    kicker: "Rooms",
    title: "A room in a real home, priced all-in",
    lede:
      "Someone already lives here and is letting a room. You will see who, what the house runs like, and every recurring charge folded into the headline figure before you enquire.",
    image: shot("photo-1505693416388-ac5ce068fe85"),
  },
  coliving: {
    kicker: "Co-living",
    title: "Co-living, with the house rules stated up front",
    lede:
      "Purpose-built shared buildings: your own room, professionally run common space, one bill. The trade you are making is privacy for convenience, so we show you exactly what is shared.",
    image: shot("photo-1560448204-e02f11c3d0e2"),
  },
  furnished: {
    kicker: "Furnished",
    title: "Move in with a suitcase",
    lede:
      "Furnished apartments let on ordinary residential terms rather than by the night. Beds, kitchen, Wi-Fi and utilities accounted for — and the furnished surcharge, where a market caps one, checked against the rule.",
    image: shot("photo-1493809842364-78817add7ccb"),
  },
  "short-term": {
    kicker: "1-month+",
    title: "From one month. Never one night",
    lede:
      "Thirty days is the floor here, and in several markets it is the law. That single rule is what separates housing from hospitality, and it is why these homes are not competing with hotels for your money.",
    image: shot("photo-1522708323590-d24dbb6b0267"),
  },
  "lease-break": {
    kicker: "Lease-break · free to post",
    title: "Take over a lease someone has to leave",
    lede:
      "A tenant is leaving early and needs someone to take the rest. Often below market, always time-sensitive — and every one here comes with the takeover desk: consent status, the statutory clock, and what may lawfully be charged.",
    image: shot("photo-1536376072261-38c75010e6c9"),
  },
};

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function StaysHero({
  rows,
  housingType = "",
  cityId = "",
  q = "",
  max = "",
  stay = "",
}: {
  rows: Row[];
  housingType?: string;
  cityId?: string;
  q?: string;
  max?: string;
  stay?: string;
}) {
  const copy = COPY[housingType] || COPY[""];
  const city = CITIES.find((c) => c.id === cityId);

  const markets = new Set(rows.map((r) => r.cityId)).size;
  const areas = new Set(rows.map((r) => r.neighborhood).filter(Boolean)).size;
  const medianAllIn = median(rows.map((r) => r.allInUsd || r.allIn).filter((n) => n > 0));
  const medianStay = median(rows.map((r) => r.minStayMonths).filter((n) => n > 0));
  const noFee = rows.filter((r) => r.noFee).length;

  /* Keep the other filters when switching category — losing a budget or a
     city because you tapped a different type is the kind of small rudeness
     that makes people re-enter everything and leave. */
  function href(type: string) {
    const params = new URLSearchParams();
    if (cityId) params.set("city", cityId);
    if (type) params.set("type", type);
    if (q) params.set("q", q);
    if (max) params.set("max", max);
    if (stay) params.set("stay", stay);
    const query = params.toString();
    return query ? `/stays?${query}` : "/stays";
  }

  const title = city ? `${copy.title.replace(/\.$/, "")} — in ${city.name}` : copy.title;

  return (
    <section className="rl-shero" aria-labelledby="rl-shero-title">
      {/* Decorative: the copy carries the meaning, so the image gets no alt. */}
      <div
        className="rl-shero__media"
        role="presentation"
        style={{ backgroundImage: `url("${copy.image}")` }}
      />
      <div className="rl-shero__inner">
        <p className="rl-shero__kicker">
          {copy.kicker}
          {city ? ` · ${city.name}, ${city.state}` : ""}
        </p>
        <h1 className="rl-shero__title" id="rl-shero-title">
          {title}
        </h1>
        <p className="rl-shero__lede">{copy.lede}</p>

        {rows.length ? (
          <dl className="rl-shero__stats">
            <div>
              <dt>Homes matching</dt>
              <dd>{rows.length.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Median all-in</dt>
              <dd>{money(medianAllIn)}<span> /mo</span></dd>
            </div>
            <div>
              <dt>{cityId ? "Neighbourhoods" : "Markets"}</dt>
              <dd>{cityId ? areas : markets}</dd>
            </div>
            <div>
              <dt>Typical minimum stay</dt>
              <dd>{medianStay || 1}<span> {medianStay === 1 ? "month" : "months"}</span></dd>
            </div>
            <div>
              <dt>No tenant fee</dt>
              <dd>{noFee}<span> of {rows.length}</span></dd>
            </div>
          </dl>
        ) : (
          <p className="rl-shero__stats rl-shero__stats--empty">
            Nothing matches these filters yet. Widen the budget or clear the city — every category below is live.
          </p>
        )}
      </div>

      <nav className="rl-shero__types" aria-label="Housing type">
        <Link className="rl-shero__type" data-on={housingType === "" ? "1" : undefined} href={href("")}>
          All stays
        </Link>
        {HOUSING_TYPES.map((t) => (
          <Link
            className="rl-shero__type"
            data-on={housingType === t.id ? "1" : undefined}
            href={href(t.id)}
            key={t.id}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
