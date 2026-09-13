import Link from "next/link";
import { redirect } from "next/navigation";
import { HomeHero } from "@/components/HomeHero";
import { ListingCard } from "@/components/ListingCard";
import { Shell } from "@/components/Shell";
import { CITIES, HOUSING_TYPES } from "@/lib/catalog";
import { money } from "@/lib/site";
import { heroSlidePicks, publicListingCount, publicListings, sponsoredListings, toBrowseListing } from "@/lib/listings";

const TYPE_COPY: Record<(typeof HOUSING_TYPES)[number]["id"], string> = {
  room: "A private room in a shared home.",
  coliving: "A building set up for housemates.",
  furnished: "Move-in ready apartments.",
  "short-term": "Thirty days or more. Not hotel nights.",
  "lease-break": "Take over the rest of a lease. Free to post.",
};

function asPositiveInt(value?: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    city?: string;
    type?: string;
    view?: string;
    q?: string;
    max?: string;
    stay?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  if (params.city || params.type || params.view || params.q || params.max || params.stay || params.from || params.to) {
    const query = new URLSearchParams();
    if (params.city) query.set("city", params.city);
    if (params.type) query.set("type", params.type);
    if (params.q) query.set("q", params.q);
    const max = asPositiveInt(params.max);
    if (max) query.set("max", String(max));
    if (params.stay) query.set("stay", params.stay);
    if (params.from) query.set("from", params.from);
    if (params.to) query.set("to", params.to);
    if (params.view) query.set("view", params.view);
    const qs = query.toString();
    redirect(qs ? `/stays?${qs}` : "/stays");
  }

  const [rows, listingCount] = await Promise.all([
    publicListings(),
    publicListingCount(),
  ]);
  const listings = rows.map(toBrowseListing);
  const sponsored = sponsoredListings(listings, 8);
  const slides = heroSlidePicks(listings, 6);
  /* Featured markets, ranked by what is actually in them.
     Two things this replaces. It used to be CITIES.filter(featured).slice(0, 8)
     — a hand-picked constant, so a market with three homes could sit above one
     with two hundred and the visitor found out only after clicking into an
     empty grid. And because every European city sits at rank 32+, the slice cut
     all of them: a visitor in Berlin met an all-American featured block on a
     product that calls itself "U.S. + Europe" two hundred pixels higher up.
     Four and four, ranked by live inventory, with the count and median on the
     card so the click is informed. */
  const byCity = new Map<string, { n: number; prices: number[] }>();
  for (const row of rows) {
    const entry = byCity.get(row.cityId) || { n: 0, prices: [] };
    entry.n += 1;
    const usd = row.allInUsd || row.allIn;
    if (usd > 0) entry.prices.push(usd);
    byCity.set(row.cityId, entry);
  }

  const ranked = CITIES.map((city) => {
    const entry = byCity.get(city.id);
    const prices = (entry?.prices || []).slice().sort((a, b) => a - b);
    return {
      ...city,
      count: entry?.n || 0,
      median: prices.length ? prices[Math.floor(prices.length / 2)] : 0,
      european: city.rank > 31,
    };
  })
    .filter((city) => city.count > 0)
    .sort((a, b) => b.count - a.count);

  const markets = [
    ...ranked.filter((c) => !c.european).slice(0, 4),
    ...ranked.filter((c) => c.european).slice(0, 4),
  ];

  /* Hero figures, from the live set rather than a constant in the markup. */
  const allIns = rows.map((row) => row.allInUsd || row.allIn).filter((n) => n > 0).sort((a, b) => a - b);
  const medianAllIn = allIns.length
    ? allIns.length % 2
      ? allIns[(allIns.length - 1) / 2]
      : Math.round((allIns[allIns.length / 2 - 1] + allIns[allIns.length / 2]) / 2)
    : 0;
  const leaseBreakCount = rows.filter((row) => row.housingType === "lease-break").length;

  return (
    <Shell wide>
      <HomeHero
        listingCount={listingCount}
        cityCount={CITIES.length}
        medianAllIn={medianAllIn}
        leaseBreakCount={leaseBreakCount}
        slides={slides}
      />

      <div className="rl-home">
        {sponsored.length ? (
          <section className="rl-home__block rl-home__block--sponsored" aria-labelledby="rl-sponsored-title">
            <div className="rl-home__row">
              <div>
                <h2 id="rl-sponsored-title">Sponsored listings</h2>
                <p>Paid extra placement. These homes also appear in stay results.</p>
              </div>
              <Link className="rl-ghost" href="/list">
                Feature a listing
              </Link>
            </div>
            <div className="rl-stay-grid">
              {sponsored.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="rl-home__block" aria-labelledby="rl-types-title">
          <h2 id="rl-types-title">Five ways to live here</h2>
          <p>Traditional portals bury rooms and lease-breaks. We start there.</p>
          <div className="rl-type-grid">
            {HOUSING_TYPES.map((type) => (
              <Link key={type.id} className="rl-type-card" href={`/stays?type=${type.id}`}>
                <strong>{type.label}</strong>
                <span>{TYPE_COPY[type.id]}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rl-home__block" aria-labelledby="rl-markets-title">
          <h2 id="rl-markets-title">Featured markets</h2>
          <div className="rl-city-grid">
            {markets.map((city) => (
              <Link key={city.id} className="rl-city-card" href={`/stays?city=${city.id}`}>
                <strong>{city.name}</strong>
                <span>{city.state}</span>
                <em>
                  {city.count} home{city.count === 1 ? "" : "s"}
                  {city.median ? ` · ${money(city.median)} median` : ""}
                </em>
              </Link>
            ))}
          </div>
        </section>

        <section className="rl-home__cta">
          <h2>Leaving early? List the rest of the lease for free.</h2>
          <p>Rooms, furnished operators, and co-living buildings can list too.</p>
          <Link className="rl-cta" href="/list">
            List a place
          </Link>
        </section>
      </div>
    </Shell>
  );
}
