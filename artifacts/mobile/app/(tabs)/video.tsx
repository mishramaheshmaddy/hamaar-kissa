import React, { useState, useCallback, useEffect } from "react";
import { useFocusEffect } from "expo-router";
import { useAudio } from "@/context/AudioContext";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
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
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<number | "all">("all");
  const { pauseAudio } = useAudio();

  // Watching a video is a deliberate choice to switch away from listening —
  // stop any playing audio the moment this tab is focused, so the two never
  // play on top of each other. Audio is left untouched everywhere else
  // (Home, Profile, Categories, etc.) via the persistent mini-player.
  useFocusEffect(
    useCallback(() => {
      pauseAudio();

      return () => {
        // Leaving Video tab
        setActiveIndex(-1);
      };
    }, [pauseAudio])
  );

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rawVideos, allCats] = await Promise.all([
          apiFetch<ApiVideo[]>("/api/videos?published=true"),
          apiFetch<ApiCategory[]>("/api/categories"),
        ]);
        if (cancelled) return;

        const videoCats = allCats.filter((c) => c.type === "video" || c.type === "both");
        const catMap: Record<number, string> = {};
        for (const c of allCats) catMap[c.id] = c.name;

        setCategories(videoCats);
        setVideos(rawVideos.map((v) => mapVideo(v, v.categoryId ? (catMap[v.categoryId] ?? "other") : "other")));
      } catch (_e) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredVideos = activeCategory === "all"
    ? videos
    : videos.filter((v) => v.categoryId === activeCategory);

  // The actual list rendered in the FlatList. Starts as a straight copy of
  // filteredVideos; once the user nears the end, we append another random
  // batch drawn from the same filtered set (with repeats) so the feed
  // never visibly "runs out" — same idea as Reels/TikTok once you've seen
  // everything once.
  const [feedItems, setFeedItems] = useState<VideoItem[]>([]);
  const MAX_FEED_LENGTH = 300; // sane cap so memory doesn't grow forever in one long session

  useEffect(() => {
    setFeedItems(filteredVideos);
    setActiveIndex(0);
  }, [activeCategory, videos.length]);

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
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    []
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
              <Text style={[styles.pillText, { color: activeCategory === cat.id ? "#fff" : "rgba(255,255,255,0.8)", fontWeight: activeCategory === cat.id ? "700" : "500" }]}>
                {cat.icon} {cat.label}
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
  categoryPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
