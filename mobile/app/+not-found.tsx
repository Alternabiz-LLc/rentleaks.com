import { router, Stack } from "expo-router";
import { Screen } from "@/components/Screen";
import { Button, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Not found" }} />
      <EmptyState icon="compass-outline" title="That page isn’t here" action={<Button label="Go to Explore" onPress={() => router.replace("/")} />} />
    </Screen>
  );
}
