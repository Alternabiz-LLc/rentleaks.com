import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { Screen } from "@/components/Screen";
import { Button, Field, Notice, Text } from "@/components/ui";
import { space } from "@/theme/tokens";

/** Opened from the reset email (universal link → /auth/reset?token=…). */
export default function Reset() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = typeof token === "string" && /^[a-f0-9]{64}$/i.test(token);

  const submit = async () => {
    if (password !== confirm) return setError("The two passwords don’t match.");
    setBusy(true);
    setError(null);
    try {
      await resetPassword(String(token), password);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!valid) {
    return (
      <Screen edges={[]}>
        <Notice tone="alert" title="This link isn’t valid" body="Reset links work once and expire after 30 minutes. Ask for a new one." />
        <Button label="Send a new link" onPress={() => router.replace("/auth/forgot")} />
      </Screen>
    );
  }

  return (
    <Screen edges={[]} keyboard>
      <View style={{ gap: space.sm }}>
        <Text variant="h1">Choose a new password</Text>
        <Text tone="ink3">Saving it signs you out on every other device.</Text>
      </View>
      {error ? <Notice tone="alert" title={error} /> : null}
      <Field label="New password" hint="At least 8 characters." value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      <Field label="Repeat it" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={submit} />
      <Button label="Save and sign in" loading={busy} disabled={password.length < 8 || !confirm} onPress={submit} />
    </Screen>
  );
}
