import Link from "next/link";
import { Card, Facts, NetShell, Pill } from "@/components/network/NetShell";
import { GUIDE, GUIDE_PROMISE } from "@/lib/network/core";
import { guideFile, guideFromToken, markGuideDownloaded } from "@/lib/network/guides";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your guide — RentLeaks", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

/**
 * The private download page. The link is HMAC-signed and carries a per-lead
 * nonce, so it can't be guessed; opening it records the download and shows the
 * one next step that fits the person who asked.
 */
export default async function GuidePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lead = await guideFromToken(token);
  if (!lead) {
    return (
      <NetShell kicker="RentLeaks" title="This download link has expired" sub="Ask for the guide again and a fresh link arrives by email straight away.">
        <Card>
          <Link className="nw-btn nw-btn--lg" href="/hire-a-broker/guide.html">
            Get the guide
          </Link>
        </Card>
      </NetShell>
    );
  }
  const guide = GUIDE.get(lead.guideId);
  const file = guideFile(lead.guideId);
  if (!guide || !file) {
    return (
      <NetShell kicker="RentLeaks" title="That guide has moved" sub="Reply to the email you received and we'll send the current edition.">
        <Card>
          <p className="nw-muted">Nothing is wrong with your link — the guide itself was replaced.</p>
        </Card>
      </NetShell>
    );
  }
  await markGuideDownloaded(lead.id);
  const tenant = lead.audience === "tenant";
  const first = lead.name.split(" ")[0];

  return (
    <NetShell
      kicker="Your guide is ready"
      title={guide.title}
      sub={`${guide.tagline} ${guide.pages} pages, PDF — yours to keep, ${first}.`}
      steps={[
        { label: "Read the guide", state: "on" },
        { label: tenant ? "Set your fee cap" : "Apply with your licence", state: "todo" },
        { label: tenant ? "Compare brokers" : "Take your first lead", state: "todo" },
      ]}
      aside={
        <Card kicker="What happens next" title="A person, not a drip campaign">
          <p className="nw-muted">
            {tenant
              ? "Someone from our team will email you within one business day to answer questions. Nothing is charged, and you're never obliged to hire anyone."
              : "Someone from the broker network team will email you within one business day about joining. There's no sign-up fee and no charge per lead."}
          </p>
          <p className="nw-muted">{GUIDE_PROMISE}</p>
        </Card>
      }
    >
      <Card>
        <p>
          <a className="nw-btn nw-btn--lg" href={file} download>
            Download the PDF
          </a>
        </p>
        <Facts
          rows={[
            ["Guide", guide.title],
            ["Length", `${guide.pages} pages`],
            ["Sent to", lead.email],
            ["Keep it", <span key="k">The link in your email opens this page again for 60 days.</span>],
          ]}
        />
        <ul className="nw-ticks">
          {guide.inside.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </Card>

      <Card kicker="When you're ready" title={tenant ? "Hire a broker in three steps" : "Join the referral network"}>
        <p className="nw-muted">
          {tenant
            ? "Tell us where you're looking, your budget and the most you'll pay a broker. Up to three verified, licensed agents send a pitch and a fee at or under your cap — you pick one, or none."
            : "Apply with your licence and markets, sign the referral agreement in the app, and leads in your area start arriving once we've verified you with the state."}
        </p>
        <p>
          <a className="nw-btn nw-btn--lg" href={tenant ? "https://rentleaks.com/hire-a-broker/#start" : "https://rentleaks.com/hire-a-broker/agents.html#start"}>
            {tenant ? "Start my search" : "Apply in two minutes"}
          </a>{" "}
          <a className="nw-btn nw-btn--ghost" href={tenant ? "https://rentleaks.com/hire-a-broker/#faq" : "https://rentleaks.com/hire-a-broker/agents.html#faq"}>
            Questions
          </a>
        </p>
        <p className="nw-muted">
          <Pill>No lease, no fee</Pill> <Pill>Licences verified with the state</Pill> <Pill tone="good">Signed in the app</Pill>
        </p>
      </Card>
    </NetShell>
  );
}
