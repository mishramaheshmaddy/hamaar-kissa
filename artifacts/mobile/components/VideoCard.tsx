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
  DeviceEventEmitter,
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
import {
  addVideoComment,
  getVideoEngagement,
  setVideoReaction,
  trackEvent,
  type ApiVideoComment,
} from "@/lib/api";

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
  const [comments, setComments] = useState<ApiVideoComment[]>([]);
  const [engagementLoading, setEngagementLoading] = useState(true);
  const [reactionSaving, setReactionSaving] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<ApiVideoComment | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<number, boolean>>({});
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionSuggestions, setMentionSuggestions] = useState<ApiVideoComment[]>([]);
  const { user } = useAuth();
  const router = useRouter();
  const videoRef = useRef<Video>(null);

  const handleShare = async () => {
    try {
      const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
      const BASE = DOMAIN ? `https://${DOMAIN}` : "";
      const webUrl = `${BASE}/share/video/${video.id}`;
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Share.share({
        message: `"${video.title}" देखीं Hamaar Kissa पर 🎬\n${webUrl}`,
        title: video.title,
        url: Platform.OS === "ios" ? webUrl : undefined,
      });
    } catch {}
  };

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

  useEffect(() => {
    let cancelled = false;
    setEngagementLoading(true);
    getVideoEngagement(Number(video.id))
      .then((data) => {
        if (cancelled) return;
        setLiked(data.liked);
        setLikeCount(data.likes);
        setSaved(data.saved);
        setComments(data.comments);
      })
      .catch((error) => {
        console.warn("video engagement load failed", error);
      })
      .finally(() => {
        if (!cancelled) setEngagementLoading(false);
      });
    return () => { cancelled = true; };
  }, [video.id, user?.id]);

  const getThreadRootId = (comment: ApiVideoComment): number => {
    let current = comment;

    for (let i = 0; i < comments.length; i += 1) {
      if (current.parentCommentId == null) return current.id;

      const parent = comments.find((item) => item.id === current.parentCommentId);

      if (!parent) return current.id;

      current = parent;
    }

    return current.id;
  };

  const updateMentionSuggestions = (value: string) => {
    const match = value.match(/(?:^|\\s)@([^\\s@]*)$/);

    if (!match) {
      setMentionQuery("");
      setMentionSuggestions([]);
      return;
    }

    const query = match[1].toLowerCase();
    const threadRootId = replyingTo ? getThreadRootId(replyingTo) : null;

    if (threadRootId == null) {
      setMentionQuery(query);
      setMentionSuggestions([]);
      return;
    }

    const threadComments = comments.filter((item) => {
      return getThreadRootId(item) === threadRootId;
    });

    const seen = new Set<string>();

    const suggestions = threadComments.filter((item) => {
      const name = (item.user || "").trim();

      if (!name) return false;

      const key = name.toLowerCase();

      if (seen.has(key)) return false;

      if (query && !key.includes(query)) return false;

      seen.add(key);
      return true;
    });

    setMentionQuery(query);
    setMentionSuggestions(suggestions.slice(0, 6));
  };

  const handleMentionSelect = (comment: ApiVideoComment) => {
    const name = (comment.user || "").trim();

    if (!name) return;

    setNewComment((current) => {
      const match = current.match(/(?:^|\\s)@([^\\s@]*)$/);

      if (!match) {
        return current;
      }

      const start = match.index ?? 0;
      const prefix = current.slice(0, start);

      return `${prefix}@${name} `;
    });

    setMentionQuery("");
    setMentionSuggestions([]);
  };

  const handleAddComment = async () => {
    const text = newComment.trim();
    if (!text || !user) return;

    try {
      const comment = await addVideoComment(
        Number(video.id),
        text,
        replyingTo?.id ?? null,
      );

      setComments((prev) => [comment, ...prev]);

      setNewComment("");
      setReplyingTo(null);
    } catch {
      Alert.alert("कमेंट ना जुड़ल", "कृपया फेर से कोशिश करीं।");
    }
  };

  // Pause (and fully unload) as soon as this card scrolls off-screen —
  // without this, expo-av keeps playing in the background indefinitely,
  // even after leaving the Video tab or backgrounding the whole app.
  useEffect(() => {
    if (!isActive && started) {
      stopVideo();
    }
  }, [isActive, started]);

  // Autoplay: as soon as a local (uploaded) video becomes the active card,
  // start it immediately — no tap needed, matching Reels/TikTok. YouTube
  // videos still require a tap since they open in an external browser.
  useEffect(() => {
    if (isActive && video.videoUrl && !video.youtubeId) {
      setStarted(true);
      setIsPlaying(true);
      trackEvent("video_play", "video", video.id);
    }
  }, [isActive, video.videoUrl, video.youtubeId]);

  // Also pause whenever the app itself goes to background/inactive, so
  // audio never keeps playing after the user leaves the app entirely.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        stopVideo();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      "STOP_ALL_VIDEOS",
      () => {
        stopVideo();
      }
    );

    return () => sub.remove();
  }, []);

  // Unload the video when this card is unmounted (e.g. list re-renders),
  // as an extra safety net against orphaned background playback.
  useEffect(() => {
    return () => {
      stopVideo();
    };
  }, []);

  const numericId = parseInt(video.id, 10) || 0;
  const bgColor = BG_COLORS[numericId % BG_COLORS.length];
  const icon = (video.categoryId && CATEGORY_ID_ICONS[video.categoryId]) ?? "🎬";

  
  const stopVideo = async () => {
    try {
      await videoRef.current?.stopAsync();
    } catch {}

    try {
      await videoRef.current?.unloadAsync();
    } catch {}

    setIsPlaying(false);
    setStarted(false);
  };

