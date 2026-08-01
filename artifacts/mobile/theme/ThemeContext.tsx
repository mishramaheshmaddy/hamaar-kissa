import { createContext } from "react";
import type { ThemeColors, ThemeMode } from "./colors";

export type ThemeContextValue = {
  /** "light" | "dark" — the currently active theme. */
  mode: ThemeMode;
  /** Resolved color tokens for the active theme. */
  colors: ThemeColors;
  /** Flips between light and dark and persists the choice. */
  toggleTheme: () => void;
  /** Sets an explicit theme and persists the choice. */
  setMode: (mode: ThemeMode) => void;
  /** True until the persisted preference has been read from storage. */
  isLoading: boolean;
};

// Default value is only ever used if a component reads the context outside
// of <ThemeProvider>, which useTheme() guards against with a clear error.
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
