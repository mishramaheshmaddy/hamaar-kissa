import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";
import { CATEGORY_GRADIENTS } from "@/components/CategoryColors";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const BASE = DOMAIN ? `https://${DOMAIN}` : "";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

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

function formatTime(seconds: number, progress: number): string {
  const elapsed = Math.floor((progress / 100) * seconds);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTotal(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    currentStory,
    isPlaying,
    progress,
    speed,
    togglePlay,
    seekForward,
    seekBackward,
    setSpeed,
    likedStories,
    savedStories,
    toggleLike,
    toggleSave,
  } = useAudio();
  const [showSpeeds, setShowSpeeds] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  if (!currentStory) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 60 }}>🎧</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          कवनो कहानी नइखे चलत
        </Text>
        <TouchableOpacity
          style={[styles.emptyBackBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>वापस जाईं</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const gradient = CATEGORY_GRADIENTS[currentStory.category] ?? ["#E8530A", "#BF360C"];
  const icon = CATEGORY_ICONS[currentStory.category] ?? "🎙️";
  const isLiked = likedStories.includes(currentStory.id);
  const isSaved = savedStories.includes(currentStory.id);

  const fullAudioUrl = currentStory.audioUrl
  ? currentStory.audioUrl.startsWith("/")
    ? `${BASE}${currentStory.audioUrl}`
    : currentStory.audioUrl
  : "";

async function handleShare() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const webUrl = `${BASE}/share/audio/${currentStory!.id}`;
    const shareContent: Parameters<typeof Share.share>[0] = {
      title: currentStory!.title,
      message: `🎙️ ${currentStory!.title}\nसुनावत बाड़े: ${currentStory!.narrator}\n\nHamaar Kissa पर सुनीं!\n${webUrl}`,
      url: Platform.OS === "ios" ? webUrl : undefined,
    };
    await Share.share(shareContent);
  } catch (_e) {
    // User cancelled — no-op
  }
}

  async function handleDownload() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!currentStory) return;
    if (Platform.OS === "web") {
      Alert.alert("डाउनलोड", "Mobile app पर उपलब्ध बा।");
      return;
    }
    if (!fullAudioUrl) {
      Alert.alert("डाउनलोड", "इस कहानी के लिए ऑडियो उपलब्ध नइखे।");
      return;
    }
    
    Alert.alert(
      "डाउनलोड",
      "Player download integration अभी पूरा नहीं हुआ है। फिलहाल Home/Audio list से डाउनलोड करें।"
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: gradient[1] }]}>
      <View style={[styles.bgOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPadding + 12, paddingBottom: bottomPadding + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <View style={styles.backRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backCircle}>
            <Feather name="chevron-down" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.backLabel}>अबही चलत बा</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Big Icon */}
        <View style={[styles.artworkContainer, { borderColor: "rgba(255,255,255,0.2)" }]}>
          <View style={[styles.artwork, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
            <Text style={styles.artworkIcon}>{icon}</Text>
          </View>
          {isPlaying && (
            <View style={styles.soundWaves}>
              {[14, 22, 16, 24, 18].map((h, i) => (
                <View
                  key={i}
                  style={[styles.wave, { height: h, backgroundColor: "rgba(255,255,255,0.7)" }]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.storyTitle}>{currentStory.title}</Text>
          <Text style={styles.narrator}>{currentStory.narrator}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {currentStory.description}
          </Text>
        </View>

        {/* Like / Save / Share / Download */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => {
              toggleLike(currentStory.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={styles.actionBtn}
          >
            <Feather name="heart" size={26} color={isLiked ? "#FF4444" : "#fff"} />
            <Text style={styles.actionLabel}>पसंद</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              toggleSave(currentStory.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            style={styles.actionBtn}
          >
            <Feather name="bookmark" size={26} color={isSaved ? "#F5A623" : "#fff"} />
            <Text style={styles.actionLabel}>सेव</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleShare} style={styles.actionBtn}>
            <Feather name="share-2" size={26} color="#fff" />
            <Text style={styles.actionLabel}>शेयर</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDownload} style={styles.actionBtn}>
            <Feather name="download" size={26} color="#fff" />
            <Text style={styles.actionLabel}>डाउनलोड</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={[styles.progressBg, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%` as any, backgroundColor: "#fff" },
              ]}
            />
            <View
              style={[
                styles.progressThumb,
                {
                  left: `${Math.min(progress, 97)}%` as any,
                  backgroundColor: "#fff",
                  transform: [{ translateX: -8 }],
                },
              ]}
            />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>
              {formatTime(currentStory.duration, progress)}
            </Text>
            <Text style={styles.timeText}>{formatTotal(currentStory.duration)}</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={() => {
              seekBackward();
              Haptics.selectionAsync();
            }}
            style={styles.ctrlBtn}
          >
            <Feather name="rewind" size={32} color="#fff" />
            <Text style={styles.ctrlLabel}>10s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              togglePlay();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            style={[styles.playBtn, { backgroundColor: "#fff" }]}
          >
            <Feather name={isPlaying ? "pause" : "play"} size={36} color={gradient[1]} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              seekForward();
              Haptics.selectionAsync();
            }}
            style={styles.ctrlBtn}
          >
            <Feather name="fast-forward" size={32} color="#fff" />
            <Text style={styles.ctrlLabel}>10s</Text>
          </TouchableOpacity>
        </View>

        {/* Speed */}
        <View style={styles.speedSection}>
          <TouchableOpacity
            onPress={() => setShowSpeeds((v) => !v)}
            style={[styles.speedBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
          >
            <Text style={{ fontSize: 14 }}>⚡</Text>
            <Text style={styles.speedText}>{speed}x रफ्तार</Text>
            <Feather
              name={showSpeeds ? "chevron-up" : "chevron-down"}
              size={14}
              color="#fff"
            />
          </TouchableOpacity>

          {showSpeeds && (
            <View style={[styles.speedMenu, { backgroundColor: "rgba(0,0,0,0.85)" }]}>
              {SPEEDS.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => {
                    setSpeed(s);
                    setShowSpeeds(false);
                  }}
                  style={[
                    styles.speedOption,
                    speed === s && { backgroundColor: "rgba(255,255,255,0.2)" },
                  ]}
                >
                  <Text
                    style={[
                      styles.speedOptionText,
                      { color: speed === s ? "#fff" : "rgba(255,255,255,0.7)" },
                    ]}
                  >
                    {s}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgOverlay: { ...StyleSheet.absoluteFillObject },
  content: { paddingHorizontal: 24, alignItems: "center" },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 24,
    justifyContent: "space-between",
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  backLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  artworkContainer: {
    width: 220,
    height: 220,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 36,
    position: "relative",
  },
  artwork: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  artworkIcon: { fontSize: 96 },
  soundWaves: {
    position: "absolute",
    bottom: -24,
    flexDirection: "row",
    gap: 5,
    alignItems: "flex-end",
  },
  wave: { width: 5, borderRadius: 3 },
  titleBlock: { alignItems: "center", gap: 6, marginBottom: 24, width: "100%" },
  storyTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 30,
  },
  narrator: { color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: "600" },
  description: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  actionRow: { flexDirection: "row", gap: 24, marginBottom: 28 },
  actionBtn: { alignItems: "center", gap: 5, padding: 8 },
  actionLabel: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "600" },
  progressSection: { width: "100%", marginBottom: 32, gap: 8 },
  progressBg: { height: 5, borderRadius: 3, position: "relative" },
  progressFill: { height: 5, borderRadius: 3, position: "absolute", left: 0, top: 0 },
  progressThumb: { width: 16, height: 16, borderRadius: 8, position: "absolute", top: -6 },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  timeText: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 36,
    marginBottom: 24,
  },
  ctrlBtn: { alignItems: "center", gap: 4 },
  ctrlLabel: { color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: "700" },
  playBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  speedSection: { alignItems: "center", position: "relative" },
  speedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  speedText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  speedMenu: {
    position: "absolute",
    bottom: 48,
    borderRadius: 14,
    overflow: "hidden",
    minWidth: 90,
  },
  speedOption: { paddingHorizontal: 20, paddingVertical: 10 },
  speedOptionText: { fontSize: 14, textAlign: "center", fontWeight: "600" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  emptyText: { fontSize: 16, textAlign: "center" },
  emptyBackBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
});
