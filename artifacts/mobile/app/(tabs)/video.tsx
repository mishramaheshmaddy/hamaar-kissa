import React, { useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
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
  const [videos, setVideos] = useState<VideoItem[]>([]);
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

        const catMap: Record<number, string> = {};
        for (const c of allCats) catMap[c.id] = c.name;
        setVideos(rawVideos.map((v) => mapVideo(v, v.categoryId ? (catMap[v.categoryId] ?? "other") : "other")));
      } catch (_e) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#E8530A" />
        </View>
      ) : filteredVideos.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 16 }}>कवनो वीडियो ना मिलल</Text>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={CARD_HEIGHT}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          getItemLayout={(_, index) => ({ length: CARD_HEIGHT, offset: CARD_HEIGHT * index, index })}
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

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
