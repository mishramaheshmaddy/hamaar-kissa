import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { apiFetch, ApiAudioStory, BASE } from "@/lib/api";
import { useAudio, AudioStory } from "@/context/AudioContext";

// Same mapping pattern used everywhere else in the app (home, category,
// audio tab) — without it, playing from Search was handing the player a
// raw API object with the wrong field names (thumbnailUrl instead of
// thumbnail, durationSeconds instead of duration, etc), so the mini
// player/full player silently showed a blank thumbnail and broken
// duration for anything played from search.
function mapStory(s: ApiAudioStory): AudioStory {
  return {
    id: String(s.id),
    title: s.title,
    category: s.categoryName || "other",
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

export default function SearchScreen() {
  const router = useRouter();
  const { playStory } = useAudio();

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"audio" | "video">("audio");

  const [audio, setAudio] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);


  useEffect(() => {
    (async () => {
      try {
        const [a, v] = await Promise.all([
          apiFetch<any[]>("/api/audio-stories?published=true"),
          apiFetch<any[]>("/api/videos?published=true"),
        ]);

        setAudio(a || []);
        setVideos(v || []);
      } catch (err) {
        console.error("search fetch error:", err);
      }
    })();
  }, []);

  const results = useMemo(() => {

    const list = tab === "audio"
      ? audio
      : videos;

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(item =>
      item.title?.toLowerCase().includes(q) ||
      item.searchTags?.toLowerCase().includes(q)
    );

  }, [query, tab, audio, videos]);


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#000" />
        </TouchableOpacity>

        <Text style={styles.title}>Search</Text>

        <View style={{ width: 22 }} />
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="कहानी, मंदिर, वीडियो खोजीं..."
        style={styles.search}
      />

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "audio" && styles.active]}
          onPress={() => setTab("audio")}
        >
          <Text>Audio</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, tab === "video" && styles.active]}
          onPress={() => setTab("video")}
        >
          <Text>Video</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        style={{ marginTop: 20 }}
        keyboardShouldPersistTaps="handled"
        data={query.trim() ? results : []}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          query.trim() ? (
            <View style={styles.body}>
              <Text>No results found.</Text>
            </View>
          ) : (
            <View style={styles.body}>
              <Text>Search audio or videos.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => {
              if (tab === "audio") {
                playStory(mapStory(item as ApiAudioStory));
                router.back();
              } else {
                router.push(
                  `/video/${item.id}` as any
                );
              }
            }}
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              {item.title}
            </Text>

            <Text
              style={{
                marginTop: 4,
                color: "#666",
              }}
            >
              {tab === "audio" ? "🎧 Audio" : "🎥 Video"}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8F1",
    padding: 16,
  },
  header: {
    marginTop: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  search: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  tabs: {
    flexDirection: "row",
    marginTop: 16,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#eee",
    marginRight: 10,
  },
  active: {
    backgroundColor: "#FFD89A",
  },
  body: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
