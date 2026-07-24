import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudio } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";
import AudioCard from "@/components/AudioCard";
import SectionHeader from "@/components/SectionHeader";
import MiniPlayer from "@/components/MiniPlayer";
import { Image } from "expo-image";
import { apiFetch, ApiAudioStory, ApiCategory, BASE } from "@/lib/api";
import { AudioStory } from "@/context/AudioContext";
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

// Fisher-Yates shuffle — used to populate the "सब" (all content) section
// haphazardly, so it doesn't just repeat the same order as the manual
// home sections above it.
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ALL_SECTION_PAGE_SIZE = 8;

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

  const [searchQuery, setSearchQuery] = useState("");

  const [sections, setSections] = useState<HomeSectionItem[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Everything published, used to populate the "सब" section at the very
  // bottom of the feed once the manually-curated sections run out.
  // Audio-only by design — "सब" is the all-stories feed, video content
  // lives in its own tab/section.
  const [allAudioRaw, setAllAudioRaw] = useState<ApiAudioStory[]>([]);
  const [allVisibleCount, setAllVisibleCount] = useState(ALL_SECTION_PAGE_SIZE);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const { width: windowWidth } = useWindowDimensions();
  // Two equal columns inside the 16px screen padding with a 12px gutter
  // between them — computed responsively so it doesn't overflow to a
  // single column on narrower ~360dp Android screens.
  const GRID_GAP = 12;
  const gridCardWidth = (windowWidth - 16 * 2 - GRID_GAP) / 2;

  const [refreshing, setRefreshing] = useState(false);
  // Tracks when data was last (successfully) loaded, so we don't
  // needlessly refetch on every single tab focus — only when it's been
  // a while, matching the "stale after 30s" requirement.
  const lastRefreshedAtRef = useRef<number>(0);
  const STALE_AFTER_MS = 30_000;

  const loadHomeData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setRefreshing(true);
    try {
      const [homeSections, allCats, audioStories] = await Promise.all([
        apiFetch<HomeSectionItem[]>("/api/home-sections"),
        apiFetch<ApiCategory[]>("/api/categories"),
        apiFetch<ApiAudioStory[]>("/api/audio-stories?published=true"),
      ]);
      setSections(homeSections);
      setCategories(allCats);
      setAllAudioRaw(audioStories);
      lastRefreshedAtRef.current = Date.now();
    } catch (_e) {
      // Keep whatever was already on screen rather than clearing it on a
      // failed refresh — a blank home screen on a flaky connection is
      // worse than slightly stale content.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load on mount.
  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  // Pull-to-refresh — always refetches immediately regardless of how
  // recently the last refresh was, since this is an explicit user action.
  const onPullToRefresh = useCallback(() => {
    loadHomeData();
  }, [loadHomeData]);

  // Refresh when the app comes back from the background (e.g. user
  // switched apps to check something, then returned) — same 30s
  // staleness threshold as tab-focus, so briefly backgrounding the app
  // (a notification swipe-down, etc.) doesn't trigger a refetch every time.
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active" && Date.now() - lastRefreshedAtRef.current > STALE_AFTER_MS) {
        loadHomeData({ silent: true });
      }
    };
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [loadHomeData]);

  // Refresh when returning to the Home tab, but only if it's been more
  // than 30s since the last refresh — avoids refetching on every tab
  // switch while still keeping content reasonably current.
  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastRefreshedAtRef.current > STALE_AFTER_MS) {
        loadHomeData({ silent: true });
      }
    }, [loadHomeData])
  );


  const catMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const c of categories) m[c.id] = c.name;
    return m;
  }, [categories]);

  // Shuffled once per data load (not on every render, so the order doesn't
  // jump around as the user taps "सब देखी...").
  const allCards = useMemo<AudioStory[]>(() => {
    const audioCards = allAudioRaw.map((s) => mapStory(s, catMap));
    return shuffleArray(audioCards);
  }, [allAudioRaw, catMap]);


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
            renderItem={({ item }) => {
              const thumb = item.thumbnailUrl
                ? (item.thumbnailUrl.startsWith("/") ? `${BASE}${item.thumbnailUrl}` : item.thumbnailUrl)
                : "";
              return (
                <TouchableOpacity
                  onPress={() => router.push(`/video/${item.id}` as any)}
                  style={[styles.videoThumb, { backgroundColor: "#1C1208" }]}
                >
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                  ) : (
                    <Text style={styles.videoThumbIcon}>
                      {VIDEO_CATEGORY_ICONS[item.categoryName ?? "other"] ?? "🎬"}
                    </Text>
                  )}
                  <View style={styles.videoOverlay} />
                  <View style={styles.videoInfo}>
                    <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullToRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
          <View style={styles.logoArea}>
            <Image source={logo} style={styles.logoImg} contentFit="contain" />
            <Text style={[styles.appName, { color: colors.foreground }]}>
              {user?.name?.trim() ? `${user.name.trim().split(" ")[0]} जी 🙏` : "Hamaar Kissa"}
            </Text>
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
{sections.map((section) => (
              <View key={section.id}>{renderSection(section)}</View>
            ))}

            {allCards.length > 0 && (
              <View style={{ marginTop: 28 }}>
                <SectionHeader title="सब 🎉" />

                <View style={[styles.allGrid, { paddingHorizontal: 16, gap: GRID_GAP }]}>
                  {allCards.slice(0, allVisibleCount).map((story) => (
                    <AudioCard
                      key={story.id}
                      story={story}
                      onPress={() => { playStory(story); router.push("/audio/player"); }}
                      isPlaying={currentStory?.id === story.id && isPlaying}
                      style={{ width: gridCardWidth, marginRight: 0 }}
                    />
                  ))}
                </View>

                {allVisibleCount < allCards.length && (
                  <TouchableOpacity
                    onPress={() => setAllVisibleCount((c) => c + ALL_SECTION_PAGE_SIZE)}
                    activeOpacity={0.85}
                    style={[styles.seeAllBtn, { backgroundColor: colors.secondary, borderColor: colors.border, marginHorizontal: 16 }]}
                  >
                    <Text style={[styles.seeAllBtnText, { color: colors.primary }]}>सब देखी...</Text>
                    <Feather name="chevron-down" size={16} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {sections.length === 0 && allCards.length === 0 && (
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
  // Plain flexWrap grid (not a nested FlatList) so it naturally lays out
  // however many cards fit the screen width, and doesn't fight the outer
  // ScrollView for vertical scroll gestures.
  allGrid: { flexDirection: "row", flexWrap: "wrap" },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  seeAllBtnText: { fontSize: 14, fontWeight: "700" },
});
