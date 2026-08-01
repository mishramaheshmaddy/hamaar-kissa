import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated } from "react-native";

import { darkTheme } from "./darkTheme";
import { lightTheme } from "./lightTheme";
import type { ThemeMode } from "./colors";
import { ThemeContext, ThemeContextValue } from "./ThemeContext";

const THEME_STORAGE_KEY = "app_theme";
const TRANSITION_MS = 250;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Light is the default for first install / until AsyncStorage has been
  // read, per spec.
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [isLoading, setIsLoading] = useState(true);

  // Used to fade the app content briefly on a theme change so the switch
  // feels like a smooth crossfade rather than an instant, jarring cut —
  // without ever dropping to a blank/flickering frame.
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const didMountRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (!cancelled && (stored === "light" || stored === "dark")) {
          setModeState(stored);
        }
      } catch {
        // If storage read fails, fall back to the light-theme default.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyMode = useCallback(
    (next: ThemeMode) => {
      setModeState((current) => {
        if (current === next) return current;

        if (didMountRef.current) {
          Animated.sequence([
            Animated.timing(fadeAnim, {
              toValue: 0.4,
              duration: TRANSITION_MS / 2,
              useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: TRANSITION_MS / 2,
              useNativeDriver: true,
            }),
          ]).start();
        }

        AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {
          // Non-fatal — the theme still applies for this session even if
          // persisting the choice fails.
        });

        return next;
      });
    },
    [fadeAnim]
  );

  useEffect(() => {
    didMountRef.current = true;
  }, []);

  const toggleTheme = useCallback(() => {
    applyMode(mode === "dark" ? "light" : "dark");
  }, [applyMode, mode]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      applyMode(next);
    },
    [applyMode]
  );

  const colors = mode === "dark" ? darkTheme : lightTheme;

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, colors, toggleTheme, setMode, isLoading }),
    [mode, colors, toggleTheme, setMode, isLoading]
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} animated />
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>{children}</Animated.View>
    </ThemeContext.Provider>
  );
}
