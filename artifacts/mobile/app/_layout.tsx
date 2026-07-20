import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { Feather } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AudioProvider } from "@/context/AudioContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Platform } from "react-native";
import {
  loadStoredNotificationPrefs,
  registerForPushNotifications,
  setupNotificationOpenHandler,
} from "@/lib/pushNotifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const router = useRouter();
  const { user } = useAuth();

  // Silently registers this device for push notifications on every app
  // start AND whenever login state changes (respecting whatever the user
  // last set in Settings → सूचना, defaulting to on). Re-running this on
  // user?.phone changes is what lets the CMS target a notification at a
  // specific phone number — the token gets tagged with whoever is
  // currently logged in on this device. Also wires up tap-to-open deep
  // linking so tapping a notification jumps straight to that story/video.
  useEffect(() => {
    if (Platform.OS === "web") return;

    (async () => {
      const stored = await loadStoredNotificationPrefs();
      if (stored.master) {
        registerForPushNotifications({
          master: stored.master,
          notifyNewStories: stored.prefs.new_stories,
          notifyNewVideos: stored.prefs.new_videos,
          phone: user?.phone ?? null,
        });
      }
    })();
  }, [user?.phone]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const unsubscribe = setupNotificationOpenHandler((type, id) => {
      router.push(`/content/${type}/${id}` as any);
    });
    return unsubscribe;
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="audio/player"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="settings"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="upload"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="category/[id]"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="login"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="share"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    ...(Platform.OS === "web" ? Feather.font : {}),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AudioProvider>
            <AuthProvider>
              <GestureHandlerRootView>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </AuthProvider>
          </AudioProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
