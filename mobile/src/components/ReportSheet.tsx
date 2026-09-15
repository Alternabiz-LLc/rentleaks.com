import { useState } from "react";
import { Alert, Modal, Pressable, View } from "react-native";
import { useReport } from "@/api/hooks";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";
import { Button, Chip, Field, Text } from "./ui";

const REASONS = [
  { id: "scam", label: "Looks like a scam" },
  { id: "misleading", label: "Photos or price misleading" },
  { id: "unavailable", label: "No longer available" },
  { id: "discriminatory", label: "Discriminatory wording" },
  { id: "abusive", label: "Abusive or harassing" },
  { id: "other", label: "Something else" },
];

export function ReportSheet({
  visible,
  onClose,
  target,
}: {
  visible: boolean;
  onClose: () => void;
  target: { listingId?: string; userId?: string; messageId?: string };
}) {
  const t = useTheme();
  const report = useReport();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const submit = () => {
    if (!reason) return;
    report.mutate(
      { reason, note, ...target },
      {
        onSuccess: () => {
          setReason(null);
          setNote("");
          onClose();
          Alert.alert("Thanks — we’re on it", "A person reviews every report. If you have already paid someone, contact your bank and local police as well.");
        },
        onError: (e) => Alert.alert("Couldn’t send", e instanceof Error ? e.message : "Try again."),
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: t.c.overlay, justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable style={{ backgroundColor: t.c.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
          <Text variant="h2">What’s wrong?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {REASONS.map((r) => (
              <Chip key={r.id} label={r.label} selected={reason === r.id} onPress={() => setReason(r.id)} />
            ))}
          </View>
          <Field label="Anything we should know? (optional)" value={note} onChangeText={setNote} multiline maxLength={1000} />
          <Button label="Send report" variant="danger" disabled={!reason} loading={report.isPending} onPress={submit} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
