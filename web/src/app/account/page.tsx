import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { money, typeLabel } from "@/lib/site";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const listings = await prisma.listing.findMany({
    where: { hostId: user.id },
    include: { city: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <Shell>
      <section className="rl-auth">
        <h1>{user.name}</h1>
        <p>
          {user.email} · {user.role} · identity {user.identity?.status || "unverified"}
        </p>
        <p>
          <Link className="rl-cta" href="/list">
            List another place
          </Link>
        </p>
        <ul className="rl-pin-list">
          {listings.map((listing) => (
            <li key={listing.id}>
              <Link href={`/listings/${listing.id}`}>
                <strong>{listing.title}</strong>
                <span>
                  {typeLabel(listing.housingType)} · {listing.city.name}
                </span>
                <em>{money(listing.allIn)} all-in /mo</em>
              </Link>
            </li>
          ))}
        </ul>
        {listings.length === 0 ? <p>No listings yet. The map only shows what is in Postgres.</p> : null}
      </section>
    </Shell>
  );
}
