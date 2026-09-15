import * as Location from "expo-location";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, SectionList, View } from "react-native";
import { useMeta } from "@/api/hooks";
import type { City } from "@/api/types";
import { DateField } from "@/components/DateField";
import { StickyFooter } from "@/components/Screen";
import { Button, Chip, ErrorState, Field, Icon, Row, Text } from "@/components/ui";
import { useSearch } from "@/features/search-state";
import { addMonths, isoToday, stayLabel } from "@/lib/format";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";

function distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

const DURATIONS = [1, 3, 6, 12];

/**
 * Where and when, in one sheet. A mid-term renter usually knows the city and
 * a rough length of stay before exact dates, so the duration chips set the
 * move-out date from the move-in date (or from two weeks out).
 */
export default function SearchSheet() {
  const t = useTheme();
  const meta = useMeta();
  const { query, setQuery } = useSearch();
  const [cityId, setCityId] = useState<string | undefined>(query.city);
  const [moveIn, setMoveIn] = useState<string | undefined>(query.moveIn);
  const [moveOut, setMoveOut] = useState<string | undefined>(query.moveOut);
  const [q, setQ] = useState("");
  const [locating, setLocating] = useState(false);

  const cities = meta.data?.cities ?? [];
  const city = cities.find((c) => c.id === cityId);

  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = cities.filter((c) => !needle || `${c.name} ${c.state} ${c.countryName}`.toLowerCase().includes(needle));
    const groups = new Map<string, City[]>();
    for (const c of match) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
    return [...groups.entries()].map(([title, data]) => ({ title, data }));
  }, [cities, q]);

  const nearMe = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Location is off", "Allow location access in Settings, or pick a city from the list.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const nearest = [...cities].sort((a, b) => distance(here, a) - distance(here, b))[0];
      if (nearest) setCityId(nearest.id);
    } catch {
      Alert.alert("Couldn’t find you", "Pick a city from the list instead.");
    } finally {
      setLocating(false);
    }
  };

  const stayMonths = moveIn && moveOut ? Math.round((Date.parse(moveOut) - Date.parse(moveIn)) / (86_400_000 * 30.4)) : null;

  const apply = () => {
    setQuery({ city: cityId, moveIn, moveOut });
    router.back();
  };

  if (meta.isError) return <ErrorState error={meta.error} onRetry={() => void meta.refetch()} />;

  const header = (
    <View style={{ gap: space.lg, paddingBottom: space.md }}>
      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <DateField
            label="Move in"
            value={moveIn}
            minimum={isoToday()}
            clearable
            placeholder="Any time"
            onChange={(v) => {
              setMoveIn(v);
              if (v && moveOut && moveOut <= v) setMoveOut(undefined);
            }}
          />
          <DateField label="Move out" value={moveOut} minimum={moveIn ?? isoToday(30)} clearable placeholder="Open-ended" onChange={setMoveOut} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <Text variant="small" tone="ink3">Staying</Text>
          {DURATIONS.map((m) => (
            <Chip
              key={m}
              label={`${m} mo`}
              selected={stayMonths === m}
              onPress={() => {
                const from = moveIn ?? isoToday(14);
                setMoveIn(from);
                setMoveOut(addMonths(from, m));
              }}
            />
          ))}
        </View>
        {moveIn ? (
          <Text variant="small" tone="ink2">
            {stayLabel(moveIn, moveOut)}
            {moveIn && moveOut ? " — only homes free for the whole window, whose minimum and maximum stay fit it." : ""}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="micro" tone="ink3">Where</Text>
        <Field label="" value={q} onChangeText={setQ} placeholder="Berlin, Austin, Queens…" autoCorrect={false} returnKeyType="search" />
        <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
          <Chip label="Near me" icon="navigate-outline" onPress={() => void nearMe()} />
          <Chip label={locating ? "Locating…" : "Anywhere"} icon="globe-outline" selected={!cityId} onPress={() => setCityId(undefined)} />
          {city ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, backgroundColor: t.c.brandSoft }}>
              <Icon name="location" size={14} color={t.c.brand} />
              <Text variant="small" tone="brand" style={{ fontFamily: "Inter_600SemiBold" }}>{city.name}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <SectionList
        sections={sections}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }}
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => (
          <Text variant="micro" tone="ink3" style={{ paddingTop: space.md, paddingBottom: space.xs }}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <Row
            label={`${item.name}${item.state ? `, ${item.state}` : ""}`}
            value={`${item.listingCount} live`}
            tone={cityId === item.id ? "brand" : "ink"}
            icon={cityId === item.id ? "checkmark-circle" : undefined}
            onPress={() => setCityId(item.id)}
          />
        )}
      />
      <StickyFooter>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <Button
            label="Clear"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => {
              setCityId(undefined);
              setMoveIn(undefined);
              setMoveOut(undefined);
              setQ("");
            }}
          />
          <Button label="Show homes" icon="search" style={{ flex: 2 }} onPress={apply} />
        </View>
      </StickyFooter>
    </View>
  );
}
