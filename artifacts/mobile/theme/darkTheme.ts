import type { ThemeColors } from "./colors";

// Premium, AMOLED-friendly dark palette. The orange brand accent is kept
// (slightly brightened to #FF6B00 for contrast against near-black
// surfaces) — logo, primary buttons, and category highlights are never
// darkened or recolored, only the surrounding chrome changes.
export const darkTheme: ThemeColors = {
  text: "#FFFFFF",
  tint: "#FF6B00",
  background: "#0B0B0B",
  foreground: "#FFFFFF",
  card: "#1A1A1A",
  cardForeground: "#FFFFFF",
  primary: "#FF6B00",
  primaryForeground: "#FFFFFF",
  secondary: "#222222",
  secondaryForeground: "#B0B0B0",
  muted: "#222222",
  mutedForeground: "#B0B0B0",
  hint: "#808080",
  accent: "#FF6B00",
  accentForeground: "#FFFFFF",
  destructive: "#EF4444",
  destructiveForeground: "#FFFFFF",
  border: "#303030",
  input: "#303030",
  surface: "#1A1A1A",
  gold: "#F5A623",
  saffron: "#FF6B00",
  cream: "#1A1A1A",
  radius: 14,
};
