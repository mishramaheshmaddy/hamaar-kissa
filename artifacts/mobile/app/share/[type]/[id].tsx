import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

// This is what actually opens when someone taps a shared link
// (https://hamaar-kissa-api.onrender.com/share/audio/123) and the app is
// already installed — Android's verified App Links hand the URL straight to
// this screen instead of a browser. We just forward to the real content
// deep-link screen, which fetches and opens the content directly.
// If the app is NOT installed, this route is never reached — the OS falls
// through to the browser, which loads the server's /share/:type/:id landing
// page (HTML + OG tags + Play Store fallback) instead.
export default function ShareDeepLinkScreen() {
  const { type, id } = useLocalSearchParams<{ type?: string; id?: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || !type || !id) return;
    handled.current = true;
    router.replace(`/content/${type}/${id}` as any);
  }, [type, id]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>लोड हो रहल बा…</Text>
    </View>
  );
}
