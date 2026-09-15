import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useListings, useMapListings, useMeta, useSaveSearch } from "@/api/hooks";
import type { Card as CardT } from "@/api/types";
import { useAuth } from "@/auth/AuthProvider";
import { ListingCard, ListingCardSkeleton } from "@/components/ListingCard";
import { Logo } from "@/components/Logo";
import { Badge, Button, Chip, EmptyState, ErrorState, Icon, IconButton, Segmented, Text } from "@/components/ui";
import { useSearch } from "@/features/search-state";
import { money, stayLabel } from "@/lib/format";
import { ensurePush } from "@/lib/push";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";

export const TYPES = [
  { id: undefined, label: "All homes" },
  { id: "room", label: "Rooms" },
  { id: "coliving", label: "Co-living" },
  { id: "furnished", label: "Furnished" },
  { id: "short-term", label: "1-month+" },
  { id: "lease-break", label: "Lease takeovers" },
  { id: "aparthotel", label: "Aparthotels" },
] as const;

const SORTS = [
  { value: "newest", label: "Best match" },
  { value: "price-asc", label: "Price ↑" },
  { value: "price-desc", label: "Price ↓" },
  { value: "move-in", label: "Soonest" },
] as const;

export default function Explore() {
  const t = useTheme();
  const { user } = useAuth();
  const { query, setQuery, activeFilters } = useSearch();
  const [mode, setMode] = useState<"list" | "map">("list");
  const meta = useMeta();
  const list = useListings(query);
  const saveSearch = useSaveSearch();

  const city = meta.data?.cities.find((c) => c.id === query.city);
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total;
  /* The headline earns its space once: before anyone has told us where or
     when. After that the results are the point. */
  const fresh = !query.city && !query.moveIn;

  const onSaveSearch = () => {
    if (!user) return router.push("/auth/sign-in");
    const typeLabel = TYPES.find((x) => x.id === query.type)?.label ?? "All homes";
    const label = `${city?.name ?? "Anywhere"} · ${typeLabel}${query.moveIn ? ` · ${stayLabel(query.moveIn, query.moveOut)}` : ""}`;
    saveSearch.mutate(
      { label, query, alerts: true },
      {
        onSuccess: async () => {
          const token = await ensurePush();
          Alert.alert(
            "Search saved",
            token
              ? "We’ll send a notification when a new listing matches it."
              : "It’s in your Saved tab. Turn on notifications in Settings to hear about new matches the moment they’re approved.",
          );
        },
        onError: (e) => Alert.alert("Couldn’t save", e instanceof Error ? e.message : "Try again."),
      },
    );
  };

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Logo />
        <Text variant="small" tone="ink3">{meta.data ? `${meta.data.listings.toLocaleString()} live homes` : ""}</Text>
      </View>
      {fresh ? (
        <Text variant="hero">
          Two dates.{"\n"}
          <Text variant="hero" tone="brand" style={{ fontFamily: "Fraunces_600SemiBold_Italic" }}>Every fee</Text> up front.
        </Text>
      ) : null}

      <SearchPill
        where={city ? `${city.name}${city.state ? `, ${city.state}` : ""}` : "Anywhere · U.S. & Europe"}
        when={query.moveIn ? stayLabel(query.moveIn, query.moveOut) : "Any dates"}
        onPress={() => router.push("/search")}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {TYPES.map((ty) => (
          <Chip key={ty.label} label={ty.label} selected={query.type === ty.id} onPress={() => setQuery({ type: ty.id })} />
        ))}
      </ScrollView>

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Filters${activeFilters ? `, ${activeFilters} active` : ""}`}
          onPress={() => router.push("/filters")}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 40, borderRadius: 20, borderWidth: 1, borderColor: activeFilters ? t.c.ink : t.c.line, backgroundColor: t.c.surface }}
        >
          <Icon name="options-outline" size={18} />
          <Text variant="label">Filters</Text>
          {activeFilters ? <Badge label={String(activeFilters)} tone="value" /> : null}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Segmented value={mode} onChange={setMode} options={[{ value: "list", label: "List" }, { value: "map", label: "Map" }]} />
        </View>
        <IconButton name="notifications-outline" label="Save this search and get alerts" onPress={onSaveSearch} />
      </View>

      {mode === "list" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <Text variant="small" tone="ink3" numberOfLines={1} style={{ flexShrink: 0 }}>{total != null ? `${total.toLocaleString()} homes` : " "}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 6 }}>
            {SORTS.map((s) => (
              <Chip key={s.value} label={s.label} selected={(query.sort ?? "newest") === s.value} onPress={() => setQuery({ sort: s.value === "newest" ? undefined : s.value })} />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );

  if (mode === "map") {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.c.bg }}>
        <View style={{ paddingHorizontal: space.lg }}>{header}</View>
        <ExploreMap cityCenter={city ? { lat: city.lat, lng: city.lng } : undefined} cityKey={city?.id ?? "any"} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.c.bg }}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: space.lg, gap: space.xl }}
        ListHeaderComponent={header}
        renderItem={({ item }) => <ListingCard item={item} />}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        refreshing={list.isRefetching && !list.isFetchingNextPage}
        onRefresh={() => void list.refetch()}
        ListEmptyComponent={
          list.isLoading ? (
            <View style={{ gap: space.xl }}>
              <ListingCardSkeleton />
              <ListingCardSkeleton />
            </View>
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : (
            <EmptyState
              icon="calendar-clear-outline"
              title="Nothing fits those dates yet"
              body="Widen the window, try the whole city, or save this search — we’ll tell you the moment something matches."
              action={<Button label="Save search & get alerts" icon="notifications-outline" onPress={onSaveSearch} />}
            />
          )
        }
        ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={t.c.brand} /> : null}
      />
    </SafeAreaView>
  );
}

/** The one-line summary of the search, in the place a search box would be. */
function SearchPill({ where, when, onPress }: { where: string; when: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Search: ${where}, ${when}. Change where and when`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        backgroundColor: t.c.surface,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: t.c.lineStrong,
        paddingVertical: 10,
        paddingHorizontal: 14,
        opacity: pressed ? 0.85 : 1,
        shadowColor: "#000",
        shadowOpacity: t.dark ? 0 : 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      })}
    >
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.c.brandSoft, alignItems: "center", justifyContent: "center" }}>
        <Icon name="search" size={18} color={t.c.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="h3" numberOfLines={1}>{where}</Text>
        <Text variant="small" tone="ink3" numberOfLines={1}>{when}</Text>
      </View>
      <Icon name="chevron-forward" size={18} color={t.c.ink3} />
    </Pressable>
  );
}

