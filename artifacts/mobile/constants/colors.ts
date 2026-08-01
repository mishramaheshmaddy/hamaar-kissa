// Kept for backward compatibility with any code importing the palette
// directly (e.g. tooling, storybook-style previews). The canonical source
// of truth for theme colors is now `theme/lightTheme.ts` and
// `theme/darkTheme.ts` — this file just re-exports them under their
// original shape so nothing duplicates color values.
import { darkTheme } from "@/theme/darkTheme";
import { lightTheme } from "@/theme/lightTheme";

const colors = {
  light: lightTheme,
  dark: darkTheme,
  radius: lightTheme.radius,
};

export default colors;
