import Link from "next/link";
import { CITIES, HOUSING_TYPES } from "@/lib/catalog";
import type { BrowseListing } from "@/lib/listings";
import { money } from "@/lib/site";
import { HomeHeroCarousel } from "./HomeHeroCarousel";

/**
 * The home hero, built on the same chassis as the browse heroes.
 *
 * It used to be a pale band with a tinted radial behind it, which meant the
 * front door was the quietest page on the site — you arrived at RentLeaks,
 * then clicked Rooms and got a photograph twice the size. Same component
 * family now: same height, same scrim, same category rail, so moving between
 * home and a filtered browse page reads as one product.
 *
 * The search card stays white and sits on the dark band. That contrast is
 * doing work — on a page whose whole argument is "the number you see is the
 * number you pay", the search control should be the brightest object on it.
 */

const HERO = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2000&q=75";

export function HomeHero({
  listingCount,
  cityCount,
  medianAllIn = 0,
  leaseBreakCount = 0,
  slides = [],
  cityId = "",
  housingType = "",
  q = "",
  max = "",
  stay = "",
}: {
  listingCount: number;
  cityCount: number;
  medianAllIn?: number;
  leaseBreakCount?: number;
  slides?: BrowseListing[];
  cityId?: string;
  housingType?: string;
  q?: string;
  max?: string;
  stay?: string;
}) {
  const usCities = CITIES.filter((city) => city.rank <= 31);
  const euCities = CITIES.filter((city) => city.rank > 31);

  return (
    <>
      <section
        className={slides.length ? "rl-shero rl-shero--home rl-shero--reel" : "rl-shero rl-shero--home"}
        aria-labelledby="rl-hero-title"
      >
        {slides.length ? (
          <HomeHeroCarousel slides={slides} fill />
        ) : (
          <div className="rl-shero__media" role="presentation" style={{ backgroundImage: `url("${HERO}")` }} />
        )}
        <div className="rl-shero__inner">
          <p className="rl-shero__kicker">U.S. + Europe · 30-day minimum</p>
          <h1 className="rl-shero__title" id="rl-hero-title">
            Find a place to live — not a night to book
          </h1>
          <p className="rl-shero__lede">
            Rooms, co-living buildings, furnished apartments, 1-month+ stays, and lease-breaks. Every price is all-in.
            Every short stay starts at 30 days.
          </p>

          <dl className="rl-shero__stats">
            <div>
              <dt>Live homes</dt>
              <dd>{listingCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Markets</dt>
              <dd>{cityCount}</dd>
            </div>
            {medianAllIn ? (
              <div>
                <dt>Median all-in</dt>
                <dd>
                  {money(medianAllIn)}
                  <span> /mo</span>
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Lease-breaks</dt>
              <dd>
                {leaseBreakCount}
                <span> free to post</span>
              </dd>
            </div>
          </dl>

          <form className="rl-search" action="/stays" method="get" aria-label="Search flexible housing">
            <label className="rl-search__field">
              <span>City</span>
              <select name="city" defaultValue={cityId}>
                <option value="">All cities</option>
                <optgroup label="United States">
                  {usCities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Europe">
                  {euCities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label className="rl-search__field">
              <span>Stay type</span>
              <select name="type" defaultValue={housingType}>
                <option value="">All stay types</option>
                {HOUSING_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="rl-search__field rl-search__field--grow">
              <span>Neighborhood</span>
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Williamsburg, Brickell, Mission…"
                aria-label="Neighborhood or keyword"
              />
            </label>
            <label className="rl-search__field rl-search__field--max">
              <span>All-in max</span>
              <input type="number" name="max" defaultValue={max} min={0} placeholder="Max $" />
            </label>
            <label className="rl-search__field">
              <span>Stay length</span>
              <select name="stay" defaultValue={stay}>
                <option value="">Any length</option>
                <option value="1">1 month ok</option>
                <option value="3">Up to 3 months</option>
                <option value="6">Up to 6 months</option>
                <option value="12">Up to 12 months</option>
              </select>
            </label>
            <button className="rl-cta rl-search__go" type="submit">
              Search
            </button>
          </form>

          <p className="rl-shero__hint">
            Short-term means 30 days or more. <Link href="/list">Post a lease-break free</Link>.
          </p>
        </div>

        <nav className="rl-shero__types" aria-label="Housing type">
          <Link className="rl-shero__type" href="/stays">
            All stays
          </Link>
          {HOUSING_TYPES.map((type) => (
            <Link className="rl-shero__type" href={`/stays?type=${type.id}`} key={type.id}>
              {type.label}
            </Link>
          ))}
        </nav>
      </section>
    </>
  );
}
