import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { WEB_URL } from "@/api/config";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/Logo";
import { Screen } from "@/components/Screen";
import { Button, Card, CheckRow, Field, Icon, Notice, Text, type IconName } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";

/**
 * Four ways into the marketplace, two account types. Owners, managers and
 * brokers, and departing tenants all list — they are `host` accounts, and the
 * composer records which of the three they are on each listing.
 */
const PERSONAS: Array<{ id: string; role: "renter" | "host"; icon: IconName; title: string; body: string }> = [
  { id: "renter", role: "renter", icon: "search-outline", title: "I’m looking for a home", body: "Rooms, co-living, furnished and 1-month+ stays." },
  { id: "owner", role: "host", icon: "home-outline", title: "I own or let a home", body: "Owners and landlords — list, screen and message renters." },
  { id: "manager", role: "host", icon: "briefcase-outline", title: "I’m a broker or manager", body: "Agents and operators listing on an owner’s behalf." },
  { id: "tenant", role: "host", icon: "swap-horizontal-outline", title: "I need to leave my lease", body: "Find someone to sublet or take over your lease." },
];

export default function SignUp() {
  const t = useTheme();
  const { signUp } = useAuth();
  const [persona, setPersona] = useState("renter");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const role = PERSONAS.find((p) => p.id === persona)?.role ?? "renter";

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signUp({ name: name.trim(), email: email.trim(), password, role, acceptTerms: accept });
      router.dismissAll();
      if (role === "host") router.push({ pathname: "/host/new", params: { role: persona } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]} keyboard>
      <Logo />
      <Text variant="h1">Join RentLeaks</Text>
      <View style={{ gap: space.sm }}>
        {PERSONAS.map((p) => {
          const on = p.id === persona;
          return (
            <Pressable key={p.id} onPress={() => setPersona(p.id)} accessibilityRole="radio" accessibilityState={{ checked: on }}>
              <Card style={{ flexDirection: "row", gap: space.md, alignItems: "center", borderColor: on ? t.c.brand : t.c.line, borderWidth: on ? 2 : 1 }}>
                <Icon name={p.icon} size={24} color={on ? t.c.brand : t.c.ink2} />
                <View style={{ flex: 1 }}>
                  <Text variant="h3">{p.title}</Text>
                  <Text variant="small" tone="ink3">{p.body}</Text>
                </View>
                <Icon name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? t.c.brand : t.c.ink3} />
              </Card>
            </Pressable>
          );
        })}
      </View>
      {error ? <Notice tone="alert" title={error} /> : null}
      <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field label="Password" hint="At least 8 characters." value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      <CheckRow checked={accept} onChange={setAccept} accessibilityLabel="Accept the terms, privacy policy and community guidelines">
        <Text variant="small" tone="ink2">
          I accept the{" "}
          <Text variant="small" tone="brand" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms.html`)}>terms</Text>,{" "}
          <Text variant="small" tone="brand" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy.html`)}>privacy policy</Text> and the community
          guidelines — no discrimination, no scams, no abuse.
        </Text>
      </CheckRow>
      <Button label="Create account" loading={busy} disabled={!name || !email || password.length < 8 || !accept} onPress={submit} />
    </Screen>
  );
}
