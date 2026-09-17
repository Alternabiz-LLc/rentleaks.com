import { Link, router } from "expo-router";
import { useState } from "react";
import { ApiError } from "@/api/client";
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
  /* Shown once the server says this is a desk account with two-factor. */
  const [needsCode, setNeedsCode] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password, needsCode ? otp.trim() : undefined);
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.code === "mfa_required") {
        setNeedsCode(true);
        setError(null);
        return;
      }
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
      {needsCode ? (
        <Field
          label="Authenticator code"
          hint="The 6-digit code from your authenticator app, or a recovery code."
          value={otp}
          onChangeText={setOtp}
          autoCapitalize="none"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          keyboardType="number-pad"
          autoFocus
          onSubmitEditing={submit}
        />
      ) : null}
      <Button label={needsCode ? "Verify and sign in" : "Sign in"} loading={busy} disabled={!email || !password || (needsCode && otp.trim().length < 6)} onPress={submit} />
      <Link href="/auth/forgot" asChild>
        <Button label="Forgot your password?" variant="ghost" />
      </Link>
      <Link href="/auth/sign-up" replace asChild>
        <Button label="New here? Create an account" variant="ghost" />
      </Link>
    </Screen>
  );
}
