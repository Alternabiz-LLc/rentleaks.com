/**
 * Editorial Warm-Modern, native edition.
 *
 * Same DNA as the web remix: Celeste teal for action, Ochre reserved for
 * value and price signals (never a general CTA), deep ink, paper surfaces,
 * Fraunces for big moments only, full dark mode.
 */
export const palette = {
  celeste: { 50: "#eaf5f7", 100: "#dceff3", 200: "#b7dfe7", 500: "#3795a6", 600: "#2c7c8a", 700: "#1c5b69", 800: "#1b4a56" },
  ochre: { 100: "#fbf0da", 200: "#f5dfb4", 300: "#ecc584", 500: "#c9892c", 700: "#7e5518", 800: "#5f4014" },
  ink: { 900: "#10242a", 700: "#2f4a52", 500: "#5b6f75", 400: "#6b7f85" },
  paper: { 50: "#fbfaf6", 100: "#f6fafb", 200: "#edf4f6" },
};

export type Theme = {
  dark: boolean;
  c: {
    bg: string;
    surface: string;
    surfaceAlt: string;
    ink: string;
    ink2: string;
    ink3: string;
    line: string;
    lineStrong: string;
    brand: string;
    brandPressed: string;
    brandSoft: string;
    onBrand: string;
    value: string;
    valueSoft: string;
    success: string;
    successSoft: string;
    alert: string;
    alertSoft: string;
    warn: string;
    warnSoft: string;
    overlay: string;
  };
};

export const light: Theme = {
  dark: false,
  c: {
    bg: palette.paper[100],
    surface: "#ffffff",
    surfaceAlt: palette.paper[200],
    ink: palette.ink[900],
    ink2: palette.ink[700],
    ink3: palette.ink[500],
    line: "#d7e4e7",
    lineStrong: "#b7cdd2",
    brand: palette.celeste[500],
    brandPressed: palette.celeste[600],
    brandSoft: palette.celeste[50],
    onBrand: "#ffffff",
    value: "#c45c26",
    valueSoft: "#fbeee4",
    success: "#2e6e58",
    successSoft: "#dfefe7",
    alert: "#93412b",
    alertSoft: "#f7e7e1",
    warn: palette.ochre[700],
    warnSoft: palette.ochre[100],
    overlay: "rgba(16,36,42,0.52)",
  },
};

export const dark: Theme = {
  dark: true,
  c: {
    bg: "#0c1b20",
    surface: "#13272d",
    surfaceAlt: "#1a3239",
    ink: "#eef6f7",
    ink2: "#c3d4d8",
    ink3: "#8fa6ac",
    line: "#24404a",
    lineStrong: "#335660",
    brand: "#5fb5c4",
    brandPressed: "#4aa2b2",
    brandSoft: "#16353d",
    onBrand: "#08171b",
    value: "#ecc584",
    valueSoft: "#3a2c14",
    success: "#7cc4a6",
    successSoft: "#15332a",
    alert: "#f0a58f",
    alertSoft: "#3a1f18",
    warn: palette.ochre[300],
    warnSoft: "#33280f",
    overlay: "rgba(0,0,0,0.6)",
  },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, full: 999 };

export const font = {
  display: "Fraunces_600SemiBold",
  displayItalic: "Fraunces_600SemiBold_Italic",
  body: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  mono: undefined as string | undefined,
};

export const type = {
  hero: { fontFamily: font.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.6 },
  h1: { fontFamily: font.display, fontSize: 26, lineHeight: 31, letterSpacing: -0.3 },
  h2: { fontFamily: font.semibold, fontSize: 19, lineHeight: 25 },
  h3: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: font.medium, fontSize: 11, lineHeight: 14, letterSpacing: 0.6, textTransform: "uppercase" as const },
  price: { fontFamily: font.bold, fontSize: 20, lineHeight: 24, fontVariant: ["tabular-nums" as const] },
  label: { fontFamily: font.medium, fontSize: 14, lineHeight: 18 },
};
