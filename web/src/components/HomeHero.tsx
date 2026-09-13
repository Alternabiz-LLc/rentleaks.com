import { CITIES, HOUSING_TYPES } from "@/lib/catalog";
import type { BrowseListing } from "@/lib/listings";
import { HomeHeroCarousel } from "./HomeHeroCarousel";

export function HomeHero({
  listingCount,
  cityCount,
  slides = [],
  cityId = "",
  housingType = "",
  q = "",
  max = "",
  stay = "",
}: {
  listingCount: number;
  cityCount: number;
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
    <section className="rl-hero" aria-labelledby="rl-hero-title">
      <div className="rl-hero__inner">
        <div className="rl-hero__copy">
          <p className="rl-kicker">U.S. + Europe · 30-day minimum</p>
          <h1 id="rl-hero-title">Find a place to live — not a night to book</h1>
          <p className="rl-hero__lede">
            Rooms, co-living buildings, furnished apartments, 1-month+ stays, and lease-breaks.
            Every price is All-in. Every short stay starts at 30 days.
          </p>
          <div className="rl-trust">
            <span>
              <strong>{listingCount.toLocaleString()}</strong> live homes
            </span>
            <span>
              <strong>{cityCount}</strong> markets
            </span>
            <span>Lease-break posts are free</span>
          </div>
        </div>
        <HomeHeroCarousel slides={slides} />
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
        <p className="rl-hero__hint">
          Short-term means 30 days or more. <a href="/list">Post a lease-break free</a>.
        </p>
      </div>
    </section>
  );
}
