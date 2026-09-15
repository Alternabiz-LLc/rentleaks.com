/**
 * Recently viewed homes — a per-device convenience (the server-side version
 * of "keep this" is Saved). Twenty cards, newest first.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import type { Card } from "@/api/types";

const KEY = "rl.recent.v1";
const MAX = 20;

export async function loadRecent(): Promise<Card[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Card[]) : [];
  } catch {
    return [];
  }
}

export async function recordView(card: Card) {
  const prev = await loadRecent();
  const next = [{ ...card, saved: undefined }, ...prev.filter((c) => c.id !== card.id)].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

export async function clearRecent() {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}

export function useRecent() {
  const [items, setItems] = useState<Card[]>([]);
  const reload = useCallback(() => {
    loadRecent().then(setItems);
  }, []);
  useEffect(reload, [reload]);
  return { items, reload };
}
