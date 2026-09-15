/**
 * Push registration. The permission is asked for in context — when someone
 * saves a search, sends their first enquiry or turns alerts on — never at
 * launch or sign-in, when they have no reason yet to say yes. If it was
 * granted earlier, sign-in re-registers the token silently. Requires a
 * development or production build (Expo Go on Android cannot receive remote
 * pushes).
 */
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "@/api/client";
import { EAS_PROJECT_ID } from "@/api/config";

if (Platform.OS !== "web") Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let current: string | null = null;

export async function registerForPush({ ask = false }: { ask?: boolean } = {}): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice || !EAS_PROJECT_ID) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messages",
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync("alerts", {
      name: "Saved-search alerts",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted" && ask) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== "granted") return null;

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
  current = data;
  await api("/api/v1/devices", { body: { token: data, platform: Platform.OS } });
  return data;
}

/** Call at the moment a push would be useful. Safe to call repeatedly. */
export async function ensurePush() {
  if (current) return current;
  try {
    current = await registerForPush({ ask: true });
  } catch {
    current = null;
  }
  return current;
}

export function currentPushToken() {
  return current;
}

export async function unregisterPush() {
  if (!current) return;
  await api("/api/v1/devices", { method: "DELETE", body: { token: current } }).catch(() => {});
  current = null;
}

/** Where a tapped notification should take the user. */
export function routeForNotification(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  switch (data.type) {
    case "message":
      return typeof data.conversationId === "string" ? `/conversation/${data.conversationId}` : "/inbox";
    case "search":
      return typeof data.listingId === "string" ? `/listing/${data.listingId}` : "/saved";
    case "moderation":
      return "/host";
    case "review":
    case "report":
      return "/admin";
    default:
      return null;
  }
}
