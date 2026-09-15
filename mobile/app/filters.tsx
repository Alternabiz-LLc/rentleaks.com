import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useMeta } from "@/api/hooks";
import type { SearchQuery } from "@/api/types";
import { Screen, StickyFooter } from "@/components/Screen";
import { Button, Chip, Field, Section, Text } from "@/components/ui";
import { useSearch } from "@/features/search-state";

const TOGGLES: Array<{ key: keyof SearchQuery; label: string }> = [
  { key: "noFee", label: "No broker fee" },
  { key: "verified", label: "ID-verified host" },
  { key: "furnished", label: "Fully furnished" },
  { key: "privateBath", label: "Private bathroom" },
  { key: "work", label: "Work-ready desk & Wi-Fi" },
  { key: "utilities", label: "Utilities included" },
  { key: "pets", label: "Pets considered" },
  { key: "vouchers", label: "Housing vouchers accepted" },
];

export default function Filters() {
  const { query, replaceQuery } = useSearch();
  const meta = useMeta();
  const [draft, setDraft] = useState<SearchQuery>(query);
  const city = meta.data?.cities.find((c) => c.id === draft.city);
  const fx = city ? meta.data?.fx.perUsd[city.currency] ?? 1 : 1;
  const cur = city?.currency ?? "USD";

  /* Budgets are typed in the market's currency and sent in USD, because
     allIn is not comparable across currencies and allInUsd is. The text is
     kept as typed and converted once on apply, so digits never jump under
     the thumb from a USD round-trip. */
  const toLocal = (usd?: number) => (usd == null ? "" : String(Math.round(usd * fx)));
  const [minText, setMinText] = useState(toLocal(query.minUsd));
  const [maxText, setMaxText] = useState(toLocal(query.maxUsd));
  const toUsd = (local: string) => {
    const n = Number(local.replace(/[^\d.]/g, ""));
    return local && Number.isFinite(n) && n > 0 ? Math.round(n / fx) : undefined;
  };

  const set = (patch: Partial<SearchQuery>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Screen
      edges={[]}
      keyboard
      footer={
        <StickyFooter>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Button
              label="Clear"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                setDraft({ city: draft.city, type: draft.type, moveIn: draft.moveIn, moveOut: draft.moveOut, sort: draft.sort });
                setMinText("");
                setMaxText("");
              }}
            />
            <Button
              label="Show homes"
              style={{ flex: 2 }}
              onPress={() => {
                replaceQuery({ ...draft, minUsd: toUsd(minText), maxUsd: toUsd(maxText) });
                router.back();
              }}
            />
          </View>
        </StickyFooter>
      }
    >
      <Section title="Monthly budget, all-in" kicker={`In ${cur}`}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Field label="Minimum" keyboardType="number-pad" style={{ flex: 1 }} value={minText} onChangeText={setMinText} placeholder="No min" />
          <Field label="Maximum" keyboardType="number-pad" style={{ flex: 1 }} value={maxText} onChangeText={setMaxText} placeholder="No max" />
        </View>
        <Text variant="small" tone="ink3">All-in means rent plus every required monthly fee — the number you will actually pay.</Text>
      </Section>

      <Section title="Bedrooms">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[undefined, 1, 2, 3, 4].map((b) => (
            <Chip key={String(b)} label={b == null ? "Any" : `${b}+`} selected={draft.beds === b} onPress={() => set({ beds: b })} />
          ))}
        </View>
      </Section>

      <Section title="Must-haves">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {TOGGLES.map((f) => (
            <Chip key={f.key} label={f.label} selected={!!draft[f.key]} onPress={() => set({ [f.key]: draft[f.key] ? undefined : true } as Partial<SearchQuery>)} />
          ))}
        </View>
        <Text variant="small" tone="ink3">
          There is no filter on who a housemate is — age, gender, religion, nationality or family status. That is deliberate: fair-housing law, and the product.
        </Text>
      </Section>
    </Screen>
  );
}
