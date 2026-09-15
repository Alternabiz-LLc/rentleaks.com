import { router } from "expo-router";
import { Alert, Linking } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { Screen } from "@/components/Screen";
import { Button, Card, Row, Section, Segmented, Text } from "@/components/ui";
import { clearPassport } from "@/features/passport";
import { useThemeChoice, type ThemeChoice } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";

export default function Settings() {
  const { choice, setChoice } = useThemeChoice();
  const { user, deleteAccount } = useAuth();

  const confirmDelete = () =>
    Alert.alert(
      "Delete your account?",
      "This permanently removes your account, your listings, saved homes and conversations. It can’t be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
              await clearPassport().catch(() => {});
              router.dismissAll();
            } catch (e) {
              Alert.alert("Not deleted", e instanceof Error ? e.message : "Try again.");
            }
          },
        },
      ],
    );

  return (
    <Screen edges={[]}>
      <Section title="Appearance">
        <Segmented<ThemeChoice>
          value={choice}
          onChange={setChoice}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </Section>
      <Section title="Notifications & permissions">
        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          <Row icon="notifications-outline" label="Open system settings" onPress={() => void Linking.openSettings()} last />
        </Card>
        <Text variant="small" tone="ink3">Messages and saved-search alerts are the only pushes we send.</Text>
      </Section>
      <Section title="Your data">
        <Button
          label="Erase renter passport from this phone"
          variant="secondary"
          onPress={() => clearPassport().then(() => Alert.alert("Erased", "Your passport is gone from this device."))}
        />
        {user && user.role !== "admin" ? <Button label="Delete my account" variant="danger" onPress={confirmDelete} /> : null}
      </Section>
    </Screen>
  );
}
