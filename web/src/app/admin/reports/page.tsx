import Link from "next/link";
import { resolveReport } from "@/app/admin/_actions/reports";
import { Empty, flashOf, PageHead, Pill, readParams, Section, Stats, when, type SP } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Reports & safety — RentLeaks admin" };

export default async function ReportsAdmin({ searchParams }: { searchParams: SP }) {
  await requireAdminPage();
  const p = await readParams(searchParams);
  const [open, resolved, blocks, flagged] = await Promise.all([
    prisma.report.findMany({
      where: { status: "open" },
      include: { reporter: { select: { name: true, email: true } }, listing: { select: { id: true, title: true, hostId: true } } },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.report.findMany({
      where: { status: { not: "open" } },
      include: { listing: { select: { id: true, title: true } } },
      orderBy: { resolvedAt: "desc" },
      take: 30,
    }),
    prisma.userBlock.count(),
    prisma.message.findMany({
      where: { NOT: { flags: "[]" } },
      select: { id: true, flags: true, createdAt: true, sender: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const userIds = [...new Set(open.map((r) => r.subjectUserId).filter((x): x is string => Boolean(x)))];
  const msgIds = open.map((r) => r.messageId).filter((x): x is string => Boolean(x));
  const [subjects, messages] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [],
    msgIds.length ? prisma.message.findMany({ where: { id: { in: msgIds } }, select: { id: true, body: true } }) : [],
  ]);
  const subjectOf = new Map(subjects.map((u) => [u.id, u]));
  const messageOf = new Map(messages.map((m) => [m.id, m.body]));

  return (
    <>
      <PageHead
        title="Reports & safety"
        sub="Member reports on listings, accounts and messages. Oldest first. Removing a listing sends it back to review with the reason; suspending signs the account out and pauses its listings."
        flash={flashOf(p)}
      />
      <Stats
        items={[
          { k: "Open reports", v: open.length },
          { k: "Resolved (recent)", v: resolved.length },
          { k: "Blocks between members", v: blocks },
          { k: "Scam-guard flags", v: flagged.length, s: "latest 20 flagged messages" },
        ]}
      />

      <Section title="Open">
        {open.length === 0 ? (
          <Empty>No open reports.</Empty>
        ) : (
          <ul className="adm-cards">
            {open.map((r) => {
              const subject = r.subjectUserId ? subjectOf.get(r.subjectUserId) : null;
              return (
                <li className="adm-card" key={r.id}>
                  <div className="adm-card__top">
                    <div>
                      <Pill tone="bad">{r.reason}</Pill> <span className="a-dim">filed {when(r.createdAt)} by {r.reporter.name} ({r.reporter.email})</span>
                      <p>
                        {r.listing ? (
                          <>
                            Listing: <Link href={`/listings/${r.listing.id}`} target="_blank">{r.listing.title}</Link>
                          </>
                        ) : null}
                        {subject ? (
                          <>
                            {" "}Account: <Link href={`/admin/accounts?q=${encodeURIComponent(subject.email)}`}>{subject.name}</Link>
                          </>
                        ) : null}
                      </p>
                      {r.note ? <p className="l-summary">{r.note}</p> : null}
                      {r.messageId && messageOf.get(r.messageId) ? (
                        <p className="l-summary"><b>Reported message:</b> {messageOf.get(r.messageId)}</p>
                      ) : null}
                    </div>
                  </div>
                  <form action={resolveReport} className="adm-actions">
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn btn--outline" name="op" value="dismiss">Dismiss</button>
                    {r.listingId ? <button className="btn btn--outline" name="op" value="unpublish">Remove listing</button> : null}
                    <button className="btn btn--danger" name="op" value="suspend">Suspend account</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Recently resolved">
        {resolved.length === 0 ? (
          <Empty>Nothing resolved yet.</Empty>
        ) : (
          <table className="a-table">
            <tbody>
              {resolved.map((r) => (
                <tr key={r.id}>
                  <td>{when(r.resolvedAt)}</td>
                  <td><Pill tone={r.status === "actioned" ? "bad" : ""}>{r.status}</Pill></td>
                  <td>{r.reason}</td>
                  <td className="adm-wrap">{r.listing?.title || "—"}</td>
                  <td>
                    <form action={resolveReport}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="btn btn--ghost" name="op" value="reopen">Reopen</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Messages flagged by the scam guard" sub="Warnings shown to recipients (wire transfers, paying before a viewing, moving off-platform). Nothing was blocked.">
        {flagged.length === 0 ? (
          <Empty>No flagged messages.</Empty>
        ) : (
          <table className="a-table">
            <tbody>
              {flagged.map((m) => (
                <tr key={m.id}>
                  <td>{when(m.createdAt)}</td>
                  <td><Link href={`/admin/accounts?q=${encodeURIComponent(m.sender.email)}`}>{m.sender.name}</Link></td>
                  <td className="adm-wrap">{m.flags}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}
