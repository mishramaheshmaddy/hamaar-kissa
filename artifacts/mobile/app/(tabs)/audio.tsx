import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";
import AudioCard from "@/components/AudioCard";
import MiniPlayer from "@/components/MiniPlayer";
import { apiFetch, ApiAudioStory, ApiCategory, BASE } from "@/lib/api";
import { AudioStory } from "@/context/AudioContext";

function mapStory(s: ApiAudioStory, catName: string): AudioStory {
  return {
    id: String(s.id),
    title: s.title,
    category: catName,
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

export default function AudioScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { playStory, currentStory, isPlaying, savedStories, history } = useAudio();
  const [activeCategory, setActiveCategory] = useState<number | "all">("all");
  const [activeTab, setActiveTab] = useState<"all" | "saved" | "history">("all");

  const [stories, setStories] = useState<AudioStory[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rawStories, allCats] = await Promise.all([
          apiFetch<ApiAudioStory[]>("/api/audio-stories?published=true"),
          apiFetch<ApiCategory[]>("/api/categories"),
        ]);
        if (cancelled) return;

        const audioCats = allCats.filter((c) => c.type === "audio" || c.type === "both");
        const catMap: Record<number, string> = {};
        for (const c of allCats) catMap[c.id] = c.name;

        setCategories(audioCats);
        setStories(rawStories.map((s) => mapStory(s, s.categoryId ? (catMap[s.categoryId] ?? "other") : "other")));
      } catch (_e) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredStories = stories.filter((s) => {
    if (activeTab === "saved") return savedStories.includes(s.id);
    if (activeTab === "history") return history.includes(s.id);
    if (activeCategory === "all") return true;
    return s.categoryId === activeCategory;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>सुनल के कहानी</Text>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
          onPress={() => router.push("/search" as any)}
        >
          <Feather name="search" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(["all", "saved", "history"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tab,
              activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.mutedForeground, fontWeight: activeTab === tab ? "700" : "500" }]}>
              {tab === "all" ? "सब" : tab === "saved" ? "सेव कइल" : "सुनल"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "all" && (
        <View style={styles.categoryRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
          >
            <TouchableOpacity
              onPress={() => setActiveCategory("all")}
              style={[
                styles.categoryPill,
                {
                  backgroundColor: activeCategory === "all" ? colors.primary : colors.secondary,
                  borderColor: activeCategory === "all" ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.pillText, { color: activeCategory === "all" ? colors.primaryForeground : colors.foreground }]}>
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
                    backgroundColor: activeCategory === cat.id ? colors.primary : colors.secondary,
                    borderColor: activeCategory === cat.id ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.pillText, { color: activeCategory === cat.id ? colors.primaryForeground : colors.foreground }]}>
                  {cat.icon} {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredStories}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="headphones" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {activeTab === "saved" ? "कवनो सेव कइल कहानी नइखे" : activeTab === "history" ? "कवनो पुरान कहानी नइखे" : "कवनो कहानी ना मिलल"}
              </Text>
            </View>
          }
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
        />
      )}

      <MiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", borderBottomWidth: 1, marginHorizontal: 16, marginBottom: 4 },
  tab: { paddingVertical: 10, paddingHorizontal: 16 },
  tabText: { fontSize: 14 },
  categoryRow: { height: 56 },
  categories: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: "center" },
  categoryPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: "600" },
  list: { paddingHorizontal: 16, paddingBottom: 140 },
  row: { gap: 12, marginBottom: 12 },
  cardWrapper: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, textAlign: "center" },
});
