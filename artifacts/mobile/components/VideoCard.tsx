import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useRef, useState } from "react";

import {
  Alert,
  AppState,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
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
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comments, setComments] = useState<{id: number; user: string; text: string}[]>([
    { id: 1, user: "रामू भइया", text: "बहुत बढ़िया वीडियो बा! 👏" },
    { id: 2, user: "सीता दीदी", text: "मन खुश हो गइल 😊" },
  ]);
  const [newComment, setNewComment] = useState("");
  const { user } = useAuth();
  const router = useRouter();
  const videoRef = useRef<Video>(null);

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

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    setComments(prev => [...prev, {
      id: Date.now(),
      user: user?.name || "आप",
      text: newComment.trim(),
    }]);
    setNewComment("");
  };

  // Pause (and fully unload) as soon as this card scrolls off-screen —
  // without this, expo-av keeps playing in the background indefinitely,
  // even after leaving the Video tab or backgrounding the whole app.
  useEffect(() => {
    if (!isActive && started) {
      videoRef.current?.pauseAsync().catch(() => {});
      setIsPlaying(false);
    }
  }, [isActive, started]);

  // Also pause whenever the app itself goes to background/inactive, so
  // audio never keeps playing after the user leaves the app entirely.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        videoRef.current?.pauseAsync().catch(() => {});
        setIsPlaying(false);
      }
    });
    return () => sub.remove();
  }, []);

  // Unload the video when this card is unmounted (e.g. list re-renders),
  // as an extra safety net against orphaned background playback.
  useEffect(() => {
    return () => {
      videoRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

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
      setStarted(true);
      setIsPlaying(true);
    }
  };

  const togglePlayPause = async () => {
    if (isPlaying) {
      await videoRef.current?.pauseAsync().catch(() => {});
      setIsPlaying(false);
      setShowPauseIcon(true);
    } else {
      await videoRef.current?.playAsync().catch(() => {});
      setIsPlaying(true);
      setShowPauseIcon(false);
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
    }
  };

  const getLocalVideoUrl = () => {
    if (!video.videoUrl) return null;
    if (video.videoUrl.startsWith("http")) return video.videoUrl;
    // If video URL is a relative path like /api/media/files/xxx, resolve against the API base
    const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
    const BASE = DOMAIN ? `https://${DOMAIN}` : "";
    return `${BASE}${video.videoUrl}`;
  };

  return (
    <View style={[styles.container, { height: CARD_HEIGHT }]}>
      {started && video.videoUrl ? (
        <TouchableWithoutFeedback onPress={togglePlayPause}>
          <View style={styles.playerContainer}>
            <Video
              ref={videoRef}
              source={{ uri: getLocalVideoUrl() ?? "" }}
              shouldPlay={isPlaying && isActive}
              isLooping
              resizeMode={ResizeMode.COVER}
              style={styles.player}
              useNativeControls={false}
              onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            />
            {/* Minimal center play/pause icon — Reels-style, no persistent bar */}
            {(showPauseIcon || !isPlaying) && (
              <View style={styles.centerIconOverlay} pointerEvents="none">
                <View style={styles.playCircle}>
                  <Feather name={isPlaying ? "pause" : "play"} size={30} color="#fff" />
                </View>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>
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

      <View style={styles.bottomInfo} pointerEvents="none">
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

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setCommentOpen(true)}
        >
          <Feather name="message-circle" size={26} color="#fff" />
          <Text style={styles.actionLabel}>बतावऽ ({comments.length})</Text>
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
      {/* Comment Modal */}
      <Modal
        visible={commentOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCommentOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCommentOpen(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.commentSheet}
        >
          <View style={styles.commentHandle} />
          <View style={styles.commentHeader}>
            <Text style={styles.commentTitle}>बतावऽ ({comments.length})</Text>
            <TouchableOpacity onPress={() => setCommentOpen(false)}>
              <Feather name="x" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.commentList} showsVerticalScrollIndicator={false}>
            {comments.map((c) => (
              <View key={c.id} style={styles.commentItem}>
                <View style={styles.commentAvatar}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                    {c.user.charAt(0)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.commentUser}>{c.user}</Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="अपनी बात लिखीं..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={newComment}
              onChangeText={setNewComment}
              onSubmitEditing={() => requireLogin(handleAddComment)}
            />
            <TouchableOpacity
              style={styles.commentSend}
              onPress={() => requireLogin(handleAddComment)}
            >
              <Feather name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  centerIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
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
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  commentSheet: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingBottom: 30,
  },
  commentHandle: {
    width: 40, height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10, marginBottom: 6,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  commentTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  commentList: { paddingHorizontal: 16, paddingTop: 12, maxHeight: 300 },
  commentItem: { flexDirection: "row", gap: 10, marginBottom: 16 },
  commentAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#E8530A",
    alignItems: "center", justifyContent: "center",
  },
  commentUser: { color: "#fff", fontSize: 13, fontWeight: "700" },
  commentText: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 2 },
  commentInputRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 12, gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  commentInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    color: "#fff", fontSize: 14,
  },
  commentSend: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#E8530A",
    alignItems: "center", justifyContent: "center",
  },
});
