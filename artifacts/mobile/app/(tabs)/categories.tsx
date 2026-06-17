import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { useColors } from "@/hooks/useColors";
import { CATEGORY_GRADIENTS } from "@/components/CategoryColors";
import { apiFetch, ApiCategory, ApiAudioStory } from "@/lib/api";

export default function CategoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [allCats, rawStories] = await Promise.all([
          apiFetch<ApiCategory[]>("/api/categories"),
          apiFetch<ApiAudioStory[]>("/api/audio-stories?published=true"),
        ]);
        if (cancelled) return;

        const audioCats = allCats.filter(
          (c) => c.type === "audio" || c.type === "both"
        );
        setCategories(audioCats);

        const countMap: Record<number, number> = {};
        for (const s of rawStories) {
          if (s.categoryId) {
            countMap[s.categoryId] = (countMap[s.categoryId] ?? 0) + 1;
          }
        }
        setCounts(countMap);
      } catch (_e) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>सब किसिम</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            आपन पसंद के कहानी चुनीं
          </Text>
        </View>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>सब किसिम</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          आपन पसंद के कहानी चुनीं
        </Text>
      </View>

      {categories.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>🎙️</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            कवनो किसिम नइखे
          </Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const gradient: [string, string] =
              CATEGORY_GRADIENTS[item.name] ?? ["#E8530A", "#BF360C"];
            const storyCount = counts[item.id] ?? 0;
            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: gradient[1] }]}
                onPress={() => router.push(`/category/${item.id}` as any)}
                activeOpacity={0.85}
              >
                <Text style={styles.cardIcon}>{item.icon}</Text>
                <Text style={styles.cardTitle}>{item.label}</Text>
                <View style={styles.cardFooter}>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>
                      {storyCount > 0 ? `${storyCount} कहानी` : "जल्द आवत बा"}
                    </Text>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={14}
                    color="rgba(255,255,255,0.7)"
                  />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 14 },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, textAlign: "center" },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  row: { gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    gap: 4,
    minHeight: 120,
    overflow: "hidden",
  },
  cardIcon: { fontSize: 34, marginBottom: 4 },
  cardTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    flexShrink: 1,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  countBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  countText: { color: "#fff", fontSize: 10, fontWeight: "600" },
});