function ExploreMap({ cityCenter, cityKey }: { cityCenter?: { lat: number; lng: number }; cityKey: string }) {
  const t = useTheme();
  const { query } = useSearch();
  const pins = useMapListings(query, true);
  const [selected, setSelected] = useState<CardT | null>(null);
  const mapRef = useRef<MapView>(null);
  const items = pins.data?.items ?? [];

  const initial: Region = useMemo(() => {
    if (cityCenter) return { latitude: cityCenter.lat, longitude: cityCenter.lng, latitudeDelta: 0.18, longitudeDelta: 0.18 };
    return { latitude: 40.7128, longitude: -74.006, latitudeDelta: 0.3, longitudeDelta: 0.3 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* initialRegion only applies once; when the city changes, move the camera.
     With no city, frame whatever pins came back. */
  const hasItems = items.length > 0;
  useEffect(() => {
    if (cityCenter) {
      mapRef.current?.animateToRegion({ latitude: cityCenter.lat, longitude: cityCenter.lng, latitudeDelta: 0.18, longitudeDelta: 0.18 }, 400);
    } else if (hasItems) {
      mapRef.current?.fitToCoordinates(
        items.map((i) => ({ latitude: i.lat, longitude: i.lng })),
        { edgePadding: { top: 60, right: 40, bottom: 120, left: 40 }, animated: true },
      );
    }
    setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityKey, hasItems]);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={initial}
        userInterfaceStyle={t.dark ? "dark" : "light"}
        showsUserLocation
        onPress={() => setSelected(null)}
      >
        {items.map((i) => (
          <Marker
            key={i.id}
            coordinate={{ latitude: i.lat, longitude: i.lng }}
            onPress={(e) => {
              e.stopPropagation();
              setSelected(i);
            }}
            tracksViewChanges={false}
            accessibilityLabel={`${money(i.allIn, i.currency)} a month, ${i.title}`}
          >
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                backgroundColor: selected?.id === i.id ? t.c.ink : t.c.surface,
                borderWidth: 1,
                borderColor: t.c.lineStrong,
              }}
            >
              <Text variant="small" style={{ fontFamily: "Inter_700Bold", color: selected?.id === i.id ? t.c.bg : t.c.ink }}>
                {money(i.allIn, i.currency)}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>
      <View style={{ position: "absolute", top: space.md, alignSelf: "center" }}>
        {pins.isLoading ? <Badge label="Loading homes…" tone="brand" /> : pins.data ? <Badge label={`${items.length} homes on the map`} /> : null}
      </View>
      {selected ? (
        <View style={{ position: "absolute", left: space.lg, right: space.lg, bottom: space.lg, backgroundColor: t.c.bg, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: t.c.line }}>
          <ListingCard item={selected} row />
        </View>
      ) : null}
    </View>
  );
}
