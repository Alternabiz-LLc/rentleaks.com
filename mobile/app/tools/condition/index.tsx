import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Button, Card, EmptyState, Field, Notice, Row, Section, Segmented } from "@/components/ui";
import { createReport, listReports, type ConditionReport } from "@/features/condition";
import { space } from "@/theme/tokens";

export default function ConditionReports() {
  const [reports, setReports] = useState<ConditionReport[]>([]);
  const [kind, setKind] = useState<ConditionReport["kind"]>("move-in");
  const [address, setAddress] = useState("");

  useFocusEffect(
    useCallback(() => {
      listReports().then(setReports);
    }, []),
  );

  const start = async () => {
    const r = await createReport(kind, "", address.trim());
    router.push(`/tools/condition/${r.id}`);
  };

  return (
    <Screen edges={[]} keyboard>
      <Notice
        tone="value"
        icon="shield-half-outline"
        title="The evidence that gets deposits back"
        body="Walk every room on day one. Each photo is timestamped and fingerprinted on your phone, then exported as a PDF you send to the landlord — and again on move-out."
      />
      <Section title="Start a report">
        <Segmented value={kind} onChange={setKind} options={[{ value: "move-in", label: "Move-in" }, { value: "move-out", label: "Move-out" }]} />
        <Field label="Address" value={address} onChangeText={setAddress} placeholder="12 Example St, Apt 3" />
        <Button label="Start walking the rooms" icon="camera-outline" onPress={() => void start().catch((e) => Alert.alert("Couldn’t start", String(e)))} />
      </Section>
      <Section title="Your reports">
        {reports.length ? (
          <Card padded={false} style={{ paddingHorizontal: space.lg }}>
            {reports.map((r, i) => (
              <Row
                key={r.id}
                icon={r.kind === "move-in" ? "enter-outline" : "exit-outline"}
                label={r.address || r.title}
                value={`${r.rooms.reduce((a, x) => a + x.items.length, 0)} photos · ${new Date(r.createdAt).toLocaleDateString()}`}
                onPress={() => router.push(`/tools/condition/${r.id}`)}
                last={i === reports.length - 1}
              />
            ))}
          </Card>
        ) : (
          <View>
            <EmptyState icon="images-outline" title="No reports yet" body="They stay on this phone until you export one." />
          </View>
        )}
      </Section>
    </Screen>
  );
}
