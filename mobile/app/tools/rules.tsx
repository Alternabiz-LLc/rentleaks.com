import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useMeta } from "@/api/hooks";
import { Screen } from "@/components/Screen";
import { Badge, Card, Chip, Icon, Notice, Section, Text } from "@/components/ui";
import { money } from "@/lib/format";
import { SOURCES, rulesFor, type Source } from "@/shared/listing-rules";
import book from "@/shared/rules.json";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";

/**
 * The jurisdiction engine as a reference, for brokers, landlords and renters.
 * Computed on the phone from the same rules.json the server enforces.
 */
export default function MarketRules() {
  const t = useTheme();
  const meta = useMeta();
  const cities = meta.data?.cities ?? [];
  const [cityId, setCityId] = useState<string | null>(null);
  const city = cities.find((c) => c.id === cityId) ?? cities[0];
  const r = useMemo(
    () => (city ? rulesFor({ cityId: city.id, citySlug: city.slug, cityName: city.name, state: city.state, country: city.country }) : null),
    [city],
  );

  const rows: Array<{ label: string; value: string; src: Source | null; ok?: boolean }> = r
    ? [
        { label: "Minimum stay", value: `${r.minStayDays} days`, src: r.minStaySrc },
        { label: "Deposit cap", value: r.depositCapMonths != null ? `${r.depositCapMonths} month(s) of rent` : "No statutory cap recorded", src: r.depositSrc },
        { label: "Broker fee charged to renter by landlord’s agent", value: r.landlordAgentMayChargeTenant ? "Allowed" : "Not allowed", src: r.tenantBrokerFeeSrc, ok: !r.landlordAgentMayChargeTenant },
        { label: "Application fee", value: r.applicationFeeBanned ? "Banned" : r.appFeeCap != null ? `Capped at ${money(r.appFeeCap, r.appFeeCurrency)}` : "No cap recorded", src: r.applicationFeeSrc ?? r.appFeeSrc },
        { label: "Move-in / key / admin fees", value: r.moveInFeesBarred ? "Barred" : "Allowed if disclosed", src: r.moveInFeesSrc },
        { label: "Source-of-income protection", value: r.soiProtected ? "Protected — vouchers must be accepted" : "Not recorded", src: r.soiSrc },
        { label: "Registration number on listings", value: r.registrationRequired ? "Required" : "Not required", src: r.registrationSrc },
        { label: "All-in price disclosure", value: r.allInDisclosure ? "Required" : "Not required", src: r.allInSrc },
        ...(r.subletSurchargePct != null ? [{ label: "Sublet surcharge cap", value: `${r.subletSurchargePct}% over rent`, src: r.subletSurchargeSrc }] : []),
        ...(r.sublet ? [{ label: "Sublet route", value: `${r.sublet.statute}${r.sublet.silenceIsConsent ? ` · silence is consent after ${r.sublet.decisionWindowDays} days` : ""}`, src: r.sublet.src ? SOURCES[r.sublet.src] ?? null : null }] : []),
      ]
    : [];

  return (
    <Screen edges={[]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {cities.map((c) => (
          <Chip key={c.id} label={c.name} selected={city?.id === c.id} onPress={() => setCityId(c.id)} />
        ))}
      </ScrollView>
      {r ? (
        <Section kicker={`${r.cityName} · ${r.region || r.country}`} title="What the law says here">
          {r.unassessed ? <Notice tone="warn" title="Not yet assessed" body="National defaults only. Check local rules before relying on these." /> : null}
          <Card padded={false}>
            {rows.map((row, i) => (
              <View key={row.label} style={{ padding: space.lg, borderTopWidth: i ? 1 : 0, borderTopColor: t.c.line, gap: 4 }}>
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  <Text variant="h3" style={{ flex: 1 }}>{row.label}</Text>
                </View>
                <Text tone={row.ok === false ? "alert" : "ink2"}>{row.value}</Text>
                {row.src ? (
                  <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(row.src!.url)} style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                    <Icon name="document-text-outline" size={13} color={t.c.brand} />
                    <Text variant="small" tone="brand" style={{ flex: 1 }}>{row.src.label}{row.src.eff ? ` · in force ${row.src.eff}` : ""}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </Card>
          {r.notes.map((n, i) => (
            <Text key={i} variant="small" tone="ink2">• {n}</Text>
          ))}
          <Badge label={`Rules book ${(book as { version?: string }).version ?? ""}`} />
          <Text variant="small" tone="ink3">Research, not legal advice. Every rule carries its instrument and effective date so a stale rule is visible.</Text>
        </Section>
      ) : null}
    </Screen>
  );
}
