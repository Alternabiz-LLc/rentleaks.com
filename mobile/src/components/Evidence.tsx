/**
 * The evidence layer, native. Every number here was computed on the server by
 * web/src/lib/listing-evidence.ts; this file only draws it. The rule the web
 * build was held to holds here too: a check that did not run says so.
 */
import * as WebBrowser from "expo-web-browser";
import { Pressable, View } from "react-native";
import type { Detail, EvidenceJson } from "@/api/types";
import { money, shortDate } from "@/lib/format";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";
import { Badge, Card, Icon, Notice, Section, Text, type IconName } from "./ui";

type Src = { label: string; eff: string; url: string } | null;

function Cite({ src }: { src: Src }) {
  const t = useTheme();
  if (!src) return null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Source: ${src.label}`}
      onPress={() => WebBrowser.openBrowserAsync(src.url).catch(() => {})}
      style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}
    >
      <Icon name="document-text-outline" size={13} color={t.c.brand} />
      <Text variant="small" tone="brand" style={{ flex: 1 }} numberOfLines={2}>
        {src.label} · in force {src.eff}
      </Text>
    </Pressable>
  );
}

export function PriceTruth({ ev, listing }: { ev: EvidenceJson; listing: Detail }) {
  const t = useTheme();
  const p = ev.price;
  if (!p) {
    return (
      <Section kicker="Price truth" title="Not enough comparables">
        <Text tone="ink3">Fewer than four live listings of this kind to compare against — we would rather say nothing than print a percentile of four.</Text>
      </Section>
    );
  }
  const span = Math.max(1, p.p90 - p.p10);
  const pos = Math.min(1, Math.max(0, (p.mine - p.p10) / span));
  const tone = p.tone === "under" ? t.c.success : p.tone === "over" ? t.c.alert : t.c.value;
  const verdict =
    p.tone === "under" ? `${Math.abs(p.vsMedian)}% under the typical price` : p.tone === "over" ? `${p.vsMedian}% over the typical price` : "Priced around the middle of the market";

  return (
    <Section kicker="Price truth" title={verdict}>
      <Card style={{ gap: space.md }}>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: t.c.surfaceAlt, overflow: "visible" }}>
          <View
            style={{
              position: "absolute",
              left: `${((p.p25 - p.p10) / span) * 100}%`,
              width: `${((p.p75 - p.p25) / span) * 100}%`,
              top: 0,
              bottom: 0,
              backgroundColor: t.c.brandSoft,
              borderRadius: 5,
            }}
          />
          <View style={{ position: "absolute", left: `${pos * 100}%`, top: -5, width: 20, height: 20, marginLeft: -10, borderRadius: 10, backgroundColor: tone, borderWidth: 3, borderColor: t.c.surface }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text variant="small" tone="ink3">{money(p.p10)}</Text>
          <Text variant="small" tone="ink2">median {money(p.p50)}</Text>
          <Text variant="small" tone="ink3">{money(p.p90)}</Text>
        </View>
        <Text variant="small" tone="ink2">
          All-in {money(p.mine)} (USD) sits at the {p.percentile}th percentile of {p.n} live {listing.typeLabel.toLowerCase()} listings
          {p.scope === "city" ? ` in ${listing.cityName}` : " across all markets (this city is too thin on its own)"}.
          {p.feesAdd > 0 ? ` Required monthly fees add ${money(p.feesAdd, listing.currency)} (${p.feesPct}% on top of base rent).` : " No monthly fees on top of rent."}
        </Text>
        {p.thin ? <Badge label="Thin market — read as indicative" tone="warn" /> : null}
      </Card>
    </Section>
  );
}

const FEE_STATE: Record<string, { label: string; tone: "success" | "brand" | "alert" | "warn"; icon: IconName }> = {
  ok: { label: "Lawful", tone: "success", icon: "checkmark-circle" },
  capped: { label: "Within cap", tone: "brand", icon: "checkmark-circle" },
  over: { label: "Over the cap", tone: "alert", icon: "alert-circle" },
  barred: { label: "Not allowed here", tone: "alert", icon: "close-circle" },
};

export function FeeLedger({ ev, listing }: { ev: EvidenceListingProps["ev"]; listing: Detail }) {
  const t = useTheme();
  return (
    <Section kicker="Every charge, checked" title={`${money(ev.allIn, listing.currency)} a month, all-in`}>
      <Card padded={false}>
        <LedgerRow label="Base rent" amount={money(listing.price, listing.currency)} note="Monthly" />
        {ev.fees.map((f, i) => {
          const s = FEE_STATE[f.state] ?? FEE_STATE.ok;
          return (
            <View key={`${f.key}-${i}`} style={{ padding: space.lg, borderTopWidth: 1, borderTopColor: t.c.line, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <Text variant="h3" style={{ flex: 1 }}>{f.label}</Text>
                <Text variant="h3" tone={f.state === "barred" || f.state === "over" ? "alert" : "ink"}>
                  {money(f.amount, listing.currency)}
                  <Text variant="small" tone="ink3">{f.cadence === "monthly" ? " /mo" : " once"}</Text>
                </Text>
              </View>
              <Badge label={s.label} tone={s.tone} icon={s.icon} />
              <Text variant="small" tone="ink2">{f.why}</Text>
              <Cite src={f.src} />
            </View>
          );
        })}
      </Card>
      <Notice
        tone="brand"
        icon="lock-closed"
        title="RentLeaks never takes your money"
        body="No deposit, rent, booking or application fee is ever paid to us. The deposit goes directly to the landlord — ask for a receipt and the account it is held in."
      />
    </Section>
  );
}

function LedgerRow({ label, amount, note }: { label: string; amount: string; note: string }) {
  return (
    <View style={{ padding: space.lg, flexDirection: "row", alignItems: "center" }}>
      <View style={{ flex: 1 }}>
        <Text variant="h3">{label}</Text>
        <Text variant="small" tone="ink3">{note}</Text>
      </View>
      <Text variant="h3">{amount}</Text>
    </View>
  );
}

type EvidenceListingProps = { ev: EvidenceJson };

const TRUST_ICON: Record<string, { icon: IconName; tone: "success" | "warn" | "ink3" | "alert" }> = {
  pass: { icon: "checkmark-circle", tone: "success" },
  warn: { icon: "alert-circle", tone: "warn" },
  none: { icon: "ellipse-outline", tone: "alert" },
  "not-run": { icon: "remove-circle-outline", tone: "ink3" },
};

export function TrustLedger({ ev }: EvidenceListingProps) {
  const t = useTheme();
  const tr = ev.trust;
  return (
    <Section kicker="Trust ledger" title={`${tr.passed} of ${tr.scored} checks passed${tr.notRun ? ` · ${tr.notRun} not run yet` : ""}`}>
      <Card padded={false}>
        {tr.rows.map((r, i) => {
          const m = TRUST_ICON[r.state] ?? TRUST_ICON["not-run"];
          return (
            <View key={r.key} style={{ flexDirection: "row", gap: space.md, padding: space.lg, borderTopWidth: i ? 1 : 0, borderTopColor: t.c.line }}>
              <Icon name={m.icon} size={22} color={m.tone === "ink3" ? t.c.ink3 : t.c[m.tone]} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="h3">{r.what}</Text>
                <Text variant="small" tone="ink2">{r.how}</Text>
                {r.state === "not-run" ? <Text variant="micro" tone="ink3">Not run — we don’t claim it</Text> : null}
              </View>
            </View>
          );
        })}
      </Card>
    </Section>
  );
}

export function RulesPanel({ ev, listing }: EvidenceListingProps & { listing: Detail }) {
  const t = useTheme();
  const r = ev.rules;
  if (!ev.compliance.length && !r.notes.length) return null;
  return (
    <Section kicker={`Local rules · ${r.cityName || listing.cityName}`} title="What the law says about this listing">
      {r.unassessed ? (
        <Notice tone="warn" title="This market has not been assessed yet" body="The checks below use national defaults. Confirm local rules before you sign." />
      ) : null}
      <Card padded={false}>
        {ev.compliance.map((row, i) => (
          <View key={`${row.k}-${i}`} style={{ flexDirection: "row", gap: space.md, padding: space.lg, borderTopWidth: i ? 1 : 0, borderTopColor: t.c.line }}>
            <Icon name={row.pass ? "checkmark-circle" : "close-circle"} size={22} color={row.pass ? t.c.success : t.c.alert} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Text variant="h3" style={{ flex: 1 }}>{row.k}</Text>
                <Text variant="h3" tone={row.pass ? "ink" : "alert"}>{row.value}</Text>
              </View>
              <Text variant="small" tone="ink2">{row.detail}</Text>
              <Cite src={row.src} />
            </View>
          </View>
        ))}
      </Card>
      {r.notes.length ? (
        <View style={{ gap: 6 }}>
          {r.notes.slice(0, 4).map((n, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8 }}>
              <Text tone="ink3">•</Text>
              <Text variant="small" tone="ink2" style={{ flex: 1 }}>{n}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text variant="small" tone="ink3">Research, not legal advice. Every rule links to the instrument it comes from and the date it took effect.</Text>
    </Section>
  );
}

export function TakeoverDesk({ ev }: EvidenceListingProps) {
  const t = useTheme();
  const k = ev.takeover;
  if (!k) return null;
  const consent =
    k.consent === "granted" ? { label: "Landlord consent granted", tone: "success" as const } : k.consent === "refused" ? { label: "Landlord refused", tone: "alert" as const } : { label: "Landlord consent not yet settled", tone: "warn" as const };
  return (
    <Section kicker="Lease takeover desk" title={k.mode === "assignment" ? "Assignment — you take over the lease" : "Sublet — the tenant stays on the lease"}>
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Badge label={consent.label} tone={consent.tone} />
          <Badge label={`${k.remainingMonths} months remaining`} tone="brand" />
          <Badge label={k.licenceRisk === "high" ? "Check the licence carefully" : "Moderate paperwork"} tone={k.licenceRisk === "high" ? "warn" : "neutral"} />
        </View>
        {k.clockApplies && k.statute ? (
          <View style={{ backgroundColor: t.c.brandSoft, borderRadius: radius.md, padding: space.md, gap: 4 }}>
            <Text variant="h3" tone="brand">The statutory clock applies</Text>
            <Text variant="small" tone="ink2">
              Under {k.statute}
              {k.appliesTo ? ` (${k.appliesTo})` : ""}, the landlord has {k.infoWindowDays ?? "—"} days to ask for more information and{" "}
              {k.decisionWindowDays ?? "—"} days to decide. Silence after that counts as consent. Keep dated proof of every request.
            </Text>
          </View>
        ) : k.mode === "assignment" && k.assignmentNote ? (
          <Text variant="small" tone="ink2">{k.assignmentNote}</Text>
        ) : null}
        {k.surchargePct != null ? (
          <View>
            <Text variant="small" tone="ink2">A sublet may be priced at most {k.surchargePct}% above the tenant’s own rent.</Text>
            <Cite src={k.surchargeSrc} />
          </View>
        ) : null}
        {!k.accessFeeAllowed ? (
          <View>
            <Text variant="small" tone="ink2">The departing tenant may not charge a “key” or takeover access fee here.</Text>
            <Cite src={k.accessFeeSrc} />
          </View>
        ) : null}
      </Card>
    </Section>
  );
}

export function StayAndAfford({ ev, listing }: EvidenceListingProps & { listing: Detail }) {
  const w = ev.window;
  const a = ev.afford;
  return (
    <Section kicker="Dates & affordability" title="Will it fit your life?">
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", gap: space.lg }}>
          <Stat label="Available" value={shortDate(w.from)} />
          <Stat label="Until" value={shortDate(w.until)} />
          <Stat label="Shortest stay" value={`${w.minDays} days`} />
        </View>
        <View style={{ flexDirection: "row", gap: space.lg }}>
          <Stat label="Income to qualify" value={`${money(a.annualGross, listing.currency)}/yr`} />
          <Stat label="Guarantor" value={`${money(a.guarantorAnnual, listing.currency)}/yr`} />
        </View>
        <Text variant="small" tone="ink3">
          The usual “40× the monthly rent” screen and the “30% of gross income” guideline are the same test (12 ÷ 0.30 = 40), so there is one figure,
          not two. Guarantors are usually held to 80×. Arithmetic on the posted price — not a judgement about you.
        </Text>
      </Card>
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="micro" tone="ink3">{label}</Text>
      <Text variant="h3">{value}</Text>
    </View>
  );
}

export function DealCard({ ev }: EvidenceListingProps) {
  const d = ev.deal;
  return (
    <Notice tone={d.byDepartingTenant ? "warn" : "brand"} icon={d.byOwner ? "home" : d.byDepartingTenant ? "swap-horizontal" : "briefcase"} title={d.label} body={d.blurb} />
  );
}
