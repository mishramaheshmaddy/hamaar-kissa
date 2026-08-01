import { useTheme } from "@/theme/useTheme";

/**
 * Returns the design tokens for the app's currently active theme
 * (Light by default, or Dark if the user turned it on in
 * Profile → Settings → बैकग्राउंड कलर).
 *
 * This is intentionally driven by the user's saved preference
 * (`theme/ThemeProvider`), NOT the device's system appearance setting —
 * the app's theme only changes when the user explicitly toggles it.
 *
 * Kept as a thin wrapper around useTheme() so every existing screen that
 * already calls useColors() picks up Dark Mode automatically with no
 * changes needed.
 */
export function useColors() {
  const { colors } = useTheme();
  return colors;
}
