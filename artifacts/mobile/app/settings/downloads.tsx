import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useDownloads } from "@/hooks/useDownloads";
import { useAudio } from "@/context/AudioContext";
import { BASE } from "@/lib/api";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + ":" + s.toString().padStart(2, "0");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("hi-IN");
}

export default function DownloadsScreen() {

  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState<
    "latest" | "oldest" | "az"
  >("latest");

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { downloads, loading, totalSize, removeDownload, clearAll } = useDownloads();


  const deleteAllDownloads = () => {
    Alert.alert(
      "डाउनलोड हटाईं",
      "सभे डाउनलोड हटावल जाव?",
      [
        { text: "रद्द", style: "cancel" },
        {
          text: "हटाईं",
          style: "destructive",
          onPress: async () => {
            for (const item of downloads) {
              try {
                await removeDownload(item.storyId);
              } catch {}
            }
          },
        },
      ]
    );
  };

  const filteredDownloads = [...downloads]
    .filter(d =>
      d.title.toLowerCase().includes(
        searchQuery.toLowerCase()
      )
    )
    .sort((a,b)=>{
      if(sortBy==="az"){
        return a.title.localeCompare(b.title);
      }

      if(sortBy==="oldest"){
        return (
          new Date(a.downloadedAt).getTime()-
          new Date(b.downloadedAt).getTime()
        );
      }

      return (
        new Date(b.downloadedAt).getTime()-
        new Date(a.downloadedAt).getTime()
      );
    });


  const { playStory } = useAudio();

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40 }}>
          Downloads only available on mobile.
        </Text>
      </View>
    );
  }

  const handleDelete = (storyId: string, title: string) => {
    Alert.alert(
      "डिलीट करीं?",
      title + " का डाउनलोड हटा दिया जाएगा।",
      [
        { text: "नाहीं", style: "cancel" },
        { text: "हाँ", style: "destructive", onPress: () => removeDownload(storyId) },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      "सब डिलीट करीं?",
      "सभी डाउनलोड हट जाएंगे।",
      [
        { text: "नाहीं", style: "cancel" },
        { text: "हाँ", style: "destructive", onPress: clearAll },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>⬇️ डाउनलोड्स</Text>
        {downloads.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={{ color: "#E74C3C", fontSize: 13, fontWeight: "600" }}>सब हटाईं</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Storage Used */}
        <View style={[styles.storageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.storageRow}>
            <Text style={{ fontSize: 20 }}>💾</Text>
            <Text style={[styles.storageLabel, { color: colors.foreground }]}>स्टोरेज उपयोग</Text>
          </View>
          <Text style={[styles.storageSize, { color: colors.primary }]}>
            {formatSize(totalSize)}
          </Text>
          <Text style={[styles.storageCount, { color: colors.mutedForeground }]}>
            {downloads.length} कहानी डाउनलोड
          </Text>
        </View>

        {/* Downloads List */}
        {loading ? (
          <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 40 }}>लोड हो रहल बा...</Text>
        ) : downloads.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 64 }}>📥</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>कवनो डाउनलोड नइखे</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              ऑनलाइन सुनीं और ऑफलाइन के लिए डाउनलोड करीं।
            </Text>
            <TouchableOpacity
              style={[styles.exploreBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/(tabs)/audio")}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>कहानी खोजीं</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
            {downloads.map((item) => (
              <View key={item.storyId} style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.itemLeft}
                  onPress={() => {
                    playStory({
                      id: item.storyId,
                      title: item.title,
                      category: item.category,
                      duration: item.duration,
                      thumbnail: item.thumbnail,
                      narrator: item.narrator,
                      description: "",
                      audioUrl: item.localPath,
                    });
                    router.push("/audio/player");
                  }}
                >
                  <View style={[styles.thumb, { backgroundColor: colors.secondary }]}>
                    {item.thumbnail ? (
                      <Image
                        source={{ uri: item.thumbnail.startsWith("/") ? BASE + item.thumbnail : item.thumbnail }}
                        style={styles.thumbImg}
                        contentFit="cover"
                      />
                    ) : (
                      <Text style={{ fontSize: 28 }}>🎙️</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { color: colors.foreground }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
                      {formatDuration(item.duration)} • {formatSize(item.fileSize)}
                    </Text>
                    <View style={styles.offlineBadge}>
                      <Feather name="download" size={10} color="#27AE60" />
                      <Text style={styles.offlineText}>ऑफलाइन उपलब्ध</Text>
                    </View>
                    <Text style={[styles.itemDate, { color: colors.mutedForeground }]}>
                      {formatDate(item.downloadedAt)}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item.storyId, item.title)}
                  style={styles.deleteBtn}
                >
                  <Feather name="trash-2" size={18} color="#E74C3C" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  storageCard: { margin: 16, borderRadius: 16, borderWidth: 1, padding: 16 },
  storageRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  storageLabel: { fontSize: 16, fontWeight: "700" },
  storageSize: { fontSize: 32, fontWeight: "900" },
  storageCount: { fontSize: 13, marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: "800" },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  exploreBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  item: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, padding: 12, gap: 12 },
  itemLeft: { flexDirection: "row", flex: 1, gap: 12 },
  thumb: { width: 60, height: 60, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  thumbImg: { width: "100%", height: "100%" },
  itemTitle: { fontSize: 14, fontWeight: "700", lineHeight: 20 },
  itemMeta: { fontSize: 12, marginTop: 2 },
  offlineBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  offlineText: { color: "#27AE60", fontSize: 11, fontWeight: "600" },
  itemDate: { fontSize: 11, marginTop: 2 },
  deleteBtn: { padding: 8 },
});
