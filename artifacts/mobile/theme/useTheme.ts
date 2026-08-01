import { useContext } from "react";

import { ThemeContext, ThemeContextValue } from "./ThemeContext";

/**
 * Access the current theme (mode, resolved colors, and setters).
 * Must be called from within <ThemeProvider>.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme() must be used inside <ThemeProvider>");
  }
  return ctx;
}
