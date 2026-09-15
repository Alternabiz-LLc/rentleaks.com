import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { api } from "@/api/client";
import { Screen } from "@/components/Screen";
import { Button, Field, Notice, Text } from "@/components/ui";
import { space } from "@/theme/tokens";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ message: string }>("/api/v1/auth/forgot", { body: { email: email.trim() } });
      setSent(r.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]} keyboard>
      <View style={{ gap: space.sm }}>
        <Text variant="h1">Reset your password</Text>
        <Text tone="ink3">We’ll email a link that works once and expires in 30 minutes. Open it on this phone and the app takes you straight to a new password.</Text>
      </View>
      {sent ? <Notice tone="success" icon="mail-outline" title="Check your email" body={sent} /> : null}
      {error ? <Notice tone="alert" title={error} /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" onSubmitEditing={submit} />
      <Button label={sent ? "Send again" : "Send reset link"} loading={busy} disabled={!email.includes("@")} onPress={submit} />
      <Button label="Back to sign in" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
