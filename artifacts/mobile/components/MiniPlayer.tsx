import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";

const CATEGORY_ICONS: Record<string, string> = {
  horror: "👻",
  village: "🌾",
  emotional: "💝",
  devotional: "🪔",
  mythological: "📜",
  love: "❤️",
  crime: "🔍",
  motivation: "⚡",
  kids: "⭐",
  comedy: "😂",
  folk: "🎵",
  drama: "🎭",
};

export default function MiniPlayer() {
  const { currentStory, isPlaying, progress, togglePlay, stopPlayer } = useAudio();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  if (!currentStory) return null;

  const icon = CATEGORY_ICONS[currentStory.category] ?? "🎙️";
  const bottomOffset = Platform.OS === "web" ? 84 : insets.bottom + 60;

  return (
    <View
      style={[
        styles.wrapper,
        {
          bottom: bottomOffset,
          backgroundColor: colors.primary,
          shadowColor: colors.primary,
        },
      ]}
    >
      <View style={[styles.progressBar, { width: `${progress}%` as any }]} />
      <TouchableOpacity
        style={styles.inner}
        onPress={() => router.push("/audio/player")}
        activeOpacity={0.9}
      >
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{currentStory.title}</Text>
          <Text style={styles.narrator} numberOfLines={1}>{currentStory.narrator}</Text>
        </View>
        <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); togglePlay(); }} style={styles.controlBtn}>
          <Feather name={isPlaying ? "pause" : "play"} size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); stopPlayer(); }} style={styles.controlBtn}>
          <Feather name="x" size={18} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 12,
    right: 12,
    borderRadius: 18,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 100,
  },
  progressBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 22 },
  info: { flex: 1, gap: 2 },
  title: { color: "#fff", fontSize: 14, fontWeight: "700" },
  narrator: { color: "rgba(255,255,255,0.75)", fontSize: 11 },
  controlBtn: { padding: 8 },
});
