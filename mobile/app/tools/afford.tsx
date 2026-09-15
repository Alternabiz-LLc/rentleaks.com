import { useMemo, useState } from "react";
import { View } from "react-native";
import { useMeta } from "@/api/hooks";
import { Screen } from "@/components/Screen";
import { Card, Field, Section, Segmented, Text } from "@/components/ui";
import { money } from "@/lib/format";
import { space } from "@/theme/tokens";

/**
 * Two questions people actually ask: "what can I afford?" and "what does my
 * share come to?". 40× rent and 30% of gross are the same test, so there is
 * one threshold, stated once.
 */
export default function Afford() {
  const meta = useMeta();
  const [mode, setMode] = useState<"income" | "rent">("income");
  const [value, setValue] = useState("");
  const [people, setPeople] = useState("1");
  const [cur, setCur] = useState("USD");
  const currencies = Object.keys(meta.data?.fx.perUsd ?? { USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.36, CHF: 0.88 });

  const out = useMemo(() => {
    const n = Number(value.replace(/[^\d.]/g, "")) || 0;
    const split = Math.max(1, Number(people) || 1);
    if (mode === "income") {
      const maxRent = n / 40;
      return { maxRent, household: maxRent * split, share: maxRent };
    }
    const share = n / split;
    return { share, income: share * 40, guarantor: share * 80, total: n };
  }, [mode, value, people]);

  return (
    <Screen edges={[]} keyboard>
      <Segmented value={mode} onChange={setMode} options={[{ value: "income", label: "I know my income" }, { value: "rent", label: "I know the rent" }]} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {currencies.slice(0, 6).map((c) => (
          <Text key={c} variant="label" tone={cur === c ? "brand" : "ink3"} onPress={() => setCur(c)} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
            {c}
          </Text>
        ))}
      </View>
      <Field
        label={mode === "income" ? `Your gross annual income (${cur})` : `All-in monthly rent (${cur})`}
        keyboardType="number-pad"
        value={value}
        onChangeText={setValue}
      />
      <Field label="People splitting the rent" keyboardType="number-pad" value={people} onChangeText={setPeople} />
      <Section title="Result">
        <Card style={{ gap: space.md }}>
          {mode === "income" ? (
            <>
              <Text variant="micro" tone="ink3">Your share can be up to</Text>
              <Text variant="hero" tone="value">{money(out.maxRent ?? 0, cur)}<Text tone="ink3"> /mo</Text></Text>
              {Number(people) > 1 ? <Text tone="ink2">A home up to {money(out.household ?? 0, cur)}/mo all-in, if everyone earns similarly.</Text> : null}
            </>
          ) : (
            <>
              <Text variant="micro" tone="ink3">Your share</Text>
              <Text variant="hero" tone="value">{money(out.share ?? 0, cur)}<Text tone="ink3"> /mo</Text></Text>
              <Text tone="ink2">Income usually asked for your share: {money(out.income ?? 0, cur)}/yr</Text>
              <Text tone="ink2">A guarantor is usually held to: {money(out.guarantor ?? 0, cur)}/yr</Text>
            </>
          )}
        </Card>
        <Text variant="small" tone="ink3">
          “40× the monthly rent” and “no more than 30% of gross income” are the same threshold (12 ÷ 0.30 = 40). Where source of income is protected, the test
          applies only to the part of the rent you pay yourself.
        </Text>
      </Section>
    </Screen>
  );
}
