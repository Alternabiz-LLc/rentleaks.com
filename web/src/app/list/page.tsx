import Link from "next/link";
import { createListingAction } from "@/app/actions/listings";
import { Shell } from "@/components/Shell";
import { getCurrentUser } from "@/lib/auth";
import { FEATURED_MONTHLY, FEATURED_WEEKLY, MONTHLY_PLAN, WEEKLY_PLAN } from "@/lib/billing";
import { CITIES, HOUSING_TYPES } from "@/lib/catalog";

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;

  return (
    <Shell>
      <section className="rl-auth">
        <h1>List a place</h1>
        <p>Writes a live listing to Postgres. It appears on the map and the public listing page immediately.</p>
        {!user ? (
          <p>
            <Link className="rl-cta" href="/login?next=/list">
              Sign in to list
            </Link>
          </p>
        ) : (
          <form action={createListingAction} className="rl-form">
            {params.error === "invalid" ? (
              <p className="rl-error">Add a title, city, neighborhood, address, and description.</p>
            ) : null}
            <label>
              Stay type
              <select name="housingType" defaultValue="room">
                {HOUSING_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              City
              <select name="cityId" defaultValue="nyc">
                {CITIES.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}, {city.state}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input name="title" required placeholder="Private room near the G train" />
            </label>
            <label>
              Neighborhood
              <input name="neighborhood" required placeholder="Williamsburg" />
            </label>
            <label>
              Address
              <input name="address" required placeholder="184 Berry St, Brooklyn, NY" />
            </label>
            <label>
              Monthly rent (USD)
              <input name="price" type="number" min={1} defaultValue={1450} required />
            </label>
            <label>
              Utilities not included (USD)
              <input name="utilities" type="number" min={0} defaultValue={0} />
            </label>
            <div className="rl-form__row">
              <label>
                Beds
                <input name="beds" type="number" min={1} defaultValue={1} />
              </label>
              <label>
                Baths
                <input name="baths" type="number" min={1} step={0.5} defaultValue={1} />
              </label>
              <label>
                Sqft
                <input name="sqft" type="number" min={80} defaultValue={220} />
              </label>
            </div>
            <label>
              Minimum stay (months)
              <input name="minStayMonths" type="number" min={1} defaultValue={1} />
            </label>
            <label>
              Available from
              <input name="availableFrom" type="date" defaultValue="2026-09-15" />
            </label>
            <label>
              Furnished
              <select name="furnishedLevel" defaultValue="fully">
                <option value="fully">Fully furnished</option>
                <option value="partial">Partial</option>
                <option value="unfurnished">Unfurnished</option>
              </select>
            </label>
            <label>
              Description
              <textarea name="description" rows={5} required placeholder="Who it is for, what is included, and move-in timing." />
            </label>
            <fieldset className="rl-addon">
              <legend>Optional extra</legend>
              <label className="rl-addon__check">
                <input type="checkbox" name="featured" value="1" />
                <span>
                  <strong>Sponsored placement</strong> {FEATURED_WEEKLY.label} or {FEATURED_MONTHLY.label}
                  <em>
                    {FEATURED_WEEKLY.blurb}. Listing fee stays {WEEKLY_PLAN.label} or {MONTHLY_PLAN.label}.
                    Lease-break posts stay free to publish.
                  </em>
                </span>
              </label>
            </fieldset>
            <button className="rl-cta" type="submit">
              Publish to map
            </button>
          </form>
        )}
      </section>
    </Shell>
  );
}
