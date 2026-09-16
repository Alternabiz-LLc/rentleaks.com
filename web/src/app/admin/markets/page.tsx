import Link from "next/link";
import { saveCity, saveOperator } from "@/app/admin/_actions/markets";
import { flashOf, PageHead, readParams, Section, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Markets & operators — RentLeaks admin" };

export default async function MarketsAdmin({ searchParams }: { searchParams: SP }) {
  await requireAdminPage();
  const p = await readParams(searchParams);
  const [cities, counts, operators, opCounts] = await Promise.all([
    prisma.city.findMany({ orderBy: [{ rank: "asc" }] }),
    prisma.listing.groupBy({ by: ["cityId"], _count: { _all: true } }),
    prisma.operator.findMany({ orderBy: { name: "asc" } }),
    prisma.listing.groupBy({ by: ["operatorId"], _count: { _all: true } }),
  ]);
  const n = new Map(counts.map((c) => [c.cityId, c._count._all]));
  const on = new Map(opCounts.map((c) => [c.operatorId, c._count._all]));

  return (
    <>
      <PageHead
        title="Markets & operators"
        sub="Ranking, featured markets and the local medians behind the Leak Score. Re-running the catalogue seed resets these to rentleaks.com's data.js."
        flash={flashOf(p)}
      />
      <Section title={`Markets · ${cities.length}`}>
        <div className="a-scroll">
          <table className="a-table adm-table">
            <thead>
              <tr><th>Market</th><th>Listings</th><th>Rank</th><th>Median room</th><th>Median furnished</th><th>Featured</th><th /></tr>
            </thead>
            <tbody>
              {cities.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/listings?city=${c.id}`}>{c.name}</Link> <span className="a-dim">{c.countryName} · {c.currency}</span>
                  </td>
                  <td>{n.get(c.id) || 0}</td>
                  <td colSpan={5}>
                    <form action={saveCity} className="adm-inline">
                      <input type="hidden" name="id" value={c.id} />
                      <input name="rank" type="number" min={1} defaultValue={c.rank} aria-label="Rank" className="adm-num" />
                      <input name="avgRoom" type="number" min={0} defaultValue={c.avgRoom} aria-label="Median room" className="adm-num" />
                      <input name="avgFurnished" type="number" min={0} defaultValue={c.avgFurnished} aria-label="Median furnished" className="adm-num" />
                      <label className="adm-check"><input name="featured" type="checkbox" defaultChecked={c.featured} /> featured</label>
                      <button className="btn btn--outline" type="submit">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={`Operators · ${operators.length}`} id="operators" sub="Landlords, portfolios and co-living brands shown on listing pages.">
        <form action={saveOperator} className="adm-inline adm-card">
          <input name="name" placeholder="New operator name" required />
          <select name="kind" defaultValue="landlord">
            <option value="landlord">Landlord</option>
            <option value="portfolio">Portfolio</option>
            <option value="coliving">Co-living</option>
          </select>
          <input name="tagline" placeholder="Tagline" />
          <input name="scope" placeholder="Where they operate" />
          <input name="since" type="number" placeholder="Since" className="adm-num" />
          <button className="btn btn--primary" type="submit">Add operator</button>
        </form>
        <div className="a-scroll">
          <table className="a-table adm-table">
            <tbody>
              {operators.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/listings?q=${encodeURIComponent(o.name)}`}>{on.get(o.id) || 0} listings</Link></td>
                  <td>
                    <form action={saveOperator} className="adm-inline">
                      <input type="hidden" name="id" value={o.id} />
                      <input name="name" defaultValue={o.name} aria-label="Name" />
                      <select name="kind" defaultValue={o.kind} aria-label="Kind">
                        <option value="landlord">Landlord</option>
                        <option value="portfolio">Portfolio</option>
                        <option value="coliving">Co-living</option>
                      </select>
                      <input name="tagline" defaultValue={o.tagline} aria-label="Tagline" />
                      <input name="scope" defaultValue={o.scope} aria-label="Scope" />
                      <input name="since" type="number" defaultValue={o.since ?? ""} aria-label="Since" className="adm-num" />
                      <button className="btn btn--outline" type="submit">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
