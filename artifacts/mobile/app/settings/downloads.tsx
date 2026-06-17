import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function DownloadsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>⬇️ डाउनलोड्स</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>
          ऑफलाइन सुने और देखें
        </Text>

        <View style={[styles.storageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.storageTitle, { color: colors.foreground }]}>📦 स्टोरेज</Text>
          <View style={styles.storageBar}>
            <View style={[styles.storageBarFill, { backgroundColor: colors.primary, width: "5%" }]} />
          </View>
          <View style={styles.storageRow}>
            <Text style={[styles.storageLabel, { color: colors.mutedForeground }]}>उपयोग: 0 MB</Text>
            <Text style={[styles.storageLabel, { color: colors.mutedForeground }]}>उपलब्ध: 2 GB</Text>
          </View>
        </View>

        <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 52, marginBottom: 12 }}>📥</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>कवनो डाउनलोड नइखे</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            कहानी या वीडियो के ऑफलाइन सुनला के लिए डाउनलोड करीं।{"\n"}
            जल्द ही ई सुविधा उपलब्ध होई।
          </Text>
          <TouchableOpacity
            style={[styles.exploreBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(tabs)/audio" as any)}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>कहानी खोजीं</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800" },
  content: { padding: 16, gap: 16 },
  desc: { fontSize: 14, lineHeight: 20 },
  storageCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  storageTitle: { fontSize: 15, fontWeight: "700" },
  storageBar: { height: 8, borderRadius: 4, backgroundColor: "#E0E0E0", overflow: "hidden" },
  storageBarFill: { height: "100%", borderRadius: 4 },
  storageRow: { flexDirection: "row", justifyContent: "space-between" },
  storageLabel: { fontSize: 12 },
  emptyBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800" },
  emptyDesc: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  exploreBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
});
