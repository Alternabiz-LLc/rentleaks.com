import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingGallery } from "@/components/ListingGallery";
import { ListingMap } from "@/components/ListingMap";
import { Shell } from "@/components/Shell";
import { listingGallery } from "@/lib/catalog";
import { toMapPin } from "@/lib/listings";
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
          <section>
            <h2>More in {listing.city.name}</h2>
            <ul className="rl-pin-list">
              {nearby.map((item) => (
                <li key={item.id}>
                  <Link href={`/listings/${item.id}`}>
                    <strong>{item.title}</strong>
                    <span>
                      {typeLabel(item.housingType)} · {item.neighborhood}
                    </span>
                    <em>{money(item.allIn)} all-in /mo</em>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </Shell>
  );
}
