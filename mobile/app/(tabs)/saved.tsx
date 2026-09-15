import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSaved, useSearches, useUpdateSearch } from "@/api/hooks";
import type { SavedSearch } from "@/api/types";
import { ListingCard } from "@/components/ListingCard";
import { RequireAuth } from "@/components/RequireAuth";
import { ListingCardSkeleton } from "@/components/ListingCard";
import { Badge, Button, Card, EmptyState, ErrorState, IconButton, Segmented, Text } from "@/components/ui";
import { useRecent } from "@/features/recent";
import { useSearch } from "@/features/search-state";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";

export default function Saved() {
  return (
    <RequireAuth icon="heart-outline" title="Keep a shortlist" body="Save homes and searches on every device, and get a push when something new matches.">
      <SavedBody />
    </RequireAuth>
  );
}

function SavedBody() {
  const t = useTheme();
  const [tab, setTab] = useState<"homes" | "searches" | "recent">("homes");
  const saved = useSaved();
  const searches = useSearches();
  const recent = useRecent();
  useFocusEffect(useCallback(() => recent.reload(), [recent.reload]));

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.c.bg }}>
      <View style={{ padding: space.lg, gap: space.md }}>
        <Text variant="h1">Saved</Text>
        <Segmented value={tab} onChange={setTab} options={[{ value: "homes", label: "Homes" }, { value: "searches", label: "Alerts" }, { value: "recent", label: "Recent" }]} />
      </View>
      {tab === "homes" ? (
        <FlatList
          data={saved.data?.items ?? []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.xl }}
          refreshing={saved.isRefetching}
          onRefresh={() => void saved.refetch()}
          renderItem={({ item }) => (
            <View style={{ opacity: item.available ? 1 : 0.5, gap: 6 }}>
              {!item.available ? <Badge label="No longer available" tone="alert" /> : null}
              <ListingCard item={item} />
            </View>
          )}
          ListEmptyComponent={
            saved.isLoading ? (
              <View style={{ gap: space.xl }}>
                <ListingCardSkeleton />
                <ListingCardSkeleton />
              </View>
            ) : saved.isError ? (
              <ErrorState error={saved.error} onRetry={() => void saved.refetch()} />
            ) : (
              <EmptyState icon="heart-outline" title="Nothing saved yet" body="Tap the heart on any home to keep it here." action={<Button label="Explore homes" onPress={() => router.navigate("/")} />} />
            )
          }
        />
      ) : tab === "recent" ? (
        <FlatList
          data={recent.items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.xl }}
          renderItem={({ item }) => <ListingCard item={item} />}
          ListEmptyComponent={<EmptyState icon="time-outline" title="Nothing viewed yet" body="Homes you open show up here, on this phone only." />}
        />
      ) : (
        <FlatList
          data={searches.data?.items ?? []}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.md }}
          renderItem={({ item }) => <SearchRow s={item} />}
          ListEmptyComponent={
            searches.isLoading ? null : (
              <EmptyState icon="notifications-outline" title="No saved searches" body="On Explore, set your city and dates, then tap the bell. We’ll push new matches as they’re approved." />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

function SearchRow({ s }: { s: SavedSearch }) {
  const t = useTheme();
  const update = useUpdateSearch();
  const { replaceQuery } = useSearch();
  return (
    <Card style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Text variant="h3" style={{ flex: 1 }}>{s.label}</Text>
        <IconButton
          name="trash-outline"
          label="Delete saved search"
          tone={t.c.alert}
          onPress={() =>
            Alert.alert("Delete this search?", s.label, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => update.mutate({ id: s.id, remove: true }) },
            ])
          }
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="small" tone="ink2">Push me new matches</Text>
        <Switch
          value={s.alerts}
          trackColor={{ true: t.c.brand, false: t.c.lineStrong }}
          onValueChange={(v) => update.mutate({ id: s.id, alerts: v })}
          accessibilityLabel="Alerts for this search"
        />
      </View>
      <Button
        label="Run this search"
        variant="secondary"
        size="sm"
        onPress={() => {
          replaceQuery(s.query);
          router.navigate("/");
        }}
      />
    </Card>
  );
}
