import { Image } from "expo-image";
import { router } from "expo-router";
import { View } from "react-native";
import type { Card as CardT } from "@/api/types";
import { useToggleSave } from "@/api/hooks";
import { useAuth } from "@/auth/AuthProvider";
import { money, shortDate, LISTED_BY } from "@/lib/format";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, space } from "@/theme/tokens";
import { Badge, IconButton, PressableCard, Text } from "./ui";

export function ListingCard({ item, compact, row }: { item: CardT; compact?: boolean; row?: boolean }) {
  const t = useTheme();
  const { user } = useAuth();
  const save = useToggleSave();
  const saved = !!item.saved;

  const toggleSave = () => {
    if (!user) return router.push("/auth/sign-in");
    save.mutate({ id: item.id, saved });
  };

  /* Row layout: thumbnail left, facts right — for map callouts and dense lists. */
  if (row) {
    return (
      <PressableCard
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${money(item.allIn, item.currency)} a month all-in, ${item.neighborhood}, ${item.cityName}`}
        onPress={() => router.push(`/listing/${encodeURIComponent(item.id)}`)}
        style={{ flexDirection: "row", gap: space.md, alignItems: "center" }}
      >
        <Image source={{ uri: item.image }} style={{ width: 96, height: 96, borderRadius: radius.md, backgroundColor: t.c.surfaceAlt }} contentFit="cover" recyclingKey={item.id} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="price" tone="value">
            {money(item.allIn, item.currency)}
            <Text variant="small" tone="ink3"> /mo</Text>
          </Text>
          <Text variant="h3" numberOfLines={1}>{item.title}</Text>
          <Text variant="small" tone="ink3" numberOfLines={1}>{item.typeLabel} · {item.neighborhood}</Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {item.verified ? <Badge label="ID verified" tone="success" icon="shield-checkmark" /> : null}
            {item.noFee ? <Badge label="No broker fee" tone="success" /> : null}
          </View>
        </View>
        <IconButton name={saved ? "heart" : "heart-outline"} label={saved ? "Remove from saved" : "Save"} active={saved} onPress={toggleSave} />
      </PressableCard>
    );
  }

  return (
    <PressableCard
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${money(item.allIn, item.currency)} a month all-in, ${item.neighborhood}, ${item.cityName}`}
      onPress={() => router.push(`/listing/${encodeURIComponent(item.id)}`)}
      style={{ gap: space.sm, width: compact ? 260 : undefined }}
    >
      <View style={{ borderRadius: radius.lg, overflow: "hidden", backgroundColor: t.c.surfaceAlt }}>
        <Image
          source={{ uri: item.image }}
          style={{ width: "100%", aspectRatio: compact ? 4 / 3 : 3 / 2 }}
          contentFit="cover"
          transition={180}
          recyclingKey={item.id}
          accessibilityIgnoresInvertColors
        />
        <View style={{ position: "absolute", top: space.sm, left: space.sm, flexDirection: "row", gap: 6, flexWrap: "wrap", right: 56 }}>
          {item.sponsored ? <Badge label="Sponsored" tone="warn" /> : null}
          {item.verified ? <Badge label="ID verified" tone="success" icon="shield-checkmark" /> : null}
          {item.housingType === "lease-break" && item.remainingMonths != null ? (
            <Badge label={`${item.remainingMonths} mo left`} tone="brand" icon="swap-horizontal" />
          ) : null}
        </View>
        <IconButton
          name={saved ? "heart" : "heart-outline"}
          label={saved ? "Remove from saved" : "Save"}
          active={saved}
          onPress={toggleSave}
          style={{ position: "absolute", top: space.sm, right: space.sm }}
        />
      </View>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.sm }}>
          <Text variant="price" tone="value">
            {money(item.allIn, item.currency)}
            <Text variant="small" tone="ink3"> /mo all-in</Text>
          </Text>
          {item.noFee ? <Text variant="micro" tone="success">No broker fee</Text> : null}
        </View>
        <Text variant="h3" numberOfLines={1}>{item.title}</Text>
        <Text variant="small" tone="ink3" numberOfLines={1}>
          {item.typeLabel} · {item.neighborhood}, {item.cityName}
        </Text>
        <Text variant="small" tone="ink2" numberOfLines={1}>
          From {shortDate(item.availableFrom)}
          {item.availableUntil ? ` to ${shortDate(item.availableUntil)}` : ""} · {item.minStayMonths}+ mo · {LISTED_BY[item.listedBy] ?? "By owner"}
        </Text>
      </View>
    </PressableCard>
  );
}

export function ListingCardSkeleton() {
  const t = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ aspectRatio: 3 / 2, borderRadius: radius.lg, backgroundColor: t.c.surfaceAlt }} />
      <View style={{ height: 18, width: "40%", borderRadius: 6, backgroundColor: t.c.surfaceAlt }} />
      <View style={{ height: 14, width: "75%", borderRadius: 6, backgroundColor: t.c.surfaceAlt }} />
    </View>
  );
}
