import { Feather } from "@expo/vector-icons";
import { Video, ResizeMode } from "expo-av";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { VideoItem } from "@/data/mockData";

const { width, height } = Dimensions.get("window");
const CARD_HEIGHT = height;

// Exported so home screen can use it for video thumbnails
// Keys are Hindi category names as they come from the API/DB
export const CATEGORY_ICONS: Record<string, string> = {
  // Hindi names (from DB)
  "भूत-प्रेत": "👻",
  "गाँव के कहानी": "🌾",
  "दिल के बात": "💝",
  "भक्ति": "🪔",
  "पुरनिया कथा": "📜",
  "पुरिनया कथा": "📜",
  "प्रेम कहानी": "❤️",
  "क्राइम": "🔍",
  "लइका के": "⭐",
  "हिम्मत": "⚡",
  "कॉमेडी": "😂",
  "लोकगीत": "🎵",
  "नाटक": "🎭",
  // English slugs (fallback)
  horror: "👻",
  village: "🌾",
  emotional: "💝",
  devotional: "🪔",
  mythological: "📜",
  love: "❤️",
  crime: "🔍",
  kids: "⭐",
  motivation: "⚡",
  comedy: "😂",
  folk: "🎵",
  drama: "🎭",
};

// Cycle of brand-consistent background colors keyed by (id % length)
const BG_COLORS = [
  "#8B1A1A",
  "#1A4A8B",
  "#1A6B3C",
  "#5B1A8B",
  "#8B5B1A",
  "#1A6B6B",
  "#6B1A5B",
  "#3C6B1A",
];

// Map categoryId to emoji icon
const CATEGORY_ID_ICONS: Record<number, string> = {
  9: "👻",   // भूत-प्रेत
  10: "🌾",  // गाँव के कहानी
  11: "💝",  // दिल के बात
  12: "🪔",  // भक्ति
  13: "📜",  // पुरनिया कथा
  14: "❤️",  // प्रेम कहानी
  15: "🔍",  // क्राइम
  16: "⭐",  // लइका के
  17: "⚡",  // हिम्मत
  18: "😂",  // कॉमेडी
  19: "🎵",  // लोकगीत
  20: "🎭",  // नाटक
};

interface VideoCardProps {
  video: VideoItem;
  isActive: boolean;
}

export default function VideoCard({ video, isActive }: VideoCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes);
  const [saved, setSaved] = useState(false);
  const [localPlayerOpen, setLocalPlayerOpen] = useState(false);
  const videoRef = useRef(null);

  const numericId = parseInt(video.id, 10) || 0;
  const bgColor = BG_COLORS[numericId % BG_COLORS.length];
  const icon = (video.categoryId && CATEGORY_ID_ICONS[video.categoryId]) ?? "🎬";

  const handlePlay = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (video.youtubeId) {
      await WebBrowser.openBrowserAsync(
        `https://www.youtube.com/watch?v=${video.youtubeId}`,
        { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN }
      );
    } else if (video.videoUrl) {
      setLocalPlayerOpen(true);
    }
  };

  const getLocalVideoUrl = () => {
    if (!video.videoUrl) return null;
    if (video.videoUrl.startsWith("http")) return video.videoUrl;
    // If video URL is a relative path like /api/media/files/xxx, resolve against the API base
    return video.videoUrl;
  };

  return (
    <View style={[styles.container, { height: CARD_HEIGHT }]}>
      {localPlayerOpen ? (
        <View style={styles.playerContainer}>
          <Video
            ref={videoRef}
            source={{ uri: getLocalVideoUrl() ?? "" }}
            shouldPlay
            isLooping
            resizeMode={ResizeMode.COVER}
            style={styles.player}
            useNativeControls
          />
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setLocalPlayerOpen(false)}
          >
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.videoArea, { backgroundColor: bgColor }]}>
          <Text style={styles.bigIcon}>{icon}</Text>

          {video.youtubeId && (
            <View style={styles.badge}>
              <Feather name="youtube" size={12} color="#fff" />
              <Text style={styles.badgeText}>YouTube</Text>
            </View>
          )}
          {video.sourceType === "upload" && (
            <View style={[styles.badge, { backgroundColor: "rgba(0,120,255,0.85)" }]}>
              <Feather name="film" size={12} color="#fff" />
              <Text style={styles.badgeText}>वीडियो</Text>
            </View>
          )}

          <View style={styles.overlay} />

          <TouchableOpacity
            style={styles.playOverlay}
            onPress={handlePlay}
            activeOpacity={0.8}
          >
            <View style={styles.playCircle}>
              <Feather name="play" size={30} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {!localPlayerOpen && (
        <>
          <View style={styles.bottomInfo}>
            <Text style={styles.title} numberOfLines={2}>{video.title}</Text>
            {video.description ? (
              <Text style={styles.desc} numberOfLines={2}>{video.description}</Text>
            ) : null}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setLiked((l) => !l);
                setLikeCount((c) => (liked ? c - 1 : c + 1));
              }}
            >
              <Feather name="heart" size={26} color={liked ? "#FF4444" : "#fff"} />
              <Text style={styles.actionLabel}>
                {likeCount > 999
                  ? `${(likeCount / 1000).toFixed(1)}K`
                  : likeCount || "पसंद"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn}>
              <Feather name="message-circle" size={26} color="#fff" />
              <Text style={styles.actionLabel}>बतावऽ</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn}>
              <Feather name="share-2" size={26} color="#fff" />
              <Text style={styles.actionLabel}>शेयर</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setSaved((s) => !s);
              }}
            >
              <Feather name="bookmark" size={26} color={saved ? "#F5A623" : "#fff"} />
              <Text style={styles.actionLabel}>सेव</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width, position: "relative" },
  videoArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  bigIcon: { fontSize: 100, opacity: 0.4 },
  badge: {
    position: "absolute",
    top: 60,
    left: 16,
    backgroundColor: "rgba(220,0,0,0.85)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  playerContainer: { flex: 1, backgroundColor: "#000" },
  player: { flex: 1 },
  closeBtn: {
    position: "absolute",
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  bottomInfo: {
    position: "absolute",
    bottom: 90,
    left: 16,
    right: 80,
    gap: 6,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  desc: { color: "rgba(255,255,255,0.65)", fontSize: 12, lineHeight: 17 },
  actions: {
    position: "absolute",
    right: 12,
    bottom: 90,
    alignItems: "center",
    gap: 20,
  },
  actionBtn: { alignItems: "center", gap: 4 },
  actionLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
