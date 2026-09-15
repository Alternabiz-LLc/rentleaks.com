import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { space } from "@/theme/tokens";

export function Screen({
  children,
  scroll = true,
  edges = ["top"],
  refreshing,
  onRefresh,
  contentStyle,
  footer,
  keyboard,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
  keyboard?: boolean;
}) {
  const t = useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[{ padding: space.lg, gap: space.xl, paddingBottom: space.xxxl }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.c.brand} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: t.c.bg }}>
      {keyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {body}
          {footer}
        </KeyboardAvoidingView>
      ) : (
        <>
          {body}
          {footer}
        </>
      )}
    </SafeAreaView>
  );
}

export function StickyFooter({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: space.lg,
        paddingTop: space.md,
        paddingBottom: space.md,
        borderTopWidth: 1,
        borderTopColor: t.c.line,
        backgroundColor: t.c.surface,
      }}
    >
      {children}
    </View>
  );
}
