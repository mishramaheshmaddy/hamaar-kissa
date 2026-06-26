import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Share,
  Alert,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { AudioStory } from "@/context/AudioContext";
import { useAuth } from "@/context/AuthContext";
import { useDownloads } from "@/hooks/useDownloads";
import { downloadAudio, getFileSize } from "@/lib/downloadManager";
import { CATEGORY_GRADIENTS } from "./CategoryColors";

interface AudioCardProps {
  story: AudioStory;
  onPress: () => void;
  isPlaying?: boolean;
  compact?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const BASE = DOMAIN ? `https://${DOMAIN}` : "";

function resolveUrl(url: string | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${BASE}${url}`;
}

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

const CATEGORY_LABEL: Record<string, string> = {
  horror: "भूत-प्रेत",
  village: "गाँव",
  emotional: "दिल के बात",
  devotional: "भक्ति",
  mythological: "पुरनिया",
  love: "प्रेम",
  crime: "क्राइम",
  motivation: "हिम्मत",
  kids: "लइका के",
  comedy: "हँसी",
  folk: "लोकगीत",
  drama: "नाटक",
};

export default function AudioCard({ story, onPress, isPlaying, compact }: AudioCardProps) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const gradient = CATEGORY_GRADIENTS[story.category] ?? ["#E8530A", "#BF360C"];
  const icon = CATEGORY_ICONS[story.category] ?? "🎙️";
  const displayLabel = story.categoryName ?? CATEGORY_LABEL[story.category] ?? story.category;
  const thumbUri = resolveUrl(story.thumbnail);

  // Login check helper
  const requireLogin = (action: () => void) => {
    if (!user) {
      Alert.alert(
        "लॉगिन करीं 🙏",
        "इ feature के use करे खातिर पहिले login करीं।",
        [
          { text: "बाद में", style: "cancel" },
          { text: "Login करीं", onPress: () => router.push("/login" as any) },
        ]
      );
      return;
    }
    action();
  };

  const handleLike = () => requireLogin(() => {
    // TODO: call like API
    Alert.alert("❤️", "पसंद कइलऽ!");
  });

  const handleSave = () => requireLogin(() => {
    // TODO: call save/bookmark API
    Alert.alert("🔖", "सेव हो गइल!");
  });

  const { isDownloaded, addDownload, removeDownload } = useDownloads();
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const downloaded = isDownloaded(story.id);

  const handleDownloadPress = () => requireLogin(async () => {
    if (downloaded) {
      Alert.alert(
        "डिलीट करीं?",
        "डाउनलोड हटा दिया जाएगा।",
        [
          { text: "नाहीं", style: "cancel" },
          { text: "हाँ", style: "destructive", onPress: () => removeDownload(story.id) },
        ]
      );
      return;
    }
    if (!story.audioUrl) {
      Alert.alert("Error", "Audio URL नइखे।");
      return;
    }
    setDownloading(true);
    setDownloadProgress(0);
    try {
      const localPath = await downloadAudio(story.id, story.audioUrl, setDownloadProgress);
      const fileSize = await getFileSize(story.id);
      await addDownload({
        storyId: story.id,
        title: story.title,
        thumbnail: story.thumbnail || "",
        duration: story.duration,
        category: story.category,
        narrator: story.narrator || "",
        localPath,
        fileSize,
        downloadedAt: new Date().toISOString(),
      });
      Alert.alert("✅", "डाउनलोड पूरा भइल!");
    } catch (e) {
      Alert.alert("Error", "डाउनलोड फेल भइल। दोबारा कोशिश करीं।");
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  });

  const handleShare = async () => {
    try {
      await Share.share({
        message: `"${story.title}" सुनीं Hamaar Kissa पर 🎙️\nhttps://hamaar-kissa-api.onrender.com`,
        title: story.title,
      });
    } catch {}
  };

  const handleDownload = () => requireLogin(() => {
    // TODO: implement download
    Alert.alert("⬇️", "जल्दी आवत बा!");
  });

  if (compact) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[styles.compactCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.compactThumb, { backgroundColor: gradient[1] }]}>
          {thumbUri ? (
            <Image
              source={{ uri: thumbUri }}
              style={styles.compactThumbImg}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Text style={styles.compactIcon}>{icon}</Text>
          )}
        </View>
        <View style={styles.compactInfo}>
          <Text style={[styles.compactTitle, { color: colors.foreground }]} numberOfLines={2}>
            {story.title}
          </Text>
          <Text style={[styles.compactMeta, { color: colors.mutedForeground }]}>
            {story.narrator} • {formatDuration(story.duration)}
          </Text>
        </View>
        <View style={styles.compactActions}>
          <TouchableOpacity onPress={handleLike} style={styles.actionBtn}>
            <Feather name="heart" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.actionBtn}>
            <Feather name="share-2" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onPress}
            style={[styles.compactPlay, { backgroundColor: isPlaying ? colors.primary : colors.secondary }]}
          >
            <Feather name={isPlaying ? "pause" : "play"} size={18} color={isPlaying ? "#fff" : colors.primary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.thumbnail, { backgroundColor: gradient[1] }]}>
        {thumbUri ? (
          <Image
            source={{ uri: thumbUri }}
            style={styles.thumbImg}
            contentFit="cover"
            transition={250}
          />
        ) : (
          <Text style={styles.thumbIcon}>{icon}</Text>
        )}

        {isPlaying && (
          <View style={[styles.nowPlaying, { backgroundColor: colors.primary }]}>
            <Feather name="play" size={10} color="#fff" />
          </View>
        )}

        {thumbUri && (
          <View style={[styles.categoryOverlay, { backgroundColor: gradient[1] + "cc" }]}>
            <Text style={styles.categoryOverlayText}>{icon}</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <View style={[styles.categoryBadge, { backgroundColor: gradient[1] + "33" }]}>
          <Text style={[styles.categoryText, { color: gradient[0] }]}>{displayLabel}</Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {story.title}
        </Text>

        {/* Action buttons row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={handleLike} style={styles.actionBtn}>
            <Feather name="heart" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} style={styles.actionBtn}>
            <Feather name="bookmark" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.actionBtn}>
            <Feather name="share-2" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDownloadPress} style={styles.actionBtn}>
            {downloading ? (
              <Text style={{ fontSize: 10, color: colors.primary, fontWeight: "700" }}>{downloadProgress}%</Text>
            ) : downloaded ? (
              <Feather name="check-circle" size={14} color={colors.primary} />
            ) : (
              <Feather name="download" size={14} color={colors.mutedForeground} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {formatDuration(story.duration)}
          </Text>
          <TouchableOpacity
            onPress={onPress}
            style={[styles.playBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name={isPlaying ? "pause" : "play"} size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  thumbImg: {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
  },
  thumbIcon: { fontSize: 44 },
  categoryOverlay: {
    position: "absolute",
    bottom: 6,
    left: 6,
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryOverlayText: { fontSize: 15 },
  nowPlaying: {
    position: "absolute",
    top: 8,
    right: 8,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    zIndex: 2,
  },
  info: { padding: 10, gap: 4 },
  categoryBadge: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  categoryText: { fontSize: 10, fontWeight: "600" },
  title: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
  actionsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  actionBtn: {
    padding: 4,
  },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  meta: { fontSize: 11 },
  playBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  compactCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: 10, gap: 12 },
  compactThumb: { width: 50, height: 50, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  compactThumbImg: { width: "100%", height: "100%" },
  compactIcon: { fontSize: 24 },
  compactInfo: { flex: 1, gap: 3 },
  compactTitle: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  compactMeta: { fontSize: 12 },
  compactActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  compactPlay: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
