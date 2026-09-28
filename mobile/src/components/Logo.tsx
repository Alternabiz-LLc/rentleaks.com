import { Image } from "expo-image";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * The RentLeaks logo: the line-art phone-and-house mark beside the script
 * wordmark, taken from the brand artwork (Rentleaks_logo1.pdf).
 *
 * The asset is white on transparency and tinted at runtime, so one file
 * serves both themes and the logo always sits in the app's own ink rather
 * than carrying a second background colour into a screen. `size` is its
 * height; the width follows the artwork's own proportions.
 */
const LOCKUP = require("../../assets/logo-lockup.png");
/** Intrinsic aspect of assets/logo-lockup.png (1800 x 498). */
const ASPECT = 1800 / 498;

export function Logo({ size = 30, tone }: { size?: number; tone?: string }) {
  const t = useTheme();
  return (
    <View accessibilityRole="image" accessibilityLabel="RentLeaks">
      <Image
        source={LOCKUP}
        style={{ width: size * ASPECT, height: size }}
        contentFit="contain"
        tintColor={tone ?? t.c.ink}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
