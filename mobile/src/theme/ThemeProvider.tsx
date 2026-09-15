import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { dark, light, type Theme } from "./tokens";

export type ThemeChoice = "system" | "light" | "dark";

type Ctx = { theme: Theme; choice: ThemeChoice; setChoice: (c: ThemeChoice) => void };

const ThemeCtx = createContext<Ctx>({ theme: light, choice: "system", setChoice: () => {} });
const KEY = "rl.theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>("system");

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === "light" || v === "dark" || v === "system") setChoiceState(v);
      })
      .catch(() => {});
  }, []);

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    AsyncStorage.setItem(KEY, c).catch(() => {});
  }, []);

  const theme = useMemo(() => {
    const mode = choice === "system" ? (system === "dark" ? "dark" : "light") : choice;
    return mode === "dark" ? dark : light;
  }, [choice, system]);

  const value = useMemo(() => ({ theme, choice, setChoice }), [theme, choice, setChoice]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx).theme;
}

export function useThemeChoice() {
  const { choice, setChoice } = useContext(ThemeCtx);
  return { choice, setChoice };
}
