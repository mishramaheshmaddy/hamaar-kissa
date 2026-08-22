import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useAudio } from "@/context/AudioContext";
import { useAuth } from "@/context/AuthContext";
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import VideoCard from "@/components/VideoCard";
import { apiFetch, ApiVideo, ApiCategory } from "@/lib/api";
import { VideoItem } from "@/data/mockData";

const { height } = Dimensions.get("window");
const CARD_HEIGHT = height;

// Fisher–Yates shuffle — used so the video feed doesn't always start with
// the same video (e.g. lowest sortOrder/id, which the API always returns
// first). Returns a new array; does not mutate the input.
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function mapVideo(v: ApiVideo, catName: string): VideoItem {
  return {
    id: String(v.id),
    title: v.title,
    category: catName,
    categoryId: v.categoryId ?? undefined,
    views: "0",
    likes: 0,
    creator: "",
    thumbnail: v.thumbnailUrl ?? "",
    duration: 0,
    description: v.description,
    youtubeId: v.youtubeId ?? undefined,
    videoUrl: v.videoUrl ?? undefined,
    sourceType: v.sourceType,
  };
}

export default function VideoScreen() {
  const { selectedVideoId } = useLocalSearchParams<{
    selectedVideoId?: string;
  }>();

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<number | "all">("all");
  const { pauseAudio } = useAudio();

  // Guest video gate:
  // A guest can view 5 unique videos. The 6th unique video requires login.
  // Repeated videos do not consume another guest slot.
  const guestSeenVideoIdsRef = useRef<Set<string>>(new Set());

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedItems, setFeedItems] = useState<VideoItem[]>([]);
  const flatListRef = useRef<FlatList<VideoItem>>(null);

  const filteredVideos = useMemo(
    () => (activeCategory === "all" ? videos : videos.filter((v) => v.categoryId === activeCategory)),
    [videos, activeCategory]
  );

  // Watching a video is a deliberate choice to switch away from listening —
  // stop any playing audio the moment this tab is focused, so the two never
  // play on top of each other. Audio is left untouched everywhere else
  // (Home, Profile, Categories, etc.) via the persistent mini-player.
  //
  // We also reshuffle the feed and jump back to the top every time the user
  // navigates INTO this tab, so it doesn't always open on the same video
  // (previously always the lowest sortOrder/id, e.g. Pashupatinath Mandir) —
  // matches the "always fresh" feel of Reels/TikTok.
  useFocusEffect(
    useCallback(() => {
      pauseAudio();

      return () => {
        setActiveIndex(-1);
      };
    }, [pauseAudio])
  );

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  const [refreshing, setRefreshing] = useState(false);
  const lastRefreshedAtRef = useRef<number>(0);
  const STALE_AFTER_MS = 30_000;

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setRefreshing(true);
    try {
      const [rawVideos, allCats] = await Promise.all([
        apiFetch<ApiVideo[]>("/api/videos?published=true"),
        apiFetch<ApiCategory[]>("/api/categories"),
      ]);

      const videoCats = allCats.filter((c) => c.active && (c.type === "video" || c.type === "both"));
      const catMap: Record<number, string> = {};
      for (const c of allCats) catMap[c.id] = c.name;

      setCategories(videoCats);
      setVideos(rawVideos.map((v) => mapVideo(v, v.categoryId ? (catMap[v.categoryId] ?? "other") : "other")));
      lastRefreshedAtRef.current = Date.now();
    } catch (_e) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onPullToRefresh = useCallback(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active" && Date.now() - lastRefreshedAtRef.current > STALE_AFTER_MS) {
        loadData({ silent: true });
      }
    };
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastRefreshedAtRef.current > STALE_AFTER_MS) {
        loadData({ silent: true });
      }
    }, [loadData])
  );

  // The actual list rendered in the FlatList. Starts as a shuffled copy of
  // filteredVideos (see the focus effect above); once the user nears the
  // end, we append another random batch drawn from the same filtered set
  // (with repeats) so the feed never visibly "runs out" — same idea as
  // Reels/TikTok once you've seen everything once.
  const MAX_FEED_LENGTH = 300; // sane cap so memory doesn't grow forever in one long session

  useEffect(() => {
    if (filteredVideos.length === 0) {
      setFeedItems([]);
      return;
    }

    const selectedId = selectedVideoId
      ? String(selectedVideoId)
      : null;

    if (selectedId) {
      const selected = filteredVideos.find(
        (video) => String(video.id) === selectedId
      );

      if (selected) {
        const remaining = filteredVideos.filter(
          (video) => String(video.id) !== selectedId
        );

        setFeedItems([selected, ...shuffleArray(remaining)]);
        setActiveIndex(0);

        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({
            offset: 0,
            animated: false,
          });
        });

        return;
      }
    }

    setFeedItems(shuffleArray(filteredVideos));
    setActiveIndex(0);
  }, [filteredVideos, selectedVideoId]);

  const appendRandomBatch = useCallback(() => {
    if (filteredVideos.length === 0) return;
    setFeedItems((prev) => {
      if (prev.length >= MAX_FEED_LENGTH) return prev;
      const batch: VideoItem[] = [];
      for (let i = 0; i < 10; i++) {
        batch.push(filteredVideos[Math.floor(Math.random() * filteredVideos.length)]);
      }
      return [...prev, ...batch];
    });
  }, [filteredVideos]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0 || viewableItems[0].index === null) {
        return;
      }

      const nextIndex = viewableItems[0].index;
      const nextVideo = feedItems[nextIndex];

      if (!nextVideo) {
        return;
      }

      const videoId = String(nextVideo.id);

      if (!user && !guestSeenVideoIdsRef.current.has(videoId)) {
        if (guestSeenVideoIdsRef.current.size >= 5) {
          Alert.alert(
            "लॉगिन करीं 🙏",
            "अगला वीडियो देखें खातिर लॉगिन करीं",
            [
              {
                text: "बाद में",
                style: "cancel",
              },
              {
                text: "लॉगिन करीं",
                onPress: () => router.push("/login"),
              },
            ]
          );

          requestAnimationFrame(() => {
            const safeIndex = Math.max(0, activeIndex);
            flatListRef.current?.scrollToIndex({
              index: safeIndex,
              animated: true,
            });
          });

          return;
        }

        guestSeenVideoIdsRef.current.add(videoId);
      }

      setActiveIndex(nextIndex);
    },
    [feedItems, user, router, activeIndex]
  );

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <View style={[styles.categoryBar, { top: topPadding + 8 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          <TouchableOpacity
            onPress={() => setActiveCategory("all")}
            style={[
              styles.categoryPill,
              {
                backgroundColor: activeCategory === "all" ? "rgba(232,83,10,0.9)" : "rgba(0,0,0,0.5)",
                borderColor: activeCategory === "all" ? "#E8530A" : "rgba(255,255,255,0.2)",
              },
            ]}
          >
            <Text style={[styles.pillText, { color: "#fff", fontWeight: activeCategory === "all" ? "700" : "500" }]}>
              सब
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setActiveCategory(cat.id)}
              style={[
                styles.categoryPill,
                {
                  backgroundColor: activeCategory === cat.id ? "rgba(232,83,10,0.9)" : "rgba(0,0,0,0.5)",
                  borderColor: activeCategory === cat.id ? "#E8530A" : "rgba(255,255,255,0.2)",
                },
              ]}
            >
              <Text style={styles.pillIcon}>{cat.icon} </Text>
              <Text style={[styles.pillText, { color: activeCategory === cat.id ? "#fff" : "rgba(255,255,255,0.8)", fontWeight: activeCategory === cat.id ? "700" : "500" }]}>
                {cat.label || cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#E8530A" />
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 16 }}>कवनो वीडियो ना मिलल</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={feedItems}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={CARD_HEIGHT}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          getItemLayout={(_, index) => ({ length: CARD_HEIGHT, offset: CARD_HEIGHT * index, index })}
          onEndReached={appendRandomBatch}
          onEndReachedThreshold={2}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onPullToRefresh} tintColor="#fff" colors={["#fff"]} />
          }
          renderItem={({ item, index }) => (
            <VideoCard video={item} isActive={index === activeIndex} />
          )}
          contentContainerStyle={{ paddingBottom: bottomPadding + 84 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  categoryBar: { position: "absolute", left: 0, right: 0, zIndex: 10 },
  categories: { paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  categoryPill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  pillIcon: { fontSize: 13 },
  pillText: { fontSize: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
