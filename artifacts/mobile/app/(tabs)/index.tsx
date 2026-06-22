import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";
import AudioCard from "@/components/AudioCard";
import SectionHeader from "@/components/SectionHeader";
import MiniPlayer from "@/components/MiniPlayer";
import { Image } from "expo-image";
import { apiFetch, ApiAudioStory, ApiVideo, ApiCategory, BASE } from "@/lib/api";
import { AudioStory } from "@/context/AudioContext";
import { VideoItem } from "@/data/mockData";
import { CATEGORY_ICONS as VIDEO_CATEGORY_ICONS } from "@/components/VideoCard";

const logo = require("@/assets/images/logo.png");

function mapStory(s: ApiAudioStory, catMap: Record<number, string>): AudioStory {
  return {
    id: String(s.id),
    title: s.title,
    category: s.categoryId ? (catMap[s.categoryId] ?? "other") : "other",
    categoryId: s.categoryId ?? undefined,
    categoryName: s.categoryName ?? undefined,
    duration: s.durationSeconds,
    thumbnail: s.thumbnailUrl ? `${BASE}${s.thumbnailUrl}` : "",
    narrator: s.narrator,
    description: s.description,
    audioUrl: `${BASE}${s.audioUrl}`,
  };
}

function mapVideo(v: ApiVideo, catMap: Record<number, string>): VideoItem {
  return {
    id: String(v.id),
    title: v.title,
    category: v.categoryId ? (catMap[v.categoryId] ?? "other") : "other",
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

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { playStory, currentStory, isPlaying } = useAudio();
  const [searchQuery, setSearchQuery] = useState("");

  const [allStories, setAllStories] = useState<AudioStory[]>([]);
  const [allVideos, setAllVideos] = useState<VideoItem[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rawStories, rawVideos, allCats] = await Promise.all([
          apiFetch<ApiAudioStory[]>("/api/audio-stories?published=true"),
          apiFetch<ApiVideo[]>("/api/videos?published=true"),
          apiFetch<ApiCategory[]>("/api/categories"),
        ]);
        if (cancelled) return;

        const catMap: Record<number, string> = {};
        for (const c of allCats) catMap[c.id] = c.name;

        setAllStories(rawStories.map((s) => mapStory(s, catMap)));
        setAllVideos(rawVideos.map((v) => mapVideo(v, catMap)));
        setCategories(allCats);
      } catch (_e) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const query = searchQuery.toLowerCase();
  const filteredStories = query
    ? allStories.filter((s) => s.title.toLowerCase().includes(query) || s.narrator.toLowerCase().includes(query))
    : allStories;

  const trendingStories = filteredStories.slice(0, 6);
  const newStories = [...filteredStories].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 6);
  const devotionalStories = allStories.filter((s) => s.category === "devotional");
  const horrorStories = allStories.filter((s) => s.category === "horror");
  const trendingVideos = allVideos.slice(0, 4);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
          <View style={styles.logoArea}>
            <Image source={logo} style={styles.logoImg} contentFit="contain" />
            <View>
              <Text style={[styles.greeting, { color: colors.mutedForeground }]}>राम-राम! 🙏</Text>
              <Text style={[styles.appName, { color: colors.foreground }]}>Hamaar Kissa</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.secondary }]}>
              <Feather name="bell" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            placeholder="कहानी, वीडियो खोजीं..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
        </View>

        {categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => router.push(`/category/${cat.id}` as any)}
                style={[styles.categoryPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                <Text style={[styles.categoryPillText, { color: colors.foreground }]}>
                  {cat.icon} {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {trendingStories.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <SectionHeader title="आजु के चर्चित" onSeeAll={() => router.push("/(tabs)/audio")} />
                <FlatList
                  data={trendingStories}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  renderItem={({ item }) => (
                    <AudioCard
                      story={item}
                      onPress={() => { playStory(item); router.push("/audio/player"); }}
                      isPlaying={currentStory?.id === item.id && isPlaying}
                    />
                  )}
                />
              </View>
            )}

            {trendingVideos.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <SectionHeader title="वायरल वीडियो" onSeeAll={() => router.push("/(tabs)/video")} />
                <FlatList
                  data={trendingVideos}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => router.push("/(tabs)/video")}
                      style={[styles.videoThumb, { backgroundColor: "#1C1208" }]}
                    >
                      <Text style={styles.videoThumbIcon}>
                        {VIDEO_CATEGORY_ICONS[item.category] ?? "🎬"}
                      </Text>
                      <View style={styles.videoOverlay} />
                      <View style={styles.videoInfo}>
                        <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {devotionalStories.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <SectionHeader title="भक्ति के कहानी" onSeeAll={() => router.push("/(tabs)/audio")} />
                <FlatList
                  data={devotionalStories}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  renderItem={({ item }) => (
                    <AudioCard story={item} onPress={() => { playStory(item); router.push("/audio/player"); }} isPlaying={currentStory?.id === item.id && isPlaying} />
                  )}
                />
              </View>
            )}

            {horrorStories.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <SectionHeader title="भूत-प्रेत के कहानी" onSeeAll={() => router.push("/(tabs)/audio")} />
                <FlatList
                  data={horrorStories}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  renderItem={({ item }) => (
                    <AudioCard story={item} onPress={() => { playStory(item); router.push("/audio/player"); }} isPlaying={currentStory?.id === item.id && isPlaying} />
                  )}
                />
              </View>
            )}

            {newStories.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <SectionHeader title="नया कहानी" onSeeAll={() => router.push("/(tabs)/audio")} />
                <FlatList
                  data={newStories}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  renderItem={({ item }) => (
                    <AudioCard story={item} onPress={() => { playStory(item); router.push("/audio/player"); }} isPlaying={currentStory?.id === item.id && isPlaying} />
                  )}
                />
              </View>
            )}

            {trendingStories.length === 0 && trendingVideos.length === 0 && (
              <View style={styles.empty}>
                <Feather name="inbox" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  अभी कवनो सामग्री नइखे।{"\n"}CMS से कुछ जोड़ऽ!
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <MiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 16 },
  logoArea: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoImg: { width: 48, height: 48 },
  greeting: { fontSize: 13, fontWeight: "500" },
  appName: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, borderWidth: 1, gap: 10, marginBottom: 4 },
  searchInput: { flex: 1, fontSize: 15 },
  categories: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  categoryPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  categoryPillText: { fontSize: 13, fontWeight: "600" },
  loadingBox: { paddingTop: 60, alignItems: "center" },
  horizontalList: { paddingLeft: 16, paddingRight: 4 },
  verticalList: { paddingHorizontal: 16 },
  videoThumb: { width: 160, height: 200, borderRadius: 16, marginRight: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  videoThumbIcon: { fontSize: 56 },
  videoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  videoInfo: { position: "absolute", bottom: 12, left: 10, right: 10, gap: 3 },
  videoTitle: { color: "#fff", fontSize: 13, fontWeight: "700", lineHeight: 18 },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 16 },
  emptyText: { fontSize: 15, textAlign: "center", lineHeight: 24 },
});
