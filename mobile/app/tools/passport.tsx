import { useEffect, useState } from "react";
import { Alert, Share, Switch, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { Screen, StickyFooter } from "@/components/Screen";
import { Button, Card, Chip, Field, Notice, Section, Text } from "@/components/ui";
import { EMPLOYMENT, INCOME, emptyPassport, loadPassport, passportSummary, savePassport, type Passport } from "@/features/passport";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";

export default function PassportScreen() {
  const t = useTheme();
  const { user } = useAuth();
  const [p, setP] = useState<Passport>(emptyPassport());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPassport().then((saved) => setP(saved ?? { ...emptyPassport(), firstName: user?.name.split(" ")[0] ?? "" }));
  }, [user]);

  const set = (patch: Partial<Passport>) => setP((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      await savePassport(p);
      Alert.alert("Saved on this phone", "Attach the summary when you message a host.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      edges={[]}
      keyboard
      footer={
        <StickyFooter>
          <View style={{ flexDirection: "row", gap: space.md }}>
            <Button label="Preview & share" variant="secondary" style={{ flex: 1 }} onPress={() => Share.share({ message: passportSummary(p, user?.identityStatus === "verified") })} />
            <Button label="Save" style={{ flex: 1 }} loading={saving} onPress={save} />
          </View>
        </StickyFooter>
      }
    >
      <Notice
        tone="brand"
        icon="phone-portrait-outline"
        title="Stays on this phone"
        body="Encrypted in your device keychain. Nothing is uploaded — you choose when to paste the summary into a conversation. No documents, no exact income."
      />
      <Section title="About you">
        <Field label="First name" value={p.firstName} onChangeText={(firstName) => set({ firstName })} />
        <Field label="People moving in" keyboardType="number-pad" value={String(p.household)} onChangeText={(v) => set({ household: Math.max(1, Math.min(12, Number(v) || 1)) })} />
        <Field label="Moving for (optional)" placeholder="New job, studies, a project…" value={p.moveReason} onChangeText={(moveReason) => set({ moveReason })} maxLength={120} />
      </Section>
      <Section title="Work">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {EMPLOYMENT.map((e) => (
            <Chip key={e.value} label={e.label} selected={p.employment === e.value} onPress={() => set({ employment: e.value })} />
          ))}
        </View>
      </Section>
      <Section title="Income band" kicker="Optional">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {INCOME.map((i) => (
            <Chip key={i.value || "none"} label={i.label} selected={p.incomeBand === i.value} onPress={() => set({ incomeBand: i.value })} />
          ))}
        </View>
        <Card style={{ gap: space.sm }}>
          <ToggleRow label="Include the band in my summary" value={p.shareIncome} onChange={(shareIncome) => set({ shareIncome })} tint={t.c.brand} />
          <ToggleRow label="I have a guarantor" value={p.guarantor} onChange={(guarantor) => set({ guarantor })} tint={t.c.brand} />
          <ToggleRow label="I smoke (outside only)" value={p.smoker} onChange={(smoker) => set({ smoker })} tint={t.c.brand} />
        </Card>
        <Text variant="small" tone="ink3">
          Where source of income is protected, a host may not refuse you for paying with a voucher, and income tests apply only to your share of the rent.
        </Text>
      </Section>
      <Section title="References & pets">
        <Field label="References available" keyboardType="number-pad" value={String(p.references)} onChangeText={(v) => set({ references: Math.max(0, Math.min(9, Number(v) || 0)) })} />
        <Field label="Pets (leave empty for none)" placeholder="One calm cat" value={p.pets} onChangeText={(pets) => set({ pets })} />
      </Section>
      <Section title="A short introduction">
        <Field label="What a host should know" value={p.intro} onChangeText={(intro) => set({ intro })} multiline maxLength={400} hint={`${p.intro.length}/400`} />
      </Section>
    </Screen>
  );
}

function ToggleRow({ label, value, onChange, tint }: { label: string; value: boolean; onChange: (v: boolean) => void; tint: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Text style={{ flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: tint }} />
    </View>
  );
}
