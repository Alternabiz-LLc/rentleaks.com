import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { useQueue, useResolveReport, useReview } from "@/api/hooks";
import type { QueueListing, QueueReport } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Notice, Segmented, Text } from "@/components/ui";
import { money, timeAgo } from "@/lib/format";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";

/** Founder view on a phone: approve or decline, and work reports. Status only — never documents. */
export default function AdminQueue() {
  const t = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const q = useQueue(isAdmin);
  const [tab, setTab] = useState<"listings" | "reports">("listings");

  if (!isAdmin) return <EmptyState icon="lock-closed-outline" title="Founder account only" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <View style={{ padding: space.lg }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "listings", label: `Listings (${q.data?.listings.length ?? 0})` },
            { value: "reports", label: `Reports (${q.data?.reports.length ?? 0})` },
          ]}
        />
      </View>
      {tab === "listings" ? (
        <FlatList
          data={q.data?.listings ?? []}
          keyExtractor={(i) => i.id}
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          contentContainerStyle={{ padding: space.lg, paddingTop: 0, gap: space.lg }}
          renderItem={({ item }) => <ReviewCard item={item} />}
          ListEmptyComponent={q.isLoading ? null : <EmptyState icon="checkmark-done-outline" title="Queue is clear" />}
        />
      ) : (
        <FlatList
          data={q.data?.reports ?? []}
          keyExtractor={(i) => i.id}
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          contentContainerStyle={{ padding: space.lg, paddingTop: 0, gap: space.lg }}
          renderItem={({ item }) => <ReportCard item={item} />}
          ListEmptyComponent={q.isLoading ? null : <EmptyState icon="flag-outline" title="No open reports" />}
        />
      )}
    </View>
  );
}

function ReviewCard({ item }: { item: QueueListing }) {
  const review = useReview();
  const [note, setNote] = useState("");
  const decide = (decision: "approved" | "declined") =>
    review.mutate(
      { id: item.id, decision, note },
      { onError: (e) => Alert.alert("Not saved", e instanceof Error ? e.message : "Try again.") },
    );

  return (
    <Card padded={false}>
      <Pressable onPress={() => router.push(`/listing/${encodeURIComponent(item.id)}`)}>
        <Image source={{ uri: item.image }} style={{ width: "100%", aspectRatio: 2 }} contentFit="cover" />
      </Pressable>
      <View style={{ padding: space.lg, gap: space.sm }}>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          <Badge label={item.typeLabel} tone="brand" />
          <Badge label={`${item.photos.length} photos`} tone={item.photos.length >= 4 ? "success" : "alert"} />
          <Badge label={`Host ID: ${item.host.identity}`} tone={item.host.identity === "verified" ? "success" : "neutral"} />
          <Badge label={`submitted ${timeAgo(item.submittedAt)}`} />
        </View>
        <Text variant="h3">{item.title}</Text>
        <Text variant="small" tone="value">{money(item.allIn, item.currency)}/mo all-in · deposit {money(item.deposit, item.currency)}</Text>
        <Text variant="small" tone="ink3">{item.address} · {item.cityName}</Text>
        <Text variant="small" tone="ink2" numberOfLines={5}>{item.description}</Text>
        <Text variant="small" tone="ink3">{item.host.name} · {item.host.email} · since {item.host.memberSince}</Text>
        {item.gate.length ? (
          <Notice tone="alert" title={`Gate fails ${item.gate.length} check(s) under today’s rules`} body={item.gate.map((g) => `• ${g.title}`).join("\n")} />
        ) : (
          <Notice tone="success" title="Passes the publication gate" />
        )}
        <Field label="Note to the seller (required to decline)" value={note} onChangeText={setNote} multiline />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button label="Decline" variant="danger" style={{ flex: 1 }} disabled={note.trim().length < 8} loading={review.isPending} onPress={() => decide("declined")} />
          <Button label="Approve" style={{ flex: 1 }} loading={review.isPending} onPress={() => decide("approved")} />
        </View>
      </View>
    </Card>
  );
}

function ReportCard({ item }: { item: QueueReport }) {
  const resolve = useResolveReport();
  return (
    <Card style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Badge label={item.reason} tone="alert" />
        <Badge label={timeAgo(item.createdAt)} />
      </View>
      {item.listing ? (
        <Pressable onPress={() => router.push(`/listing/${encodeURIComponent(item.listing!.id)}`)}>
          <Text variant="h3" tone="brand">{item.listing.title}</Text>
        </Pressable>
      ) : null}
      <Text variant="small" tone="ink2">{item.note || "No note."}</Text>
      <Text variant="small" tone="ink3">Reported by {item.reporter}{item.messageId ? " · about a message" : ""}</Text>
      <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
        <Button size="sm" variant="secondary" label="Dismiss" onPress={() => resolve.mutate({ id: item.id, status: "dismissed" })} />
        <Button size="sm" label="Actioned" onPress={() => resolve.mutate({ id: item.id, status: "actioned" })} />
        {item.listing ? (
          <Button
            size="sm"
            variant="danger"
            label="Unpublish listing"
            onPress={() =>
              Alert.alert("Unpublish?", "The listing is declined with a note and leaves the catalogue.", [
                { text: "Cancel", style: "cancel" },
                { text: "Unpublish", style: "destructive", onPress: () => resolve.mutate({ id: item.id, status: "actioned", unpublish: true }) },
              ])
            }
          />
        ) : null}
      </View>
    </Card>
  );
}
