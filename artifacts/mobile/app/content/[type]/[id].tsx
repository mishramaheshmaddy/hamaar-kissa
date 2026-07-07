import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAudio, AudioStory } from "@/context/AudioContext";
import { ApiAudioStory, apiFetch } from "@/lib/api";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const BASE = DOMAIN ? `https://${DOMAIN}` : "";

function mapStory(s: ApiAudioStory): AudioStory {
  return {
    id: String(s.id),
    title: s.title,
    category: s.categoryName || "other",
    categoryId: s.categoryId ?? undefined,
    categoryName: s.categoryName ?? undefined,
    duration: s.durationSeconds,
    thumbnail: s.thumbnailUrl
      ? (s.thumbnailUrl.startsWith("/") ? `${BASE}${s.thumbnailUrl}` : s.thumbnailUrl)
      : "",
    narrator: s.narrator,
    description: s.description,
    audioUrl: s.audioUrl
      ? (s.audioUrl.startsWith("/") ? `${BASE}${s.audioUrl}` : s.audioUrl)
      : "",
  };
}

// This screen is what actually opens when someone taps a shared link and
// the app is already installed — e.g. hamaarkissa://content/audio/123.
// It fetches the content and immediately starts playing it (for audio) or
// opens the single-video viewer (for video), matching what people expect
// from Instagram/WhatsApp-style share links.
export default function ContentDeepLinkScreen() {
  const { type, id } = useLocalSearchParams<{ type?: string; id?: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { playStory } = useAudio();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || !type || !id) return;
    handled.current = true;

    (async () => {
      try {
        if (type === "audio") {
          const story = await apiFetch<ApiAudioStory>(`/api/audio-stories/${id}`);
          await playStory(mapStory(story));
          router.replace("/audio/player");
        } else if (type === "video") {
          router.replace(`/video/${id}` as any);
        } else {
          router.replace("/(tabs)" as any);
        }
      } catch (err) {
        console.error("content deep link error:", err);
        router.replace("/(tabs)" as any);
      }
    })();
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
