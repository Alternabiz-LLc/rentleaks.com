import { Link, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/Logo";
import { Screen } from "@/components/Screen";
import { Button, Field, Notice, Text } from "@/components/ui";
import { space } from "@/theme/tokens";

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]} keyboard>
      <View style={{ gap: space.sm }}>
        <Logo />
        <Text variant="h1">Welcome back</Text>
        <Text tone="ink3">One account for renting, hosting and taking over a lease.</Text>
      </View>
      {error ? <Notice tone="alert" title={error} /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
      <Button label="Sign in" loading={busy} disabled={!email || !password} onPress={submit} />
      <Link href="/auth/forgot" asChild>
        <Button label="Forgot your password?" variant="ghost" />
      </Link>
      <Link href="/auth/sign-up" replace asChild>
        <Button label="New here? Create an account" variant="ghost" />
      </Link>
    </Screen>
  );
}
