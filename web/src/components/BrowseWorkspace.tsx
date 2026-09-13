"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CITIES, HOUSING_TYPES } from "@/lib/catalog";
import type { BrowseListing } from "@/lib/listings";
import { toMapPin } from "@/lib/listings";
import { ListingCard } from "./ListingCard";
import { ListingMap } from "./ListingMap";

type View = "list" | "split" | "map";
type Sort = "newest" | "price-asc" | "price-desc";

function asView(value?: string): View {
  if (value === "list" || value === "map" || value === "split") return value;
  return "split";
}

export function BrowseWorkspace({
  listings,
  cityId = "",
  housingType = "",
  q = "",
  max = "",
  stay = "",
  view: initialView = "split",
}: {
  listings: BrowseListing[];
  cityId?: string;
  housingType?: string;
  q?: string;
  max?: string;
  stay?: string;
  view?: string;
}) {
  const router = useRouter();
  const view = asView(initialView);
  const [sort, setSort] = useState<Sort>("newest");
  const [activeId, setActiveId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const copy = listings.slice();
    copy.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (sort === "price-asc") return a.allIn - b.allIn;
      if (sort === "price-desc") return b.allIn - a.allIn;
      return 0;
    });
    return copy;
  }, [listings, sort]);
  const pinned = rows.filter((listing) => listing.featured).slice(0, 4);
  const rest = rows.filter((listing) => !listing.featured);

  const pins = rows.map(toMapPin);
  const usCities = CITIES.filter((city) => city.rank <= 31);
  const euCities = CITIES.filter((city) => city.rank > 31);

  function queryFor(next: View) {
    const params = new URLSearchParams();
    if (cityId) params.set("city", cityId);
    if (housingType) params.set("type", housingType);
    if (q) params.set("q", q);
    if (max) params.set("max", max);
    if (stay) params.set("stay", stay);
    if (next !== "split") params.set("view", next);
    return params.toString();
  }

  function setView(next: View) {
    const query = queryFor(next);
    router.replace(query ? `/stays?${query}` : "/stays", { scroll: false });
  }

  function onSelectPin(id: string) {
    setActiveId(id);
    document.getElementById(`stay-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="rl-browse" id="stays" data-view={view}>
      <section className="rl-browse__list" aria-label="Stay list">
        <header className="rl-browse__head">
          <div>
            <p className="rl-kicker">Live stays</p>
            <h1>{rows.length} homes</h1>
          </div>
          <div className="rl-view" role="group" aria-label="Layout">
            <button type="button" className={view === "list" ? "is-on" : ""} onClick={() => setView("list")}>
              List
            </button>
            <button type="button" className={view === "split" ? "is-on" : ""} onClick={() => setView("split")}>
              Split
            </button>
            <button type="button" className={view === "map" ? "is-on" : ""} onClick={() => setView("map")}>
              Map
            </button>
          </div>
        </header>

        <form className="rl-filters" method="get" action="/stays">
          {view !== "split" ? <input type="hidden" name="view" value={view} /> : null}
          {q ? <input type="hidden" name="q" value={q} /> : null}
          {max ? <input type="hidden" name="max" value={max} /> : null}
          {stay ? <input type="hidden" name="stay" value={stay} /> : null}
          <label>
            City
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
          <label>
            Type
            <select name="type" defaultValue={housingType}>
              <option value="">All stay types</option>
              {HOUSING_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <select
              name="sort"
              value={sort}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "newest" || value === "price-asc" || value === "price-desc") {
                  setSort(value);
                }
              }}
            >
              <option value="newest">Newest</option>
              <option value="price-asc">All-in: low to high</option>
              <option value="price-desc">All-in: high to low</option>
            </select>
          </label>
          <button className="rl-cta" type="submit">
            Apply
          </button>
        </form>

        {pinned.length ? (
          <div className="rl-browse__sponsored">
            <p className="rl-kicker">Sponsored</p>
            <div className="rl-stay-grid">
              {pinned.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  active={activeId === listing.id}
                  onHover={setActiveId}
                />
              ))}
            </div>
          </div>
        ) : null}

        {rest.length ? (
          <div className="rl-stay-grid">
            {rest.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                active={activeId === listing.id}
                onHover={setActiveId}
              />
            ))}
          </div>
        ) : null}
        {rows.length === 0 ? (
          <p className="rl-empty">No stays match yet. Clear a filter or open the full catalog.</p>
        ) : null}
      </section>

      <aside className="rl-browse__map" aria-label="Stay map">
        <ListingMap
          pins={pins}
          selectedId={activeId || undefined}
          onHover={setActiveId}
          onSelect={onSelectPin}
          className="rl-map--full"
        />
      </aside>

      <div className="rl-browse__dock" role="group" aria-label="Mobile layout">
        <button type="button" className={view !== "map" ? "is-on" : ""} onClick={() => setView("list")}>
          List
        </button>
        <button type="button" className={view === "map" ? "is-on" : ""} onClick={() => setView("map")}>
          Map
        </button>
      </div>
    </div>
  );
}
