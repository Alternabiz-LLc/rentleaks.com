import type { Agreement, AgreementEvent, AgreementSigner } from "@prisma/client";
import { canonicalDocument, maskIp, type Section } from "@/lib/network/core";
import { json, sha256 } from "@/lib/network/engine";

const ROLE: Record<string, string> = { tenant: "Tenant", partner: "Broker", supervisor: "Broker of record", rentleaks: "RentLeaks" };
const EVENT: Record<string, string> = {
  created: "Created",
  sent: "Sent for signature",
  viewed: "Opened",
  consented: "Agreed to sign electronically",
  signed: "Signed",
  declined: "Declined",
  completed: "Completed",
  reminded: "Reminder sent",
  voided: "Voided",
  expired: "Expired",
};

const stamp = (d: Date) => `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;

/** The frozen document, its signature blocks and the audit certificate. */
export function AgreementView({
  env,
  scroll = false,
  showCertificate = true,
  fullIps = false,
}: {
  env: Agreement & { signers: AgreementSigner[]; events: AgreementEvent[] };
  scroll?: boolean;
  showCertificate?: boolean;
  fullIps?: boolean;
}) {
  const sections = json<Section[]>(env.sections, []);
  const terms = json<Record<string, unknown>>(env.terms, {});
  const intact = sha256(canonicalDocument({ title: env.title, sections, terms })) === env.docHash;
  const byId = new Map(env.signers.map((s) => [s.id, s]));
  const body = (
    <>
      {sections.map((s) => (
        <section key={s.heading}>
          <h3>{s.heading}</h3>
          <p>{s.body}</p>
        </section>
      ))}
    </>
  );
  return (
    <article className="nw-doc" id="document">
      <h2 className="nw-doc__title">{env.title}</h2>
      <p className="nw-doc__meta">
        Version {env.version} · created {stamp(env.createdAt)} · agreement {env.id}
      </p>
      {scroll ? (
        <div className="nw-doc__scroll" tabIndex={0} aria-label="Agreement text">
          {body}
        </div>
      ) : (
        body
      )}
      <div className="nw-sigs">
        {env.signers.map((s) => (
          <div key={s.id} className="nw-sig">
            <small>{ROLE[s.role] ?? s.role}</small>
            <div className="nw-sig__mark">
              {s.status === "signed" ? (
                s.signatureImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a stored data-URL signature
                  <img src={s.signatureImage} alt={`Signature of ${s.name}`} />
                ) : (
                  <span>{s.signedName}</span>
                )
              ) : (
                <span style={{ fontFamily: "inherit", fontSize: "0.85rem", color: "var(--nw-muted)" }}>{s.status === "declined" ? "Declined" : "Not signed yet"}</span>
              )}
            </div>
            <b>{s.name}</b>
            <small>
              {s.email}
              {s.signedAt ? ` · signed ${stamp(s.signedAt)}` : ""}
            </small>
          </div>
        ))}
      </div>
      {showCertificate ? (
        <div className="nw-cert">
          <h3>Signature certificate</h3>
          <p style={{ margin: 0 }}>
            <span className={`nw-integrity ${intact ? "is-ok" : "is-bad"}`}>{intact ? "✓ Document unchanged since it was created" : "✗ Document does not match its fingerprint"}</span>
          </p>
          <p style={{ margin: "0.4rem 0 0" }}>
            SHA-256: <code>{env.docHash}</code>
          </p>
          <ol>
            {env.events.map((e) => {
              const who = e.signerId ? byId.get(e.signerId) : undefined;
              return (
                <li key={e.id}>
                  {stamp(e.createdAt)} — {EVENT[e.type] ?? e.type}
                  {who ? ` · ${who.name} (${ROLE[who.role] ?? who.role})` : ""}
                  {e.ip ? ` · IP ${fullIps ? e.ip : maskIp(e.ip)}` : ""}
                  {e.detail && (e.type === "declined" || e.type === "voided" || fullIps) ? ` · ${e.detail}` : ""}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </article>
  );
}
