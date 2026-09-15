import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingCard } from "@/components/ListingCard";
import { ListingGallery } from "@/components/ListingGallery";
import { ListingMap } from "@/components/ListingMap";
import { Shell } from "@/components/Shell";
import { ListingEvidence } from "@/components/evidence/ListingEvidence";
import { listingGallery } from "@/lib/catalog";
import { evidenceFor, type EvidenceListing } from "@/lib/listing-evidence";
import { mediaFromDetail } from "@/lib/media";
import { toBrowseListing, toMapPin } from "@/lib/listings";
import { prisma } from "@/lib/prisma";
import { catalogOrigin, fmtMoney, typeLabel } from "@/lib/site";

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

  /* The comparison pool for the price panel. Same housing type, live listings
     only — a paused listing is not a home you could take, so it has no
     business setting the percentile you are measured against. The city filter
     happens in the evidence module, which widens the pool when this market is
     too thin to say anything honest. */
  const peers = await prisma.listing.findMany({
    where: { housingType: listing.housingType, status: "active", allInUsd: { gt: 0 } },
    select: { allInUsd: true, housingType: true, cityId: true },
    take: 2000,
  });

  const subject: EvidenceListing = {
    id: listing.id,
    title: listing.title,
    address: listing.address,
    neighborhood: listing.neighborhood,
    cityId: listing.cityId,
    citySlug: listing.city.slug,
    cityName: listing.city.name,
    cityState: listing.city.state,
    cityCountry: listing.city.country,
    currency: listing.currency,
    housingType: listing.housingType,
    price: listing.price,
    allIn: listing.allIn,
    allInUsd: listing.allInUsd,
    deposit: listing.deposit,
    sqft: listing.sqft,
    feesJson: listing.feesJson,
    amenitiesJson: listing.amenitiesJson,
    accessibilityJson: listing.accessibilityJson,
    listedBy: listing.listedBy,
    addressPrivacy: listing.addressPrivacy,
    verified: listing.verified,
    vouchersAccepted: listing.vouchersAccepted,
    registrationNumber: listing.registrationNumber,
    availableFrom: listing.availableFrom,
    availableUntil: listing.availableUntil,
    minStayMonths: listing.minStayMonths,
    maxStayMonths: listing.maxStayMonths,
    leaseEnd: listing.leaseEnd,
    takeoverType: listing.takeoverType,
    consentStatus: listing.consentStatus,
    status: listing.status,
    sponsored: listing.sponsored,
    updatedAt: listing.updatedAt,
  };

  const evidence = evidenceFor(subject, peers, (n) => fmtMoney(n, listing.currency));

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
            ...mediaFromDetail(listing.detail),
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
                <dd>{fmtMoney(listing.allIn, listing.currency)} /mo</dd>
              </div>
              <div>
                <dt>Base rent</dt>
                <dd>{fmtMoney(listing.price, listing.currency)}</dd>
              </div>
              <div>
                <dt>Deposit</dt>
                <dd>{fmtMoney(listing.deposit, listing.currency)}</dd>
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
        <ListingEvidence evidence={evidence} listing={subject} />
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
