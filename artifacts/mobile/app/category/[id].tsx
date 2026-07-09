import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudio, AudioStory } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";
import AudioCard from "@/components/AudioCard";
import MiniPlayer from "@/components/MiniPlayer";
import { apiFetch, ApiAudioStory, ApiCategory, BASE } from "@/lib/api";
import { CATEGORY_GRADIENTS } from "@/components/CategoryColors";

function mapStory(s: ApiAudioStory, catMap: Record<number, string>): AudioStory {
  return {
    id: String(s.id),
    title: s.title,
    category: s.categoryId ? (catMap[s.categoryId] ?? "other") : "other",
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

export default function CategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { playStory, currentStory, isPlaying } = useAudio();

  const [category, setCategory] = useState<ApiCategory | null>(null);
  const [stories, setStories] = useState<AudioStory[]>([]);
  const [loading, setLoading] = useState(true);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [rawStories, allCats] = await Promise.all([
          apiFetch<ApiAudioStory[]>("/api/audio-stories?published=true"),
          apiFetch<ApiCategory[]>("/api/categories"),
        ]);
        if (cancelled) return;

        const catMap: Record<number, string> = {};
        for (const c of allCats) catMap[c.id] = c.name;

        const numId = Number(id);
        const cat = allCats.find((c) => c.id === numId) ?? null;
        setCategory(cat);

        // Audio-only: this screen is reached from "सब किसम" (all categories),
        // and videos are intentionally excluded here — video content is only
        // ever browsed via the Video tab's own category pills.
        const filteredStories = rawStories
          .filter((s) => s.categoryId === numId)
          .map((s) => mapStory(s, catMap));
        setStories(filteredStories);
      } catch (_e) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const gradient: [string, string] =
    category ? (CATEGORY_GRADIENTS[category.name] ?? ["#E8530A", "#BF360C"]) : ["#E8530A", "#BF360C"];

  const totalCount = stories.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8, backgroundColor: gradient[1] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerIcon}>{category?.icon ?? "🎙️"}</Text>
          <Text style={styles.headerTitle}>{category?.label ?? "..."}</Text>
          <Text style={styles.headerSubtitle}>
            {loading ? "..." : `${totalCount} ${totalCount === 1 ? "कहानी" : "कहानी"}`}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : totalCount === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 52 }}>🎙️</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            कवनो सामग्री नइखे
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            CMS से इस किसिम में कहानी जोड़ीं
          </Text>
          <TouchableOpacity
            style={[styles.backBtnPill, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>वापस जाईं</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(item) => `story-${item.id}`}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <AudioCard
                story={item}
                onPress={() => {
                  playStory(item);
                  router.push("/audio/player");
                }}
                isPlaying={currentStory?.id === item.id && isPlaying}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                कवनो कहानी नइखे
              </Text>
            </View>
          }
        />
      )}

      <MiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    alignSelf: "flex-start",
  },
  headerContent: { alignItems: "center", gap: 6 },
  headerIcon: { fontSize: 52, marginBottom: 4 },
  headerTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  headerSubtitle: { color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: "600" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  backBtnPill: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 140 },
  row: { gap: 12, marginBottom: 12 },
  cardWrapper: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  videoCard: { width: 160, height: 200, borderRadius: 16, marginRight: 12, padding: 12, overflow: "hidden" },
  videoCardIcon: { fontSize: 48, marginBottom: 8 },
  videoCardTitle: { color: "#fff", fontSize: 13, fontWeight: "700" },
  youtubeBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  youtubeBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 40 },
});