const handlePlay = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (video.youtubeId) {
      trackEvent("video_play", "video", video.id);
      await WebBrowser.openBrowserAsync(
        `https://www.youtube.com/watch?v=${video.youtubeId}`,
        { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN }
      );
    } else if (video.videoUrl) {
      if (!started) {
        setStarted(true);
        trackEvent("video_play", "video", video.id);
      }
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

  const renderComment = (comment: ApiVideoComment, depth = 0): React.ReactNode => {
    const replies = comments.filter(
      (item) => item.parentCommentId === comment.id,
    );

    const isExpanded = expandedReplies[comment.id] === true;
    const visibleReplies = isExpanded ? replies : replies.slice(0, 2);
    const hiddenReplyCount = Math.max(replies.length - 2, 0);

    return (
      <View key={comment.id}>
        <View
          style={[
            styles.commentItem,
            {
              marginLeft: Math.min(depth * 28, 140),
            },
          ]}
        >
          <View style={styles.commentAvatar}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
              {comment.user.charAt(0)}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.commentUser}>{comment.user}</Text>

            <Text style={styles.commentText}>
              {comment.text.split(/(@[^\s@]+)/g).map((part, index) =>
                part.startsWith("@") ? (
                  <Text
                    key={`${comment.id}-mention-${index}`}
                    style={{
                      color: "#F5A623",
                      fontWeight: "700",
                    }}
                  >
                    {part}
                  </Text>
                ) : (
                  <Text key={`${comment.id}-text-${index}`}>{part}</Text>
                ),
              )}
            </Text>

            <TouchableOpacity
              onPress={() => {
                setReplyingTo(comment);

                const mention = `@${comment.user} `;
                setNewComment((current) =>
                  current.trim().length === 0
                    ? mention
                    : current.startsWith(mention)
                      ? current
                      : `${mention}${current}`,
                );
              }}
              style={{ marginTop: 6, alignSelf: "flex-start" }}
            >
              <Text
                style={{
                  color: "rgba(255,255,255,0.65)",
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                जवाब दीं
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {replies.length > 0 && (
          <View>
            {visibleReplies.map((reply) =>
              renderComment(reply, depth + 1),
            )}

            {hiddenReplyCount > 0 && !isExpanded && (
              <TouchableOpacity
                onPress={() =>
                  setExpandedReplies((prev) => ({
                    ...prev,
                    [comment.id]: true,
                  }))
                }
                style={{
                  marginLeft: Math.min((depth + 1) * 28, 140) + 38,
                  marginBottom: 10,
                  alignSelf: "flex-start",
                }}
              >
                <Text
                  style={{
                    color: "#F5A623",
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {hiddenReplyCount === 1
                    ? "और 1 जवाब देखीं"
                    : `और ${hiddenReplyCount} जवाब देखीं`}
                </Text>
              </TouchableOpacity>
            )}

            {isExpanded && replies.length > 2 && (
              <TouchableOpacity
                onPress={() =>
                  setExpandedReplies((prev) => ({
                    ...prev,
                    [comment.id]: false,
                  }))
                }
                style={{
                  marginLeft: Math.min((depth + 1) * 28, 140) + 38,
                  marginBottom: 10,
                  alignSelf: "flex-start",
                }}
              >
                <Text
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  जवाब समेटीं
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const topLevelComments = comments.filter(
    (comment) => comment.parentCommentId == null,
  );

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
          onPress={() => requireLogin(async () => {
            if (reactionSaving) return;
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const nextLiked = !liked;
            const previousLiked = liked;
            setLiked(nextLiked);
            setLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));
            setReactionSaving(true);
            try {
              const data = await setVideoReaction(Number(video.id), nextLiked, saved);
              setLiked(data.liked);
              setLikeCount(data.likes);
              setSaved(data.saved);
              trackEvent(nextLiked ? "like" : "like_removed", "video", video.id);
            } catch {
              setLiked(previousLiked);
              setLikeCount((c) => Math.max(0, c + (nextLiked ? -1 : 1)));
              Alert.alert("पसंद सेव ना भइल", "कृपया फेर से कोशिश करीं।");
            } finally {
              setReactionSaving(false);
            }
          })}
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
          onPress={() => {
            if (!engagementLoading) setCommentOpen(true);
          }}
        >
          <Feather name="message-circle" size={26} color="#fff" />
          <Text style={styles.actionLabel}>बतावऽ ({comments.length})</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={async () => {
            trackEvent("share", "video", video.id);
            await handleShare();
          }}
        >
          <Feather name="share-2" size={26} color="#fff" />
          <Text style={styles.actionLabel}>शेयर</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => requireLogin(async () => {
            if (reactionSaving) return;
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const nextSaved = !saved;
            const previousSaved = saved;
            setSaved(nextSaved);
            setReactionSaving(true);
            try {
              const data = await setVideoReaction(Number(video.id), liked, nextSaved);
              setSaved(data.saved);
              setLiked(data.liked);
              setLikeCount(data.likes);
              trackEvent(nextSaved ? "save" : "save_removed", "video", video.id);
            } catch {
              setSaved(previousSaved);
              Alert.alert("सेव ना भइल", "कृपया फेर से कोशिश करीं।");
            } finally {
              setReactionSaving(false);
            }
          })}
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
            {topLevelComments.map((comment) => renderComment(comment))}
          </ScrollView>

          {replyingTo && (
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderTopWidth: 1,
                borderTopColor: "rgba(255,255,255,0.08)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.55)",
                    fontSize: 11,
                  }}
                >
                  जवाब देत बानी
                </Text>
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                  numberOfLines={1}
                >
                  {replyingTo.user}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setReplyingTo(null);
                  setMentionQuery("");
                  setMentionSuggestions([]);
                }}
              >
                <Feather name="x" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {mentionSuggestions.length > 0 && (
            <View
              style={{
                marginHorizontal: 16,
                marginBottom: 6,
                borderRadius: 10,
                backgroundColor: "#242424",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                overflow: "hidden",
              }}
            >
              {mentionSuggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.id}
                  activeOpacity={0.75}
                  onPress={() => handleMentionSelect(suggestion)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    borderBottomWidth:
                      suggestion.id ===
                      mentionSuggestions[mentionSuggestions.length - 1].id
                        ? 0
                        : 1,
                    borderBottomColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(245,166,35,0.16)",
                      marginRight: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: "#F5A623",
                        fontWeight: "800",
                      }}
                    >
                      {(suggestion.user || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                    >
                      @{suggestion.user}
                    </Text>
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.45)",
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      थ्रेड में शामिल बा
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder={
                replyingTo
                  ? `${replyingTo.user} के जवाब में लिखीं...`
                  : "अपनी बात लिखीं..."
              }
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={newComment}
              onChangeText={(value) => {
                setNewComment(value);
                updateMentionSuggestions(value);
              }}
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
