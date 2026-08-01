/**
 * Shared theme type definitions.
 *
 * The actual color values live in `lightTheme.ts` and `darkTheme.ts`.
 * Keeping the shape defined once here means both palettes are forced to
 * stay in sync (TypeScript will error if a key is missing from either).
 */
export type ThemeColors = {
  text: string;
  tint: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  /** Low-emphasis "hint" text — placeholders, disabled labels, timestamps. */
  hint: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  surface: string;
  gold: string;
  saffron: string;
  cream: string;
  radius: number;
};

export type ThemeMode = "light" | "dark";
