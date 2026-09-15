import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActionSheetIOS, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useArchiveConversation, useBlock, useSendMessage, useThread } from "@/api/hooks";
import type { Message } from "@/api/types";
import { ReportSheet } from "@/components/ReportSheet";
import { Badge, ErrorState, Icon, IconButton, Notice, Skeleton, Text } from "@/components/ui";
import { ensurePush } from "@/lib/push";
import { money, timeAgo } from "@/lib/format";
import { useTheme } from "@/theme/ThemeProvider";
import { font, radius, space } from "@/theme/tokens";

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  /* Native-stack header: 44pt plus the status bar. Only iOS uses the offset. */
  const headerHeight = useSafeAreaInsets().top + 44;
  const thread = useThread(String(id));
  const send = useSendMessage(String(id));
  const block = useBlock();
  const archive = useArchiveConversation();
  const [text, setText] = useState("");
  const [reporting, setReporting] = useState<{ messageId?: string } | null>(null);
  const data = thread.data;

  /* Inverted list: newest first in data, rendered bottom-up, so the thread
     opens at the latest message with no scroll-to-end dance. */
  const messages = useMemo(() => [...(data?.messages ?? [])].reverse(), [data?.messages]);
  const lastMineId = messages.find((m) => m.mine && !m.pending)?.id;
  const seen = (m: Message) => m.id === lastMineId && !!data?.theirReadAt && data.theirReadAt >= m.at;

  const menu = () => {
    if (!data) return;
    const blockLabel = data.blocked ? "Unblock" : `Block ${data.counterpart.firstName}`;
    const archiveLabel = data.archived ? "Unarchive" : "Archive";
    const options = ["View listing", archiveLabel, "Report this conversation", blockLabel, "Cancel"];
    const act = (i: number) => {
      if (i === 0) router.push(`/listing/${encodeURIComponent(data.listing.id)}`);
      if (i === 1) {
        archive.mutate({ id: data.id, archived: !data.archived });
        if (!data.archived) router.back();
      }
      if (i === 2) setReporting({});
      if (i === 3) {
        const unblock = data.blocked;
        Alert.alert(unblock ? "Unblock?" : `Block ${data.counterpart.firstName}?`, unblock ? "You’ll be able to message each other again." : "Neither of you will be able to send messages in this conversation.", [
          { text: "Cancel", style: "cancel" },
          { text: unblock ? "Unblock" : "Block", style: "destructive", onPress: () => block.mutate({ userId: data.counterpart.id, unblock }) },
        ]);
      }
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 4, destructiveButtonIndex: 3 }, act);
    } else {
      Alert.alert("Conversation", undefined, [
        { text: options[0], onPress: () => act(0) },
        { text: options[1], onPress: () => act(1) },
        { text: options[2], onPress: () => act(2) },
        { text: options[3], style: "destructive", onPress: () => act(3) },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  if (thread.isError) return <ErrorState error={thread.error} onRetry={() => void thread.refetch()} />;

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    send.mutate(body, {
      onSuccess: () => {
        /* The reply is the first thing worth a push; ask now, in context. */
        if (messages.filter((m) => m.mine).length === 0) void ensurePush();
      },
      onError: (e) => {
        setText(body);
        Alert.alert("Not sent", e instanceof Error ? e.message : "Try again.");
      },
    });
  };

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: t.c.bg }}>
      <Stack.Screen
        options={{
          title: data ? data.counterpart.firstName : "",
          headerRight: () => <IconButton name="ellipsis-horizontal" label="Conversation options" onPress={menu} />,
        }}
      />
      {data ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open listing: ${data.listing.title}`}
          onPress={() => router.push(`/listing/${encodeURIComponent(data.listing.id)}`)}
          style={{ flexDirection: "row", gap: space.md, padding: space.md, marginHorizontal: space.lg, borderRadius: radius.md, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.line }}
        >
          <Image source={{ uri: data.listing.image }} style={{ width: 56, height: 56, borderRadius: 10 }} contentFit="cover" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h3" numberOfLines={1}>{data.listing.title}</Text>
            <Text variant="small" tone="value">{money(data.listing.allIn, data.listing.currency)}/mo all-in · deposit {money(data.listing.deposit, data.listing.currency)}</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Badge label={data.counterpart.identity === "verified" ? `${data.counterpart.firstName} is ID-verified` : `${data.counterpart.firstName} is not ID-verified`} tone={data.counterpart.identity === "verified" ? "success" : "neutral"} />
            </View>
          </View>
        </Pressable>
      ) : (
        <View style={{ marginHorizontal: space.lg, gap: 8 }}>
          <Skeleton height={80} radius={12} />
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={headerHeight}>
        <FlatList
          data={messages}
          inverted
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space.lg, gap: space.sm }}
          keyboardDismissMode="interactive"
          ListFooterComponent={
            data?.role === "renter" ? (
              <View style={{ marginBottom: space.md }}>
                <Notice tone="brand" icon="lock-closed-outline" title="RentLeaks never asks you to pay" body="See the home and read the lease before any money moves. Pay only to a named account, traceably." />
              </View>
            ) : data?.role === "host" ? (
              <View style={{ marginBottom: space.md }}>
                <Notice tone="brand" icon="time-outline" title="Fast replies win enquiries" body="Your reply rate and typical response time are shown on your listings." />
              </View>
            ) : null
          }
          renderItem={({ item }) => <Bubble m={item} seen={seen(item)} onReport={() => setReporting({ messageId: item.id })} />}
        />
        {data?.blocked ? (
          <View style={{ padding: space.lg }}>
            <Notice tone="warn" title="Messaging is off in this conversation" body="One of you has blocked the other." />
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: t.c.line, backgroundColor: t.c.surface }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Write a message"
              placeholderTextColor={t.c.ink3}
              multiline
              maxLength={4000}
              accessibilityLabel="Message"
              style={{ flex: 1, maxHeight: 140, minHeight: 42, fontFamily: font.body, fontSize: 16, color: t.c.ink, backgroundColor: t.c.bg, borderRadius: 21, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11 }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: !text.trim() }}
              disabled={!text.trim()}
              onPress={submit}
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: text.trim() ? t.c.brand : t.c.surfaceAlt, alignItems: "center", justifyContent: "center" }}
            >
              <Icon name="arrow-up" size={22} color={text.trim() ? t.c.onBrand : t.c.ink3} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
      <ReportSheet
        visible={!!reporting}
        onClose={() => setReporting(null)}
        target={{ userId: data?.counterpart.id, listingId: data?.listing.id, messageId: reporting?.messageId }}
      />
    </SafeAreaView>
  );
}

function Bubble({ m, seen, onReport }: { m: Message; seen: boolean; onReport: () => void }) {
  const t = useTheme();
  const flagged = !m.mine && m.signals.length > 0;
  return (
    <View style={{ alignItems: m.mine ? "flex-end" : "flex-start", gap: 4 }}>
      <Pressable
        onLongPress={m.mine ? undefined : onReport}
        accessibilityLabel={`${m.mine ? "You" : "Them"}: ${m.body}`}
        accessibilityHint={m.mine ? undefined : "Long press to report this message"}
        style={{
          maxWidth: "82%",
          backgroundColor: m.mine ? t.c.brand : flagged ? t.c.alertSoft : t.c.surface,
          borderRadius: 18,
          borderBottomRightRadius: m.mine ? 4 : 18,
          borderBottomLeftRadius: m.mine ? 18 : 4,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderWidth: m.mine ? 0 : 1,
          borderColor: flagged ? t.c.alert : t.c.line,
          opacity: m.pending ? 0.6 : 1,
        }}
      >
        <Text style={{ color: m.mine ? t.c.onBrand : t.c.ink }} selectable>{m.body}</Text>
      </Pressable>
      {flagged ? (
        <View style={{ width: "88%", gap: 6 }}>
          {m.signals.map((s) => (
            <Notice key={s.key} tone="alert" icon="warning-outline" title={s.label} body={s.advice} />
          ))}
          <Pressable onPress={onReport} accessibilityRole="button">
            <Text variant="small" tone="alert">Report this message</Text>
          </Pressable>
        </View>
      ) : null}
      <Text variant="small" tone="ink3">
        {m.pending ? "Sending…" : timeAgo(m.at)}
        {seen ? " · Seen" : ""}
      </Text>
    </View>
  );
}
