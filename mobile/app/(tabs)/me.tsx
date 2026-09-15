import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Alert, View } from "react-native";
import { api } from "@/api/client";
import { API_URL, WEB_URL } from "@/api/config";
import { useBecomeHost, useMe } from "@/api/hooks";
import { isHostRole, useAuth } from "@/auth/AuthProvider";
import { Screen } from "@/components/Screen";
import { Badge, Button, Card, Row, Section, Text } from "@/components/ui";
import { space } from "@/theme/tokens";

export default function MeTab() {
  const { user, signOut, refresh, setUser } = useAuth();
  const me = useMe();
  const becomeHost = useBecomeHost();

  const startHosting = () =>
    Alert.alert("Start hosting?", "Your account can also list homes — as an owner, an agent, or a tenant passing on a lease. Renting keeps working as before.", [
      { text: "Not now", style: "cancel" },
      {
        text: "Start hosting",
        onPress: () =>
          becomeHost.mutate(undefined, {
            onSuccess: (r) => {
              setUser(r.user);
              router.push("/host/new");
            },
            onError: (e) => Alert.alert("Couldn’t switch", e instanceof Error ? e.message : "Try again."),
          }),
      },
    ]);

  const verify = async () => {
    try {
      /* Identity is checked in the browser and the document discarded there —
         the app hands the signed-in session over with a one-time code. */
      const { code } = await api<{ code: string }>("/api/v1/auth/handoff", { method: "POST" });
      await WebBrowser.openBrowserAsync(`${API_URL}/api/v1/auth/handoff?code=${code}&next=/verify`);
      await refresh();
    } catch (e) {
      Alert.alert("Couldn’t open verification", e instanceof Error ? e.message : "Try again.");
    }
  };

  return (
    <Screen onRefresh={() => void me.refetch()} refreshing={me.isRefetching}>
      <Text variant="h1">{user ? `Hi, ${user.name.split(" ")[0]}` : "You"}</Text>

      {user ? (
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Text variant="h3" style={{ flex: 1 }}>{user.email}</Text>
            <Badge label={user.role === "admin" ? "Founder" : user.role === "host" ? "Hosting" : "Renting"} tone="brand" />
          </View>
          {user.identityStatus === "verified" ? (
            <Badge label="Government ID verified" tone="success" icon="shield-checkmark" />
          ) : (
            <>
              <Text variant="small" tone="ink2">
                {user.identityStatus === "pending"
                  ? "Your ID check is with a reviewer."
                  : "Verify your ID once. Hosts and renters see the badge; nobody sees the document — it is checked on your device and discarded."}
              </Text>
              {user.identityStatus !== "pending" ? <Button label="Verify my identity" icon="shield-checkmark-outline" onPress={verify} /> : null}
            </>
          )}
        </Card>
      ) : (
        <Card style={{ gap: space.md }}>
          <Text>Sign in to message hosts, save homes across devices and list your own place.</Text>
          <Button label="Sign in" onPress={() => router.push("/auth/sign-in")} />
          <Button label="Create an account" variant="secondary" onPress={() => router.push("/auth/sign-up")} />
        </Card>
      )}

      <Section kicker="Renter toolkit" title="Protect yourself">
        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          <Row icon="id-card-outline" label="Renter passport" value="On this phone" onPress={() => router.push("/tools/passport")} />
          <Row icon="camera-outline" label="Move-in condition report" value="Deposit evidence" onPress={() => router.push("/tools/condition")} />
          <Row icon="calculator-outline" label="Affordability & split" onPress={() => router.push("/tools/afford")} />
          <Row icon="receipt-outline" label="Is this fee legal?" onPress={() => router.push("/tools/fee-check")} />
          <Row icon="library-outline" label="Market rules, cited" onPress={() => router.push("/tools/rules")} last />
        </Card>
      </Section>

      {user && !isHostRole(user) ? (
        <Section kicker="Have a room to let?" title="Start hosting">
          <Card style={{ gap: space.md }}>
            <Text tone="ink2">Owners, agents and departing tenants list here. Every listing is checked by a person, every fee is checked against local law, and RentLeaks never takes a cut of rent.</Text>
            <Button label="List a home" icon="key-outline" variant="secondary" loading={becomeHost.isPending} onPress={startHosting} />
          </Card>
        </Section>
      ) : null}

      {isHostRole(user) ? (
        <Section kicker="Hosting" title="Your listings">
          <Card padded={false} style={{ paddingHorizontal: space.lg }}>
            <Row icon="add-circle-outline" label="List a home" onPress={() => router.push("/host/new")} />
            <Row
              icon="key-outline"
              label="Dashboard"
              value={me.data ? `${me.data.counts.listings.approved ?? 0} live · ${me.data.counts.listings.pending ?? 0} in review` : undefined}
              onPress={() => router.push("/host")}
              last={user?.role !== "admin"}
            />
            {user?.role === "admin" ? <Row icon="checkmark-done-outline" label="Review queue" onPress={() => router.push("/admin")} last /> : null}
          </Card>
        </Section>
      ) : null}

      <Section title="App">
        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          <Row icon="settings-outline" label="Settings" onPress={() => router.push("/settings")} />
          <Row icon="help-circle-outline" label="Help & FAQ" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/faq.html`)} />
          <Row icon="mail-outline" label="Contact us" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/contact.html`)} />
          <Row icon="document-outline" label="Terms" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/terms.html`)} />
          <Row icon="lock-closed-outline" label="Privacy" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/privacy.html`)} last />
        </Card>
      </Section>

      {user ? <Button label="Sign out" variant="secondary" onPress={() => void signOut()} /> : null}
      <Text variant="small" tone="ink3" style={{ textAlign: "center" }}>
        RentLeaks is operated by Alternabiz LLC. We never hold deposits or rent.
      </Text>
    </Screen>
  );
}
