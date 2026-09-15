/**
 * The renter's current search. Lives above the tabs so Explore, Map and the
 * filter sheet all read one object; remembered on this device between
 * launches (a convenience — saved searches are the server-side version).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SearchQuery } from "@/api/types";

type Ctx = {
  query: SearchQuery;
  setQuery: (patch: Partial<SearchQuery>) => void;
  replaceQuery: (next: SearchQuery) => void;
  reset: () => void;
  activeFilters: number;
};

const KEY = "rl.search";
const SearchCtx = createContext<Ctx | null>(null);

const FILTER_KEYS: Array<keyof SearchQuery> = [
  "minUsd", "maxUsd", "beds", "furnished", "privateBath", "work", "noFee", "utilities", "verified", "pets", "vouchers",
];

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQueryState] = useState<SearchQuery>({});

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as SearchQuery;
        /* Dates in the past are not a search anyone still wants. */
        const today = new Date().toISOString().slice(0, 10);
        if (saved.moveIn && saved.moveIn < today) {
          delete saved.moveIn;
          delete saved.moveOut;
        }
        setQueryState(saved);
      })
      .catch(() => {});
  }, []);

  const persist = (q: SearchQuery) => AsyncStorage.setItem(KEY, JSON.stringify(q)).catch(() => {});

  const setQuery = useCallback((patch: Partial<SearchQuery>) => {
    setQueryState((prev) => {
      const next = { ...prev, ...patch };
      for (const k of Object.keys(next) as Array<keyof SearchQuery>) {
        if (next[k] === undefined || next[k] === "" || next[k] === false) delete next[k];
      }
      void persist(next);
      return next;
    });
  }, []);

  const replaceQuery = useCallback((next: SearchQuery) => {
    setQueryState(next);
    void persist(next);
  }, []);

  const reset = useCallback(() => {
    setQueryState((prev) => {
      const next: SearchQuery = { city: prev.city, moveIn: prev.moveIn, moveOut: prev.moveOut };
      void persist(next);
      return next;
    });
  }, []);

  const activeFilters = FILTER_KEYS.filter((k) => query[k] !== undefined).length;
  const value = useMemo(() => ({ query, setQuery, replaceQuery, reset, activeFilters }), [query, setQuery, replaceQuery, reset, activeFilters]);
  return <SearchCtx.Provider value={value}>{children}</SearchCtx.Provider>;
}

export function useSearch() {
  const ctx = useContext(SearchCtx);
  if (!ctx) throw new Error("useSearch outside SearchProvider");
  return ctx;
}
