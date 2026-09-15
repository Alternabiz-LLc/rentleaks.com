import { Fraunces_600SemiBold, Fraunces_600SemiBold_Italic } from "@expo-google-fonts/fraunces";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SearchProvider } from "@/features/search-state";
import { wireOnlineManager } from "@/lib/network";
import { routeForNotification } from "@/lib/push";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";
import { font } from "@/theme/tokens";

void SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

/* Refetch when the app comes back to the foreground. */
AppState.addEventListener("change", (s) => {
  if (Platform.OS !== "web") focusManager.setFocused(s === "active");
});
wireOnlineManager();

export default function RootLayout() {
  const [loaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_600SemiBold_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SearchProvider>
              <Navigator />
            </SearchProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Navigator() {
  const t = useTheme();
  const { ready } = useAuth();

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  /* Tapping a push opens the thing it was about. */
  useEffect(() => {
    if (Platform.OS === "web") return;
    const open = (data: Record<string, unknown> | undefined) => {
      const href = routeForNotification(data);
      if (href) router.push(href);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) open(last.notification.request.content.data as Record<string, unknown>);
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      open(r.notification.request.content.data as Record<string, unknown>),
    );
    return () => sub.remove();
  }, []);

  if (!ready) return null;

  return (
    <>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.c.bg },
          headerTintColor: t.c.ink,
          headerTitleStyle: { fontFamily: font.semibold, color: t.c.ink },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.c.bg },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="listing/[id]" options={{ title: "", headerTransparent: true, headerStyle: { backgroundColor: "transparent" } }} />
        <Stack.Screen name="filters" options={{ presentation: "modal", title: "Filters" }} />
        <Stack.Screen name="search" options={{ presentation: "modal", title: "Where and when" }} />
        <Stack.Screen name="contact/[listingId]" options={{ presentation: "modal", title: "Ask before you pay" }} />
        <Stack.Screen name="conversation/[id]" options={{ title: "" }} />
        <Stack.Screen name="auth/sign-in" options={{ presentation: "modal", title: "Sign in" }} />
        <Stack.Screen name="auth/sign-up" options={{ presentation: "modal", title: "Create account" }} />
        <Stack.Screen name="auth/forgot" options={{ presentation: "modal", title: "Reset password" }} />
        <Stack.Screen name="auth/reset" options={{ title: "New password" }} />
        <Stack.Screen name="host/new" options={{ title: "New listing" }} />
        <Stack.Screen name="admin/index" options={{ title: "Review queue" }} />
        <Stack.Screen name="tools/passport" options={{ title: "Renter passport" }} />
        <Stack.Screen name="tools/condition/index" options={{ title: "Condition reports" }} />
        <Stack.Screen name="tools/condition/[id]" options={{ title: "Condition report" }} />
        <Stack.Screen name="tools/rules" options={{ title: "Market rules" }} />
        <Stack.Screen name="tools/fee-check" options={{ title: "Is this fee legal?" }} />
        <Stack.Screen name="tools/afford" options={{ title: "Affordability" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </>
  );
}
