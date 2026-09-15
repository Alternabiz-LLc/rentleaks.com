import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router/js-tabs";
import { useMe } from "@/api/hooks";
import { isHostRole, useAuth } from "@/auth/AuthProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { font } from "@/theme/tokens";

export default function TabLayout() {
  const t = useTheme();
  const { user } = useAuth();
  const me = useMe();
  const unread = me.data?.counts.unread ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.c.brand,
        tabBarInactiveTintColor: t.c.ink3,
        tabBarStyle: { backgroundColor: t.c.surface, borderTopColor: t.c.line },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Explore", tabBarIcon: ({ color, size }) => <Ionicons name="search" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: "Saved", tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarBadge: unread ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: t.c.value, color: "#fff" },
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="host"
        options={{
          title: "Host",
          href: isHostRole(user) ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="key-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{ title: "You", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
