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
import { useAuth } from "@/context/AuthContext";
import { useDownloads } from "@/hooks/useDownloads";

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

interface HomeSectionItem {
  id: number;
  title: string;
  subtitle: string;
  type: string;
  contentSource: string;
  categoryId: number | null;
  sortOrder: number;
  isActive: boolean;
  items: Array<{
    id: number;
    title: string;
    categoryName?: string | null;
    narrator?: string;
    durationSeconds?: number;
    thumbnailUrl?: string | null;
    audioUrl?: string;
    videoUrl?: string;
    type: string;
  }>;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    playStory,
    currentStory,
    isPlaying,
    history,
  } = useAudio();
  const { user } = useAuth();
  const { downloads } = useDownloads();
  const [searchQuery, setSearchQuery] = useState("");

  const [sections, setSections] = useState<HomeSectionItem[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [homeSections, allCats] = await Promise.all([
          apiFetch<HomeSectionItem[]>("/api/home-sections"),
          apiFetch<ApiCategory[]>("/api/categories"),
        ]);
        if (cancelled) return;
        setSections(homeSections);
        setCategories(allCats);
      } catch (_e) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);


  const continueListening = sections
    .flatMap(s => s.items || [])
    .filter(i => i.type === "audio")
    .filter(i => history.includes(String(i.id)))
    .sort((a,b)=>history.indexOf(String(a.id))-history.indexOf(String(b.id)))
    .slice(0,5);



  const recentDownloads = [...downloads]
    .sort(
      (a,b)=>
        new Date(b.downloadedAt).getTime()-
        new Date(a.downloadedAt).getTime()
    )
    .slice(0,5);



  const recentlyPlayed = sections
    .flatMap(s => s.items || [])
    .filter(i => i.type === "audio")
    .filter(i => history.includes(String(i.id)))
    .slice(0,10);


  const renderSection = (section: HomeSectionItem) => {
    const items = section.items || [];
    if (items.length === 0) return null;

    if (section.type === "video" || (section.type === "both" && items[0]?.type === "video")) {
      return (
        <View style={{ marginTop: 24 }}>
          <SectionHeader title={section.title} onSeeAll={() => router.push("/(tabs)/video")} />
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/video")}
                style={[styles.videoThumb, { backgroundColor: "#1C1208" }]}
              >
                <Text style={styles.videoThumbIcon}>
                  {VIDEO_CATEGORY_ICONS[item.categoryName ?? "other"] ?? "🎬"}
                </Text>
                <View style={styles.videoOverlay} />
                <View style={styles.videoInfo}>
                  <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      );
    }

    return (
      <View style={{ marginTop: 24 }}>
        <SectionHeader title={section.title} onSeeAll={() => router.push("/(tabs)/audio")} />
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          renderItem={({ item }) => {
            const story: AudioStory = {
              id: String(item.id),
              title: item.title,
              category: item.categoryName ?? "other",
              duration: item.durationSeconds ?? 0,
              thumbnail: item.thumbnailUrl ? (item.thumbnailUrl.startsWith("/") ? `${BASE}${item.thumbnailUrl}` : item.thumbnailUrl) : "",
              narrator: item.narrator ?? "",
              description: "",
              audioUrl: item.audioUrl ? (item.audioUrl.startsWith("/") ? `${BASE}${item.audioUrl}` : item.audioUrl) : undefined,
            };
            return (
              <AudioCard
                story={story}
                onPress={() => { playStory(story); router.push("/audio/player"); }}
                isPlaying={currentStory?.id === story.id && isPlaying}
              />
            );
          }}
        />
      </View>
    );
  };

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
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
              onPress={() => {
                if (!user) router.push("/login" as any);
                else router.push("/settings/notifications" as any);
              }}
            >
              <Feather name="bell" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/search" as any)}
          activeOpacity={0.8}
          style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <Text
            style={[styles.searchInput, { color: colors.mutedForeground }]}
          >
            कहानी, वीडियो खोजीं...
          </Text>
        </TouchableOpacity>

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

            {continueListening.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <SectionHeader
                  title="फिन से सुनीं"
                  onSeeAll={() => router.push("/(tabs)/audio")}
                />

                <FlatList
                  data={continueListening}
                  horizontal
                  keyExtractor={(item) => String(item.id)}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <AudioCard
                      story={{
                        id: String(item.id),
                        title: item.title,
                        category: item.categoryName || "",
                        categoryName: item.categoryName || "",
                        narrator: item.narrator || "",
                        duration: item.durationSeconds || 0,
                        thumbnail: item.thumbnailUrl || "",
                        audioUrl: item.audioUrl || "",
                        description: "",
                      }}
                      onPress={() => {
                        playStory({
                          id: String(item.id),
                          title: item.title,
                          category: item.categoryName || "",
                          categoryName: item.categoryName || "",
                          narrator: item.narrator || "",
                          duration: item.durationSeconds || 0,
                          thumbnail: item.thumbnailUrl || "",
                          audioUrl: item.audioUrl || "",
                          description: "",
                        });
                        router.push("/audio/player");
                      }}
                      isPlaying={
                        currentStory?.id === String(item.id) &&
                        isPlaying
                      }
                    />
                  )}
                />
              </View>
            )}

            {recentDownloads.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <SectionHeader
                  title="हाले डाउनलोड कइल"
                  onSeeAll={() => router.push("/settings/downloads")}
                />

                <FlatList
                  data={recentDownloads}
                  horizontal
                  keyExtractor={(item) => item.storyId}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <AudioCard
                      story={{
                        id: item.storyId,
                        title: item.title,
                        category: item.category,
                        categoryName: item.category,
                        narrator: item.narrator,
                        duration: item.duration,
                        thumbnail: item.thumbnail,
                        audioUrl: "",
                        description: "",
                      }}
                      onPress={() => {
                        playStory({
                          id: item.storyId,
                          title: item.title,
                          category: item.category,
                          categoryName: item.category,
                          narrator: item.narrator,
                          duration: item.duration,
                          thumbnail: item.thumbnail,
                          audioUrl: "",
                          description: "",
                        });
                        router.push("/audio/player");
                      }}
                      isPlaying={
                        currentStory?.id === item.storyId &&
                        isPlaying
                      }
                    />
                  )}
                />
              </View>
            )}

            {recentlyPlayed.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <SectionHeader
                  title="हाले सुनल गइल"
                  onSeeAll={() => router.push("/(tabs)/audio")}
                />

                <FlatList
                  data={recentlyPlayed}
                  horizontal
                  keyExtractor={(item) => String(item.id)}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <AudioCard
                      story={{
                        id: String(item.id),
                        title: item.title,
                        category: item.categoryName || "",
                        categoryName: item.categoryName || "",
                        narrator: item.narrator || "",
                        duration: item.durationSeconds || 0,
                        thumbnail: item.thumbnailUrl || "",
                        audioUrl: item.audioUrl || "",
                        description: "",
                      }}
                      onPress={() => {
                        playStory({
                          id: String(item.id),
                          title: item.title,
                          category: item.categoryName || "",
                          categoryName: item.categoryName || "",
                          narrator: item.narrator || "",
                          duration: item.durationSeconds || 0,
                          thumbnail: item.thumbnailUrl || "",
                          audioUrl: item.audioUrl || "",
                          description: "",
                        });
                        router.push("/audio/player");
                      }}
                      isPlaying={
                        currentStory?.id === String(item.id) &&
                        isPlaying
                      }
                    />
                  )}
                />
              </View>
            )}

            {sections.map((section) => (
              <View key={section.id}>{renderSection(section)}</View>
            ))}
            {sections.length === 0 && (
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
