import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ModerationQueue, { type QueueItem } from "@/components/ModerationQueue";
import { Shell } from "@/components/Shell";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { checkListing, type Fee } from "@/lib/listing-rules";
import { fmtMoney, typeLabel } from "@/lib/site";

export const metadata = { title: "Founder view — RentLeaks" };

/**
 * The founder view: everything, across every account.
 *
 * Two things it deliberately does not show. Identity documents — verification
 * STATUS is what you need to work a queue, and a product that promises to
 * discard documents after the match cannot also have a screen that browses
 * them. And renter contact details, which belong to the conversation they were
 * given in, not to a dashboard.
 *
 * The compliance queue is the interesting column. It re-runs the same gate the
 * composer runs, against what is actually in the database — so a listing that
 * predates a rule, or was written before a market's floor changed, surfaces
 * here rather than sitting quietly non-compliant. Rules move; catalogues do
 * not move themselves.
 */
export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdmin(user)) notFound();

  const [listings, users, cities] = await Promise.all([
    prisma.listing.findMany({
      include: { city: true, host: { select: { name: true, identity: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ include: { identity: true }, orderBy: { createdAt: "desc" } }),
    prisma.city.findMany({ orderBy: { rank: "asc" } }),
  ]);

  const live = listings.filter((l) => l.status === "active");
  const sponsored = listings.filter((l) => l.sponsored);

  /* Recurring revenue, at the posted rates. Lease-breaks publish free and
     paused listings are not billed, so neither counts. */
  const monthly = listings
    .filter((l) => l.status !== "paused" && l.housingType !== "lease-break")
    .reduce((sum, l) => {
      const weekly = l.plan !== "month";
      const listing = weekly ? 14 : 60;
      const promo = l.sponsored ? (weekly ? 45 : 120) : 0;
      return sum + (weekly ? (listing + promo) * 4.33 : listing + promo);
    }, 0);

  /* Same gate as the composer, re-run over stored rows — once, and read by
     both the review queue and the compliance table below it. */
  const reviewed = listings
    .map((l) => {
      let fees: Fee[] = [];
      try {
        const parsed = JSON.parse(l.feesJson) as unknown;
        if (Array.isArray(parsed)) fees = parsed as Fee[];
      } catch {
        fees = [];
      }
      const detail = (l.detail ?? {}) as { photos?: unknown };
      const checks = checkListing({
        role: l.listedBy,
        housingType: l.housingType,
        cityId: l.cityId,
        citySlug: l.city.slug,
        cityName: l.city.name,
        state: l.city.state,
        country: l.city.country,
        title: l.title,
        neighborhood: l.neighborhood,
        address: l.address,
        description: l.description,
        price: l.price,
        deposit: l.deposit,
        fees,
        availableFrom: l.availableFrom,
        availableUntil: l.availableUntil || "",
        minStayMonths: l.minStayMonths,
        maxStayMonths: l.maxStayMonths,
        leaseEnd: l.leaseEnd || undefined,
        consentStatus: l.consentStatus || undefined,
        registrationNumber: l.registrationNumber || undefined,
        photoCount: Array.isArray(detail.photos) ? detail.photos.length : l.image ? 1 : 0,
      });
      return {
        listing: l,
        fees,
        checks,
        blocked: checks.filter((c) => c.blocking && !c.ok),
        warned: checks.filter((c) => !c.blocking && !c.ok),
      };
    });

  const failing = reviewed.filter((x) => x.blocked.length);

  /* The queue. Oldest first: a seller waiting three days should not be behind
     one who submitted this morning. */
  const queue: QueueItem[] = reviewed
    .filter((x) => x.listing.moderation === "pending")
    .reverse()
    .map(({ listing: l, fees, blocked, warned }) => {
      const detail = (l.detail ?? {}) as { photos?: unknown; images?: unknown };
      const shots = Array.isArray(detail.photos)
        ? (detail.photos as unknown[]).filter((p): p is string => typeof p === "string")
        : Array.isArray(detail.images)
          ? (detail.images as unknown[]).filter((p): p is string => typeof p === "string")
          : [];
      return {
        id: l.id,
        title: l.title,
        href: `/listings/${l.id}`,
        cityName: l.city.name,
        typeLabel: typeLabel(l.housingType),
        hostName: l.host.name,
        hostVerified: l.host.identity?.status === "verified",
        listedBy: l.listedBy,
        price: fmtMoney(l.price, l.currency),
        allIn: fmtMoney(l.allIn, l.currency),
        deposit: l.deposit ? fmtMoney(l.deposit, l.currency) : "None",
        feeLines: fees.map(
          (f) => `${f.type}: ${fmtMoney(f.amount, l.currency)}${f.cadence === "monthly" ? " /mo" : " once"}`,
        ),
        photos: shots.length ? shots : l.image ? [l.image] : [],
        availableFrom: l.availableFrom,
        availableUntil: l.availableUntil,
        createdAt: l.createdAt.toISOString().slice(0, 10),
        moderation: l.moderation,
        moderationNote: l.moderationNote,
        blockers: blocked.map((c) => c.title),
        warnings: warned.map((c) => c.title),
      };
    });

  const unverifiedHosts = users.filter(
    (u) => u.role !== "renter" && (!u.identity || u.identity.status !== "verified"),
  );

  const byMarket = cities
    .map((c) => {
      const mine = listings.filter((l) => l.cityId === c.id);
      return {
        id: c.id,
        name: c.name,
        country: c.country,
        total: mine.length,
        live: mine.filter((l) => l.status === "active").length,
        sponsored: mine.filter((l) => l.sponsored).length,
        noWindow: mine.filter((l) => !l.availableUntil).length,
        breaching: failing.filter((f) => f.listing.cityId === c.id).length,
      };
    })
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <Shell>
      <section className="container page-hero">
        <h1>Founder view</h1>
        <p>Everything, across every account. Verification status only — never the documents behind it.</p>
      </section>

      <section className="rl-page">
        <div className="container">
          <div className="s-summary">
            <div><span className="s-summary__k">Listings</span><b>{listings.length}</b><small>{live.length} live</small></div>
            <div><span className="s-summary__k">Accounts</span><b>{users.length}</b><small>{users.filter((u) => u.role !== "renter").length} sellers</small></div>
            <div><span className="s-summary__k">Sponsored</span><b>{sponsored.length}</b><small>across {new Set(sponsored.map((l) => l.cityId)).size} markets</small></div>
            <div><span className="s-summary__k">Awaiting review</span><b>{queue.length}</b><small>{listings.filter((l) => l.moderation === "declined").length} declined</small></div>
            <div><span className="s-summary__k">Recurring</span><b>${Math.round(monthly)}</b><small>per month at posted rates</small></div>
          </div>

          <h2 className="a-h2">Waiting on review{queue.length ? ` · ${queue.length}` : ""}</h2>
          <p className="v-note" style={{ marginTop: 0 }}>
            Nothing reaches renters until it is approved here. Decline needs a reason and the seller is shown it
            verbatim — a rejection with no reason comes back as the same listing next week.
          </p>
          <ModerationQueue items={queue} />

          <h2 className="a-h2">Needs attention</h2>
          <div className="a-cols">
            <div className="c-section">
              <div className="c-section__head">
                <h3 className="c-section__title">Listings breaching their market</h3>
                <p className="c-section__sub">
                  The composer&rsquo;s gate, re-run against what is stored. Rules change and catalogues do not move
                  themselves, so anything written before a rule shifted surfaces here.
                </p>
              </div>
              {failing.length === 0 ? (
                <p className="v-note">Nothing breaching. Every stored listing passes the gate for its own market.</p>
              ) : (
                <ul className="c-checks">
                  {failing.slice(0, 25).map(({ listing, blocked }) => (
                    <li className="c-check" data-ok="block" key={listing.id}>
                      <span className="c-check__m" aria-hidden="true">!</span>
                      <span>
                        <b><Link href={`/listings/${listing.id}`}>{listing.title}</Link> · {listing.city.name}</b>
                        {blocked.map((b) => b.title).join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="c-section">
              <div className="c-section__head">
                <h3 className="c-section__title">Sellers without verification</h3>
                <p className="c-section__sub">Status only. The documents are matched and discarded, so there is nothing here to open.</p>
              </div>
              {unverifiedHosts.length === 0 ? (
                <p className="v-note">Every seller account is verified.</p>
              ) : (
                <ul className="c-checks">
                  {unverifiedHosts.slice(0, 25).map((u) => (
                    <li className="c-check" data-ok="0" key={u.id}>
                      <span className="c-check__m" aria-hidden="true">–</span>
                      <span>
                        <b>{u.name}</b>
                        {u.identity?.status || "no verification started"} · {listings.filter((l) => l.hostId === u.id).length} listings
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <h2 className="a-h2">Markets</h2>
          <div className="a-scroll">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Market</th><th>Listings</th><th>Live</th><th>Sponsored</th><th>No end date</th><th>Breaching</th>
                </tr>
              </thead>
              <tbody>
                {byMarket.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name} <span className="a-dim">{m.country}</span></td>
                    <td>{m.total}</td>
                    <td>{m.live}</td>
                    <td>{m.sponsored || "—"}</td>
                    <td className={m.noWindow ? "a-warn" : undefined}>{m.noWindow || "—"}</td>
                    <td className={m.breaching ? "a-bad" : undefined}>{m.breaching || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="v-note">
            <b>No end date</b> is the column worth watching. A listing without one cannot answer a date-range search,
            so it is invisible to anyone who knows when they need to move — which is most of this market.
          </p>
        </div>
      </section>
    </Shell>
  );
}
