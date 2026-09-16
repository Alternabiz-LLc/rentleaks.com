import { getCurrentUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import ListingComposer from "@/components/ListingComposer";
import { createListingFromComposer } from "@/app/actions/listings";
import { prisma } from "@/lib/prisma";

/* Cities come from the database: render per request, never at build time. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "List a place — RentLeaks",
  description:
    "Publish a room, a co-living bed, a furnished apartment, a 1-month+ stay or a lease-break. Itemised fees, a real availability window, and the market's own rules checked as you go.",
};

const HOUSING_TYPES = [
  { id: "room", label: "Rooms" },
  { id: "coliving", label: "Co-living" },
  { id: "furnished", label: "Furnished" },
  { id: "short-term", label: "1-month+" },
  { id: "aparthotel", label: "Aparthotel" },
  { id: "lease-break", label: "Lease-break" },
];

export default async function ListPage() {
  const user = await getCurrentUser();
  const onTrial = user?.trialEndsAt && user.trialEndsAt > new Date() ? user.trialEndsAt : null;
  const cities = await prisma.city.findMany({
    orderBy: [{ rank: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, state: true, country: true, currency: true },
  });

  return (
    <Shell>
      <section className="container page-hero">
        <h1>List a place</h1>
        <p>
          Writes a live listing to the database — it appears on the map and on the public listing page immediately.
          Lease-breaks publish free. Everything else carries an all-in price, so renters see the real number rather
          than a base rent with the fees hidden behind it.
        </p>
        {onTrial ? (
          <p className="adm-flash adm-flash--ok">
            Your free trial is active until {onTrial.toISOString().slice(0, 10)} — listings you publish now carry no fee
            until then.
          </p>
        ) : null}
      </section>
      <section className="rl-page">
        <div className="container">
          <ListingComposer cities={cities} housingTypes={HOUSING_TYPES} action={createListingFromComposer} />
        </div>
      </section>
    </Shell>
  );
}
