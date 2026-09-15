import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { Animated, FlatList, Pressable, Share, View, useWindowDimensions } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useListing, useToggleSave } from "@/api/hooks";
import { WEB_URL } from "@/api/config";
import type { Detail } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { DealCard, FeeLedger, PriceTruth, RulesPanel, StayAndAfford, TakeoverDesk, TrustLedger } from "@/components/Evidence";
import { ListingCard } from "@/components/ListingCard";
import { PhotoViewer } from "@/components/PhotoViewer";
import { ReportSheet } from "@/components/ReportSheet";
import { StickyFooter } from "@/components/Screen";
import { Badge, Button, Card, Chip, ErrorState, Icon, IconButton, Notice, Section, Skeleton, Text } from "@/components/ui";
import { recordView } from "@/features/recent";
import { PETS, humanize, money } from "@/lib/format";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { user } = useAuth();
  const q = useListing(String(id));
  const save = useToggleSave();
  const [reporting, setReporting] = useState(false);
  const [more, setMore] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  /* The header is transparent over the photos and fades to paper, with the
     title, once the gallery has scrolled away. */
  const scrollY = useRef(new Animated.Value(0)).current;
  const heroH = W * 0.78;
  const barH = insets.top + 44;
  const barOpacity = scrollY.interpolate({ inputRange: [heroH - barH - 60, heroH - barH], outputRange: [0, 1], extrapolate: "clamp" });

  const card = q.data?.listing;
  useEffect(() => {
    if (card) void recordView(card);
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <Skeleton height={W * 0.75} radius={0} />
        <View style={{ padding: space.lg, gap: space.md }}>
          <Skeleton height={28} width="80%" />
          <Skeleton height={16} width="50%" />
          <Skeleton height={120} />
        </View>
      </View>
    );
  }
  if (q.isError || !q.data) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg, paddingTop: insets.top + 60 }}>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </View>
    );
  }

  const { listing: l, similar, viewer } = q.data;
  const ev = l.evidence;

  const onSave = () => {
    if (!user) return router.push("/auth/sign-in");
    save.mutate({ id: l.id, saved: viewer.saved });
  };

  const onShare = () =>
    Share.share({
      message: `${l.title} — ${money(l.allIn, l.currency)}/mo all-in on RentLeaks\n${WEB_URL}/listings/${encodeURIComponent(l.id)}`,
    }).catch(() => {});

  const onContact = () => {
    if (!user) return router.push("/auth/sign-in");
    if (viewer.conversationId) return router.push(`/conversation/${viewer.conversationId}`);
    router.push(`/contact/${encodeURIComponent(l.id)}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <Stack.Screen
        options={{
          headerLeft: () => <IconButton name="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <IconButton name="share-outline" label="Share" onPress={onShare} />
              <IconButton name={viewer.saved ? "heart" : "heart-outline"} label={viewer.saved ? "Remove from saved" : "Save"} active={viewer.saved} onPress={onSave} />
            </View>
          ),
        }}
      />
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: space.xxxl }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        <Gallery listing={l} width={W} onOpen={setViewing} />

        <View style={{ padding: space.lg, gap: space.xl }}>
          {l.moderation !== "approved" || l.status === "paused" ? (
            <Notice
              tone={l.moderation === "declined" ? "alert" : "warn"}
              title={l.moderation === "pending" ? "In review — only you can see this" : l.moderation === "declined" ? "Declined — only you can see this" : "Paused — hidden from renters"}
            />
          ) : null}

          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Badge label={l.typeLabel} tone="brand" />
              {l.verified ? <Badge label="ID-verified host" tone="success" icon="shield-checkmark" /> : <Badge label="Host not ID-verified" tone="neutral" />}
              {l.noFee ? <Badge label="No broker fee" tone="success" /> : null}
              {l.sponsored ? <Badge label="Sponsored" tone="warn" /> : null}
            </View>
            <Text variant="h1">{l.title}</Text>
            <Text tone="ink3">
              {l.address ? `${l.address} · ` : ""}
              {l.neighborhood}, {l.cityName}
            </Text>
          </View>

          <Card style={{ gap: space.md }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
              <Text variant="micro" tone="ink3">All-in monthly</Text>
              <Text variant="small" tone="ink3">Base {money(l.price, l.currency)}</Text>
            </View>
            <Text variant="hero" tone="value" style={{ fontFamily: "Inter_700Bold" }}>
              {money(l.allIn, l.currency)}
            </Text>
            <View style={{ flexDirection: "row", gap: space.lg }}>
              <Fact icon="bed-outline" label={l.beds ? `${l.beds} bed` : "Studio"} />
              <Fact icon="water-outline" label={`${l.baths} bath${l.privateBath ? " · private" : ""}`} />
              {l.sqft ? <Fact icon="resize-outline" label={`${l.sqft} sqft`} /> : null}
            </View>
            <View style={{ flexDirection: "row", gap: space.lg }}>
              <Fact icon="cube-outline" label={l.furnishedLevel === "fully" ? "Furnished" : l.furnishedLevel === "partly" ? "Part-furnished" : "Unfurnished"} />
              <Fact icon="paw-outline" label={PETS[l.petsPolicy] ?? "Ask about pets"} />
              <Fact icon="time-outline" label={`${l.minStayMonths}–${l.maxStayMonths} mo`} />
            </View>
            <Text variant="small" tone="ink3">Deposit {money(l.deposit, l.currency)} — paid to the landlord, never to RentLeaks.</Text>
          </Card>

          <DealCard ev={ev} />

          <HostCard listing={l} />

          <Section title="About this home">
            <Text numberOfLines={more ? undefined : 6}>{l.description}</Text>
            {l.description.length > 280 ? (
              <Pressable onPress={() => setMore((m) => !m)} accessibilityRole="button">
                <Text tone="brand" variant="label">{more ? "Show less" : "Read more"}</Text>
              </Pressable>
            ) : null}
            {l.commuteNote ? <Text variant="small" tone="ink3">{l.commuteNote}</Text> : null}
            {l.tourUrl ? <Button label="Open the video tour" variant="secondary" icon="videocam-outline" onPress={() => WebBrowser.openBrowserAsync(l.tourUrl!)} /> : null}
          </Section>

          {l.amenities.length ? (
            <Section title="What’s included">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {l.amenities.map((a) => (
                  <Chip key={a} label={humanize(a)} />
                ))}
                {l.workplaceReady ? <Chip label="Work-ready" icon="laptop-outline" /> : null}
                {l.utilitiesIncl ? <Chip label="Utilities included" icon="flash-outline" /> : null}
              </View>
            </Section>
          ) : null}

          {l.accessibility.length ? (
            <Section title="Access">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {l.accessibility.map((a) => (
                  <Chip key={a} label={humanize(a)} icon="accessibility-outline" />
                ))}
              </View>
            </Section>
          ) : null}

          <FeeLedger ev={ev} listing={l} />
          <PriceTruth ev={ev} listing={l} />
          <TrustLedger ev={ev} />
          <TakeoverDesk ev={ev} />
          <StayAndAfford ev={ev} listing={l} />
          <RulesPanel ev={ev} listing={l} />

          <Section title="Where it is">
            <View style={{ height: 200, borderRadius: radius.lg, overflow: "hidden" }}>
              <MapView
                style={{ flex: 1 }}
                pointerEvents="none"
                liteMode
                userInterfaceStyle={t.dark ? "dark" : "light"}
                initialRegion={{ latitude: l.lat, longitude: l.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
              >
                {l.addressPrivacy === "full" ? (
                  <Marker coordinate={{ latitude: l.lat, longitude: l.lng }} />
                ) : (
                  <Circle center={{ latitude: l.lat, longitude: l.lng }} radius={350} strokeColor={t.c.brand} fillColor={t.c.brandSoft + "99"} />
                )}
              </MapView>
            </View>
            <Text variant="small" tone="ink3">
              {l.addressPrivacy === "full" ? "Exact location shared by the host." : "Approximate area. The host shares the exact address once you are talking."}
            </Text>
          </Section>

          <BeforeYouPay />

          {similar.length ? (
            <Section title={`More in ${l.cityName}`}>
              <FlatList
                horizontal
                data={similar}
                keyExtractor={(s) => s.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: space.lg }}
                renderItem={({ item }) => <ListingCard item={item} compact />}
              />
            </Section>
          ) : null}

          {!viewer.isOwner ? (
            <Pressable onPress={() => (user ? setReporting(true) : router.push("/auth/sign-in"))} accessibilityRole="button" style={{ flexDirection: "row", gap: 8, alignItems: "center", alignSelf: "center" }}>
              <Icon name="flag-outline" size={16} color={t.c.ink3} />
              <Text variant="small" tone="ink3">Report this listing</Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: barH, paddingTop: insets.top, backgroundColor: t.c.bg, opacity: barOpacity, borderBottomWidth: 1, borderBottomColor: t.c.line, alignItems: "center", justifyContent: "center" }}
      >
        <Text variant="h3" numberOfLines={1} style={{ maxWidth: "44%" }}>{l.title}</Text>
      </Animated.View>

      <View style={{ paddingBottom: insets.bottom }}>
        <StickyFooter>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Text variant="price" tone="value">{money(l.allIn, l.currency)}<Text variant="small" tone="ink3"> /mo</Text></Text>
              <Text variant="small" tone="ink3">All fees included</Text>
            </View>
            {viewer.isOwner ? (
              <Button label="Manage" icon="settings-outline" onPress={() => router.push("/host")} />
            ) : viewer.canReview && l.moderation === "pending" ? (
              <Button label="Review" icon="checkmark-done-outline" onPress={() => router.push("/admin")} />
            ) : (
              <Button label={viewer.conversationId ? "Open chat" : "Ask before you pay"} icon="chatbubble-ellipses-outline" onPress={onContact} />
            )}
          </View>
        </StickyFooter>
      </View>

      <ReportSheet visible={reporting} onClose={() => setReporting(false)} target={{ listingId: l.id }} />
      <PhotoViewer items={galleryOf(l)} index={viewing} onClose={() => setViewing(null)} />
    </View>
  );
}

function galleryOf(listing: Detail) {
  return listing.gallery.length ? listing.gallery : [{ kind: "photo" as const, src: listing.image, caption: "", alt: listing.title }];
}

function Gallery({ listing, width: W, onOpen }: { listing: Detail; width: number; onOpen: (i: number) => void }) {
  const t = useTheme();
  const [index, setIndex] = useState(0);
  const items = galleryOf(listing);
  return (
    <View>
      <FlatList
        horizontal
        pagingEnabled
        data={items}
        keyExtractor={(g, i) => `${g.src}-${i}`}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / W))}
        renderItem={({ item, index: i }) => (
          <Pressable
            onPress={() => (item.kind === "video" ? WebBrowser.openBrowserAsync(item.src).catch(() => {}) : onOpen(i))}
            accessibilityRole="imagebutton"
            accessibilityLabel={item.kind === "video" ? `Play video: ${item.alt}` : `Open photo ${i + 1} of ${items.length}`}
          >
            <Image
              source={{ uri: item.kind === "video" ? item.poster ?? listing.image : item.src }}
              style={{ width: W, height: W * 0.78, backgroundColor: t.c.surfaceAlt }}
              contentFit="cover"
              transition={150}
            />
            {item.kind === "video" ? (
              <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="play" size={30} color="#fff" />
                </View>
              </View>
            ) : null}
          </Pressable>
        )}
      />
      <View style={{ position: "absolute", bottom: space.md, right: space.md, backgroundColor: "rgba(16,36,42,0.7)", borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name="images-outline" size={13} color="#fff" />
        <Text variant="small" style={{ color: "#fff" }}>{index + 1} / {items.length}</Text>
      </View>
    </View>
  );
}

function Fact({ icon, label }: { icon: Parameters<typeof Icon>[0]["name"]; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
      <Icon name={icon} size={18} color={t.c.ink2} />
      <Text variant="small" tone="ink2" numberOfLines={1} style={{ flex: 1 }}>{label}</Text>
    </View>
  );
}

function HostCard({ listing }: { listing: Detail }) {
  const t = useTheme();
  const h = listing.host;
  const verified = h.identity === "verified";
  return (
    <Card style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}>
      <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.c.brandSoft, alignItems: "center", justifyContent: "center" }}>
        <Text variant="h2" tone="brand">{h.firstName.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="h3">
          {h.firstName}
          {listing.operatorName ? ` · ${listing.operatorName}` : ""}
        </Text>
        <Text variant="small" tone={verified ? "success" : "ink3"}>
          {verified ? "Government ID verified" : h.identity === "pending" ? "ID check in review" : "ID not verified"} · since {h.memberSince}
        </Text>
        <Text variant="small" tone="ink3">
          {h.responseRate != null
            ? `Replies to ${h.responseRate}% of enquiries${h.medianReplyHours != null ? `, usually within ${h.medianReplyHours < 1 ? "an hour" : `${Math.round(h.medianReplyHours)}h`}` : ""}`
            : "Not enough enquiries yet to show a reply rate"}
          {` · ${h.listings} live listing${h.listings === 1 ? "" : "s"}`}
        </Text>
      </View>
    </Card>
  );
}

function BeforeYouPay() {
  const steps = [
    ["videocam-outline", "See it first", "In person, or a live video call walking through the actual rooms — not a pre-recorded clip."],
    ["document-text-outline", "Get the lease before any money", "Read who the landlord is and who holds the deposit. Match the name to the host’s verified ID."],
    ["card-outline", "Pay traceably", "Bank transfer or card to a named account. Never wire, gift cards, crypto or cash apps to a stranger."],
    ["camera-outline", "Record move-in condition", "Use the condition report in the You tab on day one — timestamped photos are what get deposits back."],
  ] as const;
  return (
    <Section kicker="Before you pay" title="Four steps that stop almost every rental scam">
      <Card style={{ gap: space.lg }}>
        {steps.map(([icon, title, body]) => (
          <View key={title} style={{ flexDirection: "row", gap: space.md }}>
            <Icon name={icon} size={22} />
            <View style={{ flex: 1 }}>
              <Text variant="h3">{title}</Text>
              <Text variant="small" tone="ink2">{body}</Text>
            </View>
          </View>
        ))}
      </Card>
    </Section>
  );
}

