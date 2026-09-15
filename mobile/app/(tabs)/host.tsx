import { Image } from "expo-image";
import { router } from "expo-router";
import { Alert, FlatList, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDeleteListing, useHostListings, useMe, useSetListingStatus } from "@/api/hooks";
import type { HostListing } from "@/api/types";
import { RequireAuth } from "@/components/RequireAuth";
import { Badge, Button, Card, EmptyState, ErrorState, Notice, Skeleton, Text } from "@/components/ui";
import { money, shortDate } from "@/lib/format";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";

export default function HostTab() {
  return (
    <RequireAuth icon="key-outline" title="Host on RentLeaks" body="Owners, managers and departing tenants list here. Sign in to start.">
      <Dashboard />
    </RequireAuth>
  );
}

function Dashboard() {
  const t = useTheme();
  const q = useHostListings();
  const me = useMe();
  const items = q.data?.items ?? [];
  const live = items.filter((i) => i.moderation === "approved" && i.status !== "paused").length;
  const enquiries = items.reduce((a, i) => a + i.enquiries, 0);
  const saves = items.reduce((a, i) => a + i.saves, 0);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.c.bg }}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl }}
        ListHeaderComponent={
          <View style={{ gap: space.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text variant="h1" style={{ flex: 1 }}>Hosting</Text>
              <Button label="New listing" icon="add" size="sm" onPress={() => router.push("/host/new")} />
            </View>
            <View style={{ flexDirection: "row", gap: space.md }}>
              <Stat label="Live" value={live} />
              <Stat label="Enquiries" value={enquiries} />
              <Stat label="Saves" value={saves} />
              <Stat label="Unread" value={me.data?.counts.unread ?? 0} onPress={() => router.navigate("/inbox")} />
            </View>
            {me.data && me.data.user.identityStatus !== "verified" ? (
              <Notice tone="value" icon="shield-outline" title="Verified hosts get more enquiries" body="Renters filter for ID-verified hosts. Verify once from the You tab." />
            ) : null}
          </View>
        }
        renderItem={({ item }) => <HostRow item={item} />}
        ListEmptyComponent={
          q.isLoading ? (
            <View style={{ gap: space.lg }}>
              <Skeleton height={150} radius={16} />
              <Skeleton height={150} radius={16} />
            </View>
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          ) : (
            <EmptyState icon="home-outline" title="No listings yet" body="It takes about ten minutes with your phone’s camera." action={<Button label="List a home" onPress={() => router.push("/host/new")} />} />
          )
        }
      />
    </SafeAreaView>
  );
}

function Stat({ label, value, onPress }: { label: string; value: number; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flex: 1 }}>
      <Card style={{ padding: space.md, alignItems: "flex-start" }}>
        <Text variant="price">{value}</Text>
        <Text variant="micro" tone="ink3" numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
      </Card>
    </Pressable>
  );
}

const MOD = {
  pending: { label: "In review", tone: "warn" as const },
  approved: { label: "Approved", tone: "success" as const },
  declined: { label: "Declined", tone: "alert" as const },
};

function HostRow({ item }: { item: HostListing }) {
  const setStatus = useSetListingStatus();
  const del = useDeleteListing();
  const mod = MOD[item.moderation as keyof typeof MOD] ?? MOD.pending;
  const paused = item.status === "paused";

  return (
    <Card padded={false}>
      <Pressable onPress={() => router.push(`/listing/${encodeURIComponent(item.id)}`)} style={{ flexDirection: "row" }}>
        <Image source={{ uri: item.image }} style={{ width: 104, height: 104 }} contentFit="cover" />
        <View style={{ flex: 1, padding: space.md, gap: 4 }}>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Badge label={mod.label} tone={mod.tone} />
            {paused ? <Badge label="Paused" /> : item.status === "coming-soon" ? <Badge label="Coming soon" tone="brand" /> : null}
          </View>
          <Text variant="h3" numberOfLines={1}>{item.title}</Text>
          <Text variant="small" tone="value">{money(item.allIn, item.currency)}/mo all-in</Text>
          <Text variant="small" tone="ink3">
            {item.enquiries} enquiries · {item.saves} saves · until {shortDate(item.availableUntil)}
          </Text>
        </View>
      </Pressable>
      {item.moderation === "declined" && item.moderationNote ? (
        <View style={{ paddingHorizontal: space.md, paddingBottom: space.sm }}>
          <Notice tone="alert" title="Why it was declined" body={item.moderationNote} />
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: space.sm, padding: space.md, paddingTop: 0, flexWrap: "wrap" }}>
        <Button size="sm" icon="create-outline" label="Edit" onPress={() => router.push({ pathname: "/host/new", params: { id: item.id } })} />
        <Button
          size="sm"
          variant="secondary"
          icon={paused ? "play-outline" : "pause-outline"}
          label={paused ? "Resume" : "Pause"}
          loading={setStatus.isPending}
          onPress={() => setStatus.mutate({ id: item.id, status: paused ? "active" : "paused" })}
        />
        <Button
          size="sm"
          variant="secondary"
          icon="refresh-outline"
          label="Still available"
          onPress={() =>
            setStatus.mutate(
              { id: item.id, status: item.status },
              { onSuccess: () => Alert.alert("Confirmed", "Renters see this listing was confirmed today.") },
            )
          }
        />
        <Button
          size="sm"
          variant="ghost"
          label="Remove"
          onPress={() =>
            Alert.alert("Remove this listing?", "It and its enquiry threads are deleted. This can’t be undone.", [
              { text: "Cancel", style: "cancel" },
              { text: "Remove", style: "destructive", onPress: () => del.mutate(item.id) },
            ])
          }
        />
      </View>
    </Card>
  );
}
