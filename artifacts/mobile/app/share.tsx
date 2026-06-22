import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const BASE = DOMAIN ? `https://${DOMAIN}` : "";

export default function ShareScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { type, id } = useLocalSearchParams<{ type?: string; id?: string }>();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<{ title: string; description: string; thumbnailUrl?: string; audioUrl?: string; videoUrl?: string } | null>(null);

  useEffect(() => {
    if (!type || !id) return;
    (async () => {
      try {
        const res = await fetch(`${BASE}/api/share/${type}/${id}`);
        if (res.ok) {
          // The endpoint returns HTML for web, but we call it as JSON fallback? Actually share endpoint returns HTML.
          // Let's fetch from content APIs directly
          const path = type === "audio" ? `/api/audio-stories/${id}` : `/api/videos/${id}`;
          const contentRes = await fetch(`${BASE}${path}`);
          if (contentRes.ok) {
            const data = await contentRes.json();
            setItem(data);
          }
        }
      } catch {}
      setLoading(false);
    })();
  }, [type, id]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Text style={{ color: colors.mutedForeground }}>Content not found.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Feather name="arrow-left" size={24} color={colors.foreground} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
      <Text style={[styles.desc, { color: colors.mutedForeground }]}>{item.description}</Text>
      <TouchableOpacity
        style={[styles.openBtn, { backgroundColor: colors.primary }]}
        onPress={() => {
          if (type === "audio") {
            // Navigate to audio player
            router.push({ pathname: "/audio/player", params: { id } } as any);
          } else {
            router.push("/(tabs)/video" as any);
          }
        }}
      >
        <Text style={styles.openBtnText}>Open in App</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  backBtn: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 8 },
  desc: { fontSize: 15, marginBottom: 24, lineHeight: 22 },
  openBtn: { borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  openBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
