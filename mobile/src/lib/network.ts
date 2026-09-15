/**
 * Connectivity, from the OS. Feeds TanStack Query's online manager (so
 * queries pause and retry cleanly instead of failing) and the offline banner.
 */
import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

export function wireOnlineManager() {
  if (Platform.OS === "web") return;
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    }),
  );
}

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (Platform.OS === "web") return;
    return NetInfo.addEventListener((state) => setOnline(state.isConnected !== false && state.isInternetReachable !== false));
  }, []);
  return online;
}
