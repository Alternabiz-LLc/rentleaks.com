import { View, Text as RNText } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { font } from "@/theme/tokens";

/**
 * The site's logo: `.logo__mark` (ink square, "RL" in paper, radius 9/30) next
 * to the Fraunces wordmark. Same proportions as styles.css, scaled by `size`.
 */
export function Logo({ size = 30, wordmark = true }: { size?: number; wordmark?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: size * 0.4 }} accessibilityRole="image" accessibilityLabel="RentLeaks">
      <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: t.c.ink, alignItems: "center", justifyContent: "center" }}>
        <RNText style={{ fontFamily: font.bold, fontSize: size * 0.37, letterSpacing: size * 0.015, color: t.c.bg, includeFontPadding: false }}>RL</RNText>
      </View>
      {wordmark ? <RNText style={{ fontFamily: font.display, fontSize: size * 0.63, letterSpacing: -0.5, color: t.c.ink }}>RentLeaks</RNText> : null}
    </View>
  );
}
