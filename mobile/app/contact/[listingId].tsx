import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { useListing, useStartConversation } from "@/api/hooks";
import { Screen, StickyFooter } from "@/components/Screen";
import { Button, Chip, Field, Notice, Section, Text } from "@/components/ui";
import { loadPassport, passportSummary } from "@/features/passport";
import { useAuth } from "@/auth/AuthProvider";
import { shortDate } from "@/lib/format";
import { ensurePush } from "@/lib/push";
import { useSearch } from "@/features/search-state";

/**
 * The first message. Prompts are the questions that separate a real home from
 * a scam — asked before anyone pays anything.
 */
export default function Contact() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const { query } = useSearch();
  const q = useListing(String(listingId));
  const start = useStartConversation();
  const { user } = useAuth();
  const l = q.data?.listing;

  const dates = query.moveIn
    ? `from ${shortDate(query.moveIn)}${query.moveOut ? ` to ${shortDate(query.moveOut)}` : ""}`
    : l
      ? `from ${shortDate(l.availableFrom)}`
      : "";

  const [body, setBody] = useState("");
  useEffect(() => {
    if (l && !body) {
      setBody(`Hi ${l.host.firstName}, I’m interested in “${l.title}” ${dates}. Is it still available for those dates?`);
    }
    // Seed once, when the listing arrives; never overwrite what was typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l?.id]);

  const prompts = [
    "Could we do a live video walkthrough of the actual rooms?",
    "Who is named on the lease, and who holds the deposit?",
    "Is anything not included in the all-in price?",
    "Who else lives there, and what is the building like day to day?",
    ...(l?.housingType === "lease-break" ? ["Has the landlord consented to the takeover in writing?"] : []),
  ];

  const add = (p: string) => setBody((b) => (b.includes(p) ? b : `${b.trim()}\n\n${p}`));

  const attachPassport = async () => {
    const p = await loadPassport();
    if (!p) {
      Alert.alert("No passport yet", "Create your renter passport in the You tab first — it stays on this phone until you share it.", [
        { text: "Not now", style: "cancel" },
        { text: "Create it", onPress: () => router.push("/tools/passport") },
      ]);
      return;
    }
    setBody((b) => `${b.trim()}\n\n${passportSummary(p, user?.identityStatus === "verified")}`);
  };

  const send = () => {
    if (!l) return;
    start.mutate(
      { listingId: l.id, body },
      {
        onSuccess: ({ conversationId }) => {
          router.dismiss();
          router.push(`/conversation/${conversationId}`);
          /* The host's reply is the first push worth asking for. */
          void ensurePush();
        },
        onError: (e) => Alert.alert("Not sent", e instanceof Error ? e.message : "Try again."),
      },
    );
  };

  return (
    <Screen
      edges={[]}
      keyboard
      footer={
        <StickyFooter>
          <Button label="Send message" icon="send" disabled={body.trim().length < 2 || !l} loading={start.isPending} onPress={send} />
        </StickyFooter>
      }
    >
      <Notice
        tone="brand"
        icon="shield-checkmark-outline"
        title="Keep the conversation here until you’ve seen the home"
        body="RentLeaks never asks for payment. We flag messages that push for wire transfers, gift cards or paying before a viewing."
      />
      <Field label="Your message" value={body} onChangeText={setBody} multiline maxLength={4000} />
      <Section title="Good questions to ask">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {prompts.map((p) => (
            <Chip key={p} label={p} onPress={() => add(p)} icon="add" />
          ))}
        </View>
      </Section>
      <Section title="Introduce yourself faster">
        <Button label="Attach my renter passport summary" variant="secondary" icon="id-card-outline" onPress={attachPassport} />
        <Text variant="small" tone="ink3">Adds a short summary you control — no documents, no exact income.</Text>
      </Section>
    </Screen>
  );
}
