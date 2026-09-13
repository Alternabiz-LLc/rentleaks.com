import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import SellerListings, { type SellerListing } from "@/components/SellerListings";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { typeLabel } from "@/lib/site";

export const metadata = {
  title: "Your listings — RentLeaks",
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const listings = await prisma.listing.findMany({
    where: { hostId: user.id },
    include: { city: true },
    orderBy: { createdAt: "desc" },
  });

  const rows: SellerListing[] = listings.map((l) => {
    const detail = (l.detail ?? {}) as { photos?: unknown };
    const photos = Array.isArray(detail.photos) ? detail.photos.length : 0;
    return {
      id: l.id,
      title: l.title,
      cityName: l.city.name,
      cityId: l.cityId,
      housingType: l.housingType,
      typeLabel: typeLabel(l.housingType),
      allIn: l.allIn,
      currency: l.currency,
      status: l.status,
      sponsored: l.sponsored,
      plan: l.plan,
      verified: l.verified,
      vouchersAccepted: l.vouchersAccepted,
      availableFrom: l.availableFrom,
      availableUntil: l.availableUntil,
      photoCount: photos || (l.image ? 1 : 0),
      href: `/listings/${l.id}`,
    };
  });

  const identityStatus = user.identity?.status || "unverified";
  const verified = identityStatus === "verified";

  return (
    <Shell>
      <section className="container page-hero">
        <h1>{user.name}</h1>
        <p>
          {user.email} · {user.role === "host" ? "Seller account" : user.role}
          {isAdmin(user) ? " · founder" : ""}
        </p>
        <p style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap" }}>
          <Link className="btn btn--primary" href="/list">List a place</Link>
          {isAdmin(user) && <Link className="btn btn--outline" href="/admin">Founder view</Link>}
        </p>
      </section>

      <section className="rl-page">
        <div className="container">
          {!verified && (
            <div className="s-verify">
              <div>
                <h2>Your account is not verified yet</h2>
                <p>
                  Unverified listings rank below verified ones and are shown to renters with a warning — which is the
                  honest thing to do, and it is also why verifying is the single highest-return four minutes you can
                  spend here. It costs nothing. Identity is currently <b>{identityStatus}</b>.
                </p>
              </div>
              <Link className="btn btn--primary" href="/verify">Verify now</Link>
            </div>
          )}

          <SellerListings listings={rows} />
        </div>
      </section>
    </Shell>
  );
}
