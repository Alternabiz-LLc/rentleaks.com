import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOnline } from "@/lib/network";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon, Text } from "./ui";

/** A thin strip under the status bar while the phone has no connection. */
export function OfflineBanner() {
  const online = useOnline();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ position: "absolute", top: insets.top, left: 12, right: 12, zIndex: 50, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: t.c.ink }}
    >
      <Icon name="cloud-offline-outline" size={16} color={t.c.bg} />
      <Text variant="small" style={{ color: t.c.bg, flex: 1 }}>You’re offline. Saved homes and reports still work; we’ll refresh when you’re back.</Text>
    </View>
  );
}
