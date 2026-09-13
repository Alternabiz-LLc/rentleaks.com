import Link from "next/link";
import { redirect } from "next/navigation";
import { HomeHero } from "@/components/HomeHero";
import { ListingCard } from "@/components/ListingCard";
import { Shell } from "@/components/Shell";
import { CITIES, HOUSING_TYPES } from "@/lib/catalog";
import { heroSlidePicks, publicListingCount, publicListings, toBrowseListing } from "@/lib/listings";

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
  }>;
}) {
  const params = await searchParams;
  if (params.city || params.type || params.view || params.q || params.max || params.stay) {
    const query = new URLSearchParams();
    if (params.city) query.set("city", params.city);
    if (params.type) query.set("type", params.type);
    if (params.q) query.set("q", params.q);
    const max = asPositiveInt(params.max);
    if (max) query.set("max", String(max));
    if (params.stay) query.set("stay", params.stay);
    if (params.view) query.set("view", params.view);
    const qs = query.toString();
    redirect(qs ? `/stays?${qs}` : "/stays");
  }

  const [rows, listingCount] = await Promise.all([
    publicListings(),
    publicListingCount(),
  ]);
  const listings = rows.map(toBrowseListing);
  const featured = listings.slice(0, 8);
  const slides = heroSlidePicks(listings, 6);
  const markets = CITIES.filter((city) => city.featured).slice(0, 8);

  return (
    <Shell wide>
      <HomeHero listingCount={listingCount} cityCount={CITIES.length} slides={slides} />

      <div className="rl-home">
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

        <section className="rl-home__block" aria-labelledby="rl-featured-title">
          <div className="rl-home__row">
            <h2 id="rl-featured-title">Featured this week</h2>
            <Link className="rl-ghost" href="/stays">
              See all inventory
            </Link>
          </div>
          <div className="rl-stay-grid">
            {featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
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
