import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useMeta } from "@/api/hooks";
import { Screen } from "@/components/Screen";
import { Badge, Card, Chip, Field, Notice, Section, Segmented, Text } from "@/components/ui";
import { FEE_TYPES } from "@/features/composer";
import { dealFor, feeVerdicts, type EvidenceListing } from "@/shared/listing-evidence";
import { rulesFor } from "@/shared/listing-rules";
import { money } from "@/lib/format";
import { space } from "@/theme/tokens";

/**
 * "Is this fee legal?" — the fee-verdict engine the listing page uses, run
 * against a fee someone has just asked you for. Useful to renters mid-
 * negotiation and to brokers checking their own paperwork.
 */
export default function FeeCheck() {
  const meta = useMeta();
  const cities = meta.data?.cities ?? [];
  const [cityId, setCityId] = useState<string | null>(null);
  const city = cities.find((c) => c.id === cityId) ?? cities[0];
  const [listedBy, setListedBy] = useState<"owner" | "manager" | "tenant">("manager");
  const [type, setType] = useState("broker");
  const [amount, setAmount] = useState("");
  const [rent, setRent] = useState("");
  const [deposit, setDeposit] = useState("");

  const verdicts = useMemo(() => {
    if (!city) return [];
    const rules = rulesFor({ cityId: city.id, citySlug: city.slug, cityName: city.name, state: city.state, country: city.country });
    const def = FEE_TYPES.find((f) => f.type === type);
    const subject: EvidenceListing = {
      id: "check",
      title: "",
      address: "",
      neighborhood: "",
      cityId: city.id,
      citySlug: city.slug,
      cityName: city.name,
      cityState: city.state,
      cityCountry: city.country,
      currency: city.currency,
      housingType: listedBy === "tenant" ? "lease-break" : "room",
      price: Number(rent) || 0,
      allIn: Number(rent) || 0,
      allInUsd: 0,
      deposit: Number(deposit) || 0,
      sqft: 0,
      feesJson: JSON.stringify(Number(amount) > 0 ? [{ type, amount: Number(amount), cadence: def?.cadence ?? "once", mandatory: true }] : []),
      amenitiesJson: "[]",
      accessibilityJson: "[]",
      listedBy,
      addressPrivacy: "street-only",
      verified: false,
      vouchersAccepted: true,
      registrationNumber: null,
      availableFrom: "",
      availableUntil: null,
      minStayMonths: 1,
      maxStayMonths: 12,
      leaseEnd: null,
      takeoverType: null,
      consentStatus: null,
      status: "active",
      sponsored: false,
      updatedAt: new Date(),
    };
    return feeVerdicts(subject, rules, dealFor(subject));
  }, [city, listedBy, type, amount, rent, deposit]);

  const cur = city?.currency ?? "USD";

  return (
    <Screen edges={[]} keyboard>
      <Section title="Where is the home?">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {cities.map((c) => (
            <Chip key={c.id} label={c.name} selected={city?.id === c.id} onPress={() => setCityId(c.id)} />
          ))}
        </ScrollView>
      </Section>
      <Section title="Who is asking for it?">
        <Segmented value={listedBy} onChange={setListedBy} options={[{ value: "owner", label: "The owner" }, { value: "manager", label: "Landlord’s agent" }, { value: "tenant", label: "Departing tenant" }]} />
      </Section>
      <Section title="What fee?">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {FEE_TYPES.map((f) => (
            <Chip key={f.type} label={f.label} selected={type === f.type} onPress={() => setType(f.type)} />
          ))}
          <Chip label="Application fee" selected={type === "application"} onPress={() => setType("application")} />
        </View>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <Field label={`Fee (${cur})`} keyboardType="number-pad" value={amount} onChangeText={setAmount} style={{ flex: 1 }} />
          <Field label={`Monthly rent (${cur})`} keyboardType="number-pad" value={rent} onChangeText={setRent} style={{ flex: 1 }} />
        </View>
        <Field label={`Deposit asked (${cur}, optional)`} keyboardType="number-pad" value={deposit} onChangeText={setDeposit} />
      </Section>
      {verdicts.length ? (
        <Section title="Verdict">
          {verdicts.map((v) => (
            <Card key={v.key} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text variant="h3" style={{ flex: 1 }}>{v.label} · {money(v.amount, cur)}</Text>
                <Badge
                  label={v.state === "barred" ? "Not allowed" : v.state === "over" ? "Over the cap" : v.state === "capped" ? "Within cap" : "Allowed"}
                  tone={v.state === "barred" || v.state === "over" ? "alert" : "success"}
                />
              </View>
              <Text variant="small" tone="ink2">{v.why}</Text>
              {v.src ? <Text variant="small" tone="brand">{v.src.label} · in force {v.src.eff}</Text> : null}
            </Card>
          ))}
        </Section>
      ) : (
        <Notice title="Enter an amount to check it" />
      )}
      <Text variant="small" tone="ink3">Research, not legal advice. If a fee is barred and you have already paid it, keep the receipt and contact your local consumer or housing agency.</Text>
    </Screen>
  );
}
