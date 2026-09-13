import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingCard } from "@/components/ListingCard";
import { ListingGallery } from "@/components/ListingGallery";
import { ListingMap } from "@/components/ListingMap";
import { Shell } from "@/components/Shell";
import { listingGallery } from "@/lib/catalog";
import { toBrowseListing, toMapPin } from "@/lib/listings";
import { prisma } from "@/lib/prisma";
import { catalogOrigin, money, typeLabel } from "@/lib/site";

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { city: true, host: { select: { name: true, role: true } } },
  });
  if (!listing) notFound();

  const nearby = await prisma.listing.findMany({
    where: { cityId: listing.cityId, id: { not: listing.id } },
    include: { city: true },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: 4,
  });

  return (
    <Shell wide>
      <article className="rl-listing">
        <nav className="rl-crumb">
          <Link href="/stays">Stays</Link> / {listing.city.name} / {typeLabel(listing.housingType)}
        </nav>
        <ListingGallery
          items={listingGallery({
            id: listing.id,
            image: listing.image,
            title: listing.title,
            neighborhood: listing.neighborhood,
            cityName: listing.city.name,
          })}
        />
        <div className="rl-listing__grid">
          <div>
            <p className="rl-kicker">
              {listing.featured ? "Sponsored · " : ""}
              {typeLabel(listing.housingType)} · {listing.neighborhood}
            </p>
            <h1>{listing.title}</h1>
            <p>{listing.address}</p>
            <p className="rl-lead">{listing.description}</p>
            <dl className="rl-dl">
              <div>
                <dt>All-in</dt>
                <dd>{money(listing.allIn)} /mo</dd>
              </div>
              <div>
                <dt>Base rent</dt>
                <dd>{money(listing.price)}</dd>
              </div>
              <div>
                <dt>Deposit</dt>
                <dd>{money(listing.deposit)}</dd>
              </div>
              <div>
                <dt>Available</dt>
                <dd>{listing.availableFrom}</dd>
              </div>
              <div>
                <dt>Minimum stay</dt>
                <dd>{listing.minStayMonths} month(s)</dd>
              </div>
              <div>
                <dt>Beds / baths</dt>
                <dd>
                  {listing.beds} / {listing.baths}
                </dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{listing.sqft} sqft</dd>
              </div>
              <div>
                <dt>Furnished</dt>
                <dd>{listing.furnishedLevel}</dd>
              </div>
            </dl>
            <p>
              Host {listing.host.name} · {listing.verified ? "Verified" : "Pending review"}
            </p>
            <p>
              <a className="rl-ghost" href={`${catalogOrigin()}/apply.html?id=${encodeURIComponent(listing.id)}`}>
                Apply on the public catalog
              </a>
            </p>
          </div>
          <ListingMap
            pins={[toMapPin(listing), ...nearby.map(toMapPin)]}
            selectedId={listing.id}
            className="rl-map--detail"
          />
        </div>
        {nearby.length ? (
          <section className="rl-listing__more">
            <h2>More in {listing.city.name}</h2>
            {nearby.some((item) => item.featured) ? (
              <p className="rl-listing__more-note">Sponsored homes pay extra to show here and under the homepage hero.</p>
            ) : null}
            <div className="rl-stay-grid">
              {nearby.map((item) => (
                <ListingCard key={item.id} listing={toBrowseListing(item)} />
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </Shell>
  );
}
