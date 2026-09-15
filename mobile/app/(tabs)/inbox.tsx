import { Image } from "expo-image";
import { router } from "expo-router";
import { Alert, FlatList, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useArchiveConversation, useInbox } from "@/api/hooks";
import { RequireAuth } from "@/components/RequireAuth";
import { Badge, EmptyState, ErrorState, Icon, Skeleton, Text } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";

export default function Inbox() {
  return (
    <RequireAuth icon="chatbubbles-outline" title="Your conversations live here" body="Ask hosts about a home before you pay anything. Sign in to message.">
      <InboxList />
    </RequireAuth>
  );
}

function InboxList() {
  const t = useTheme();
  const q = useInbox();
  const archive = useArchiveConversation();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.c.bg }}>
      <FlatList
        data={q.data?.items ?? []}
        keyExtractor={(c) => c.id}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
        contentContainerStyle={{ padding: space.lg }}
        ListHeaderComponent={<Text variant="h1" style={{ marginBottom: space.lg }}>Inbox</Text>}
        ListEmptyComponent={
          q.isLoading ? (
            <View style={{ gap: space.lg }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ flexDirection: "row", gap: space.md }}>
                  <Skeleton height={56} width={56} radius={12} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton height={16} width="50%" />
                    <Skeleton height={12} width="80%" />
                  </View>
                </View>
              ))}
            </View>
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          ) : (
            <EmptyState icon="chatbubble-ellipses-outline" title="No conversations yet" body="When you ask about a home — or someone asks about yours — the thread appears here." />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.c.line, marginLeft: 72 }} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.counterpart.firstName} about ${item.listing.title}${item.unread ? ", unread" : ""}`}
            accessibilityHint="Long press to archive"
            onPress={() => router.push(`/conversation/${item.id}`)}
            onLongPress={() =>
              Alert.alert("Archive this conversation?", "It comes back to your inbox if either of you writes again.", [
                { text: "Cancel", style: "cancel" },
                { text: "Archive", onPress: () => archive.mutate({ id: item.id, archived: true }) },
              ])
            }
            style={({ pressed }) => ({ flexDirection: "row", gap: space.md, paddingVertical: space.md, opacity: pressed ? 0.7 : 1 })}
          >
            <Image source={{ uri: item.listing.image }} style={{ width: 56, height: 56, borderRadius: 12 }} contentFit="cover" />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text variant="h3" style={{ flex: 1 }} numberOfLines={1}>
                  {item.counterpart.firstName}
                  <Text variant="small" tone="ink3"> · {item.role === "host" ? "enquiry" : "host"}</Text>
                </Text>
                <Text variant="small" tone="ink3">{timeAgo(item.lastMessageAt)}</Text>
              </View>
              <Text variant="small" tone="ink2" numberOfLines={1}>{item.listing.title}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {item.lastMessage?.flagged ? <Icon name="warning" size={14} color={t.c.alert} /> : null}
                <Text variant="small" tone={item.unread ? "ink" : "ink3"} numberOfLines={1} style={{ flex: 1, fontFamily: item.unread ? "Inter_600SemiBold" : undefined }}>
                  {item.lastMessage ? `${item.lastMessage.mine ? "You: " : ""}${item.lastMessage.body}` : "No messages yet"}
                </Text>
                {item.unread ? <Badge label="New" tone="value" /> : null}
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
