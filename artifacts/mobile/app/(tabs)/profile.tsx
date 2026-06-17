import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAudio, AudioStory } from "@/context/AudioContext";
import { useColors } from "@/hooks/useColors";
import AudioCard from "@/components/AudioCard";
import MiniPlayer from "@/components/MiniPlayer";
import { apiFetch, ApiAudioStory, ApiCategory, BASE } from "@/lib/api";
import { useRouter } from "expo-router";

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

const DUMMY_USER = {
  name: "महेश कुमार",
  username: "@mahesh_bhojpuri",
  memberSince: "मई 2024",
  location: "गोरखपुर, उत्तर प्रदेश",
};

const SETTINGS = [
  {
    icon: "🔔",
    label: "सूचना",
    subtitle: "नई कहानियों और वीडियो की सूचना पाएं",
    route: "/settings/notifications",
  },
  {
    icon: "⬇️",
    label: "डाउनलोड्स",
    subtitle: "ऑफलाइन सुने और देखें",
    route: "/settings/downloads",
  },
  {
    icon: "📶",
    label: "डेटा सेटिंग्स",
    subtitle: "स्ट्रीमिंग क्वालिटी नियंत्रित करें",
    route: "/settings/data",
  },
  {
    icon: "🌙",
    label: "स्लीप टाइमर",
    subtitle: "सुनते समय टाइम सेट करें",
    route: "/settings/sleep-timer",
  },
  {
    icon: "❓",
    label: "मदद और सहायता",
    subtitle: "सवाल-जवाब और सहायता",
    route: "/settings/help",
  },
  {
    icon: "ℹ️",
    label: "Hamaar Kissa के बारे में",
    subtitle: "संस्करण 1.0.0",
    route: "/settings/about",
  },
];

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { savedStories, likedStories, history, playStory, currentStory, isPlaying, sleepTimerMinutes } = useAudio();
  const [activeTab, setActiveTab] = useState<"saved" | "liked" | "history">("saved");
  const [allStories, setAllStories] = useState<AudioStory[]>([]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    (async () => {
      try {
        const [rawStories, allCats] = await Promise.all([
          apiFetch<ApiAudioStory[]>("/api/audio-stories?published=true"),
          apiFetch<ApiCategory[]>("/api/categories"),
        ]);
        const catMap: Record<number, string> = {};
        for (const c of allCats) catMap[c.id] = c.name;
        setAllStories(rawStories.map((s) => mapStory(s, catMap)));
      } catch {}
    })();
  }, []);

  const savedItems = allStories.filter((s) => savedStories.includes(s.id));
  const likedItems = allStories.filter((s) => likedStories.includes(s.id));
  const historyItems = allStories.filter((s) => history.includes(s.id));

  const activeItems =
    activeTab === "saved" ? savedItems :
    activeTab === "liked" ? likedItems :
    historyItems;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>

        {/* Header */}
        <View style={[styles.profileHeader, { paddingTop: topPadding + 12, backgroundColor: colors.card }]}>
          <View style={styles.logoRow}>
            <Image source={logo} style={styles.logoImg} contentFit="contain" />
          </View>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>म</Text>
          </View>
          <Text style={[styles.name, { color: colors.foreground }]}>{DUMMY_USER.name}</Text>
          <Text style={[styles.username, { color: colors.primary }]}>{DUMMY_USER.username}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>📍 {DUMMY_USER.location}</Text>
            <Text style={[styles.metaDot, { color: colors.mutedForeground }]}>•</Text>
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>🗓 {DUMMY_USER.memberSince} से</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{history.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>सुनल</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{savedStories.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>सेव</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{likedStories.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>पसंद</Text>
            </View>
          </View>

          {/* Upload CTA */}
          <TouchableOpacity
            style={[styles.uploadCTA, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/upload" as any);
            }}
            activeOpacity={0.85}
          >
            <Text style={{ fontSize: 18 }}>🎙️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.uploadCTATitle}>अपनी कहानी अपलोड करीं</Text>
              <Text style={styles.uploadCTADesc}>भोजपुरी ऑडियो स्टोरी शेयर करीं</Text>
            </View>
            <Feather name="upload" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
          {(["saved", "liked", "history"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.mutedForeground, fontWeight: activeTab === tab ? "700" : "500" }]}>
                {tab === "saved" ? "🔖 सेव" : tab === "liked" ? "❤️ पसंद" : "🕐 पुरान"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content List */}
        <View style={styles.content}>
          {activeItems.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48 }}>
                {activeTab === "saved" ? "🔖" : activeTab === "liked" ? "❤️" : "🕐"}
              </Text>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {activeTab === "saved" ? "कवनो सेव नइखे" : activeTab === "liked" ? "कवनो पसंद नइखे" : "कवनो इतिहास नइखे"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                कहानी सुनल शुरू करीं
              </Text>
              <TouchableOpacity
                style={[styles.exploreBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/(tabs)/audio")}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>कहानी देखीं</Text>
              </TouchableOpacity>
            </View>
          ) : (
            activeItems.map((item) => (
              <AudioCard
                key={item.id}
                story={item}
                compact
                onPress={() => { playStory(item); router.push("/audio/player"); }}
                isPlaying={currentStory?.id === item.id && isPlaying}
              />
            ))
          )}
        </View>

        {/* Settings */}
        <View style={[styles.sectionHeader, { marginHorizontal: 16, marginTop: 8, marginBottom: 8 }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>सेटिंग्स</Text>
        </View>

        <View style={[styles.settingsSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {SETTINGS.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.settingsRow, i < SETTINGS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(item.route as any);
              }}
            >
              <View style={[styles.settingsIcon, { backgroundColor: colors.secondary }]}>
                <Text style={{ fontSize: 18 }}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingsLabel, { color: colors.foreground }]}>{item.label}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  {item.label === "स्लीप टाइमर" && sleepTimerMinutes
                    ? `${sleepTimerMinutes} मिनट सेट है ✓`
                    : item.subtitle}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: "#E74C3C" }]}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
        >
          <Text style={{ color: "#E74C3C", fontWeight: "700", fontSize: 15 }}>🚪 साइन आउट</Text>
        </TouchableOpacity>

        <Text style={[styles.versionText, { color: colors.mutedForeground }]}>
          Hamaar Kissa v1.0.0 • हमार भाषा, हमार कहनी
        </Text>
      </ScrollView>
      <MiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileHeader: { alignItems: "center", paddingHorizontal: 16, paddingBottom: 20 },
  logoRow: { marginBottom: 12, marginTop: 4 },
  logoImg: { width: 80, height: 80 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: 12, borderWidth: 3, borderColor: "rgba(255,255,255,0.3)" },
  avatarText: { fontSize: 36, fontWeight: "900", color: "#fff" },
  name: { fontSize: 22, fontWeight: "800" },
  username: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  metaText: { fontSize: 12 },
  metaDot: { fontSize: 12 },
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: 20, gap: 24 },
  statItem: { alignItems: "center", gap: 2 },
  statNumber: { fontSize: 24, fontWeight: "900" },
  statLabel: { fontSize: 12 },
  statDivider: { width: 1, height: 32 },
  uploadCTA: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 20,
    width: "100%",
  },
  uploadCTATitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  uploadCTADesc: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 1 },
  tabs: { flexDirection: "row", borderBottomWidth: 1, marginHorizontal: 16, marginTop: 8 },
  tab: { paddingVertical: 10, paddingHorizontal: 12, flex: 1, alignItems: "center" },
  tabText: { fontSize: 13 },
  content: { padding: 16 },
  empty: { alignItems: "center", paddingTop: 40, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14 },
  exploreBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  sectionHeader: {},
  sectionLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  settingsSection: { marginHorizontal: 16, borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  settingsRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  settingsIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  settingsLabel: { fontSize: 15, fontWeight: "600" },
  logoutBtn: { marginHorizontal: 16, marginTop: 16, borderRadius: 14, borderWidth: 1.5, paddingVertical: 14, alignItems: "center" },
  versionText: { textAlign: "center", fontSize: 12, marginTop: 16, marginBottom: 8 },
});
