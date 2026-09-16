import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { listingEdit, listingsBulk } from "@/app/admin/_actions/listings";
import { Empty, flashOf, PageHead, Pager, Pill, qs, readParams, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { fmtMoney, typeLabel } from "@/lib/site";

export const metadata = { title: "Listings — RentLeaks admin" };

const PAGE = 50;

export default async function ListingsAdmin({ searchParams }: { searchParams: SP }) {
  await requireAdminPage();
  const p = await readParams(searchParams);
  const page = Math.max(1, Number(p.page) || 1);
  const and: Prisma.ListingWhereInput[] = [];
  if (p.q) {
    and.push({
      OR: [
        { id: { contains: p.q, mode: "insensitive" } },
        { title: { contains: p.q, mode: "insensitive" } },
        { neighborhood: { contains: p.q, mode: "insensitive" } },
        { host: { email: { contains: p.q, mode: "insensitive" } } },
      ],
    });
  }
  if (p.city) and.push({ cityId: p.city });
  if (p.type) and.push({ housingType: p.type });
  if (p.moderation) and.push({ moderation: p.moderation });
  if (p.status) and.push({ status: p.status });
  if (p.sponsored) and.push({ sponsored: p.sponsored === "yes" });
  if (p.host) and.push({ hostId: p.host });
  const where: Prisma.ListingWhereInput = and.length ? { AND: and } : {};

  const [total, rows, cities, counts] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      include: { city: { select: { name: true } }, host: { select: { id: true, name: true, email: true } }, _count: { select: { leads: true, reports: true } } },
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    prisma.city.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.listing.groupBy({ by: ["moderation"], _count: { _all: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const self = `/admin/listings${qs(p, { ok: undefined, err: undefined })}`;
  const modCount = (m: string) => counts.find((c) => c.moderation === m)?._count._all ?? 0;
  const editing = p.edit ? await prisma.listing.findUnique({ where: { id: p.edit }, include: { host: { select: { email: true } } } }) : null;

  return (
    <>
      <PageHead
        title="Listings"
        sub={`${total.toLocaleString("en-US")} matching · ${modCount("pending")} pending review · ${modCount("declined")} declined`}
        flash={flashOf(p)}
      >
        <Link className="btn btn--outline" href={`/api/admin/export/listings${qs(p, { page: undefined, ok: undefined, err: undefined, edit: undefined })}`}>Export CSV</Link>
      </PageHead>

      <form className="adm-filters" method="get">
        <input name="q" placeholder="Search title, id, area, host email" defaultValue={p.q} />
        <select name="city" defaultValue={p.city}>
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select name="type" defaultValue={p.type}>
          <option value="">All types</option>
          {["room", "coliving", "furnished", "short-term", "aparthotel", "lease-break"].map((t) => (
            <option key={t} value={t}>{typeLabel(t)}</option>
          ))}
        </select>
        <select name="moderation" defaultValue={p.moderation}>
          <option value="">Any review state</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
        </select>
        <select name="status" defaultValue={p.status}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="coming-soon">Coming soon</option>
          <option value="paused">Paused</option>
        </select>
        <select name="sponsored" defaultValue={p.sponsored}>
          <option value="">Sponsored or not</option>
          <option value="yes">Sponsored</option>
          <option value="no">Not sponsored</option>
        </select>
        <button className="btn btn--primary" type="submit">Filter</button>
        <Link className="btn btn--ghost" href="/admin/listings">Reset</Link>
      </form>

      {editing ? (
        <form action={listingEdit} className="adm-card adm-form">
          <h2>Edit · {editing.id}</h2>
          <input type="hidden" name="id" value={editing.id} />
          <input type="hidden" name="returnTo" value={`/admin/listings${qs(p, { edit: undefined, ok: undefined, err: undefined })}`} />
          <label>Title<input name="title" defaultValue={editing.title} required /></label>
          <div className="adm-row">
            <label>Rent ({editing.currency})<input name="price" type="number" min={0} defaultValue={editing.price} /></label>
            <label>All-in ({editing.currency})<input name="allIn" type="number" min={0} defaultValue={editing.allIn} /></label>
            <label>
              Billing plan
              <select name="plan" defaultValue={editing.plan}>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </label>
          </div>
          <label>Move to host (email)<input name="hostEmail" type="email" placeholder={editing.host.email} /></label>
          <div className="adm-row">
            <button className="btn btn--primary" type="submit">Save</button>
            <Link className="btn btn--ghost" href={`/admin/listings${qs(p, { edit: undefined })}`}>Cancel</Link>
          </div>
        </form>
      ) : null}

      {rows.length === 0 ? (
        <Empty>No listings match.</Empty>
      ) : (
        <form action={listingsBulk}>
          <input type="hidden" name="returnTo" value={self} />
          <div className="adm-bulk">
            <select name="op" defaultValue="">
              <option value="" disabled>Bulk action…</option>
              <option value="approve">Approve</option>
              <option value="decline">Decline (reason below)</option>
              <option value="pending">Send back to review</option>
              <option value="pause">Pause</option>
              <option value="activate">Activate</option>
              <option value="sponsor">Sponsor</option>
              <option value="unsponsor">Remove sponsorship</option>
              <option value="feature">Feature</option>
              <option value="unfeature">Unfeature</option>
              <option value="verify">Mark verified</option>
              <option value="unverify">Remove verified</option>
            </select>
            <input name="note" placeholder="Reason (required to decline; shown to the seller)" />
            <button className="btn btn--primary" type="submit">Apply to ticked</button>
          </div>
          <div className="a-scroll">
            <table className="a-table adm-table">
              <thead>
                <tr>
                  <th aria-label="Select" />
                  <th>Listing</th>
                  <th>Market</th>
                  <th>All-in</th>
                  <th>Host</th>
                  <th>Review</th>
                  <th>Status</th>
                  <th>Leads</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td><input type="checkbox" name="ids" value={l.id} aria-label={`Select ${l.title}`} /></td>
                    <td className="adm-wrap">
                      <Link href={`/listings/${l.id}`} target="_blank">{l.title}</Link>
                      <div className="a-dim">
                        {typeLabel(l.housingType)} · {l.id}
                        {l.sponsored ? " · sponsored" : ""}
                        {l.featured ? " · featured" : ""}
                        {l.verified ? " · verified" : ""}
                      </div>
                    </td>
                    <td>{l.city.name}</td>
                    <td>{fmtMoney(l.allIn, l.currency)}</td>
                    <td className="adm-wrap">
                      <Link href={`/admin/accounts?q=${encodeURIComponent(l.host.email)}`}>{l.host.name}</Link>
                    </td>
                    <td>
                      <Pill tone={l.moderation === "approved" ? "good" : l.moderation === "declined" ? "bad" : "warn"}>{l.moderation}</Pill>
                    </td>
                    <td><Pill tone={l.status === "paused" ? "bad" : ""}>{l.status}</Pill></td>
                    <td>
                      {l._count.leads || "—"}
                      {l._count.reports ? <span className="a-bad"> · {l._count.reports} reports</span> : null}
                    </td>
                    <td><Link href={`/admin/listings${qs(p, { edit: l.id, ok: undefined, err: undefined })}`}>Edit</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      )}
      <Pager page={page} pages={pages} href={(n) => `/admin/listings${qs(p, { page: n, ok: undefined, err: undefined })}`} />
    </>
  );
}
