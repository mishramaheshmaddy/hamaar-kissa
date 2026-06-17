import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const PREF_KEY = "pref_data";
const QUALITY_OPTIONS = ["auto", "low", "high"] as const;
type Quality = typeof QUALITY_OPTIONS[number];

const QUALITY_LABELS: Record<Quality, string> = {
  auto: "ऑटो",
  low: "कम डेटा",
  high: "उच्च गुणवत्ता",
};

export default function DataSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const [wifiOnly, setWifiOnly] = useState(false);
  const [lowData, setLowData] = useState(false);
  const [quality, setQuality] = useState<Quality>("auto");

  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY).then((v) => {
      if (v) {
        const p = JSON.parse(v);
        setWifiOnly(p.wifiOnly ?? false);
        setLowData(p.lowData ?? false);
        setQuality(p.quality ?? "auto");
      }
    }).catch(() => {});
  }, []);

  const save = (key: string, value: unknown) => {
    AsyncStorage.getItem(PREF_KEY).then((v) => {
      const prev = v ? JSON.parse(v) : {};
      AsyncStorage.setItem(PREF_KEY, JSON.stringify({ ...prev, [key]: value })).catch(() => {});
    }).catch(() => {});
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>📶 डेटा सेटिंग्स</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>
          स्ट्रीमिंग क्वालिटी नियंत्रित करें
        </Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>केवल WiFi डाउनलोड</Text>
              <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>WiFi पर ही डाउनलोड करें</Text>
            </View>
            <Switch
              value={wifiOnly}
              onValueChange={(v) => { setWifiOnly(v); save("wifiOnly", v); }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>कम डेटा मोड</Text>
              <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>कम डेटा खर्च करें</Text>
            </View>
            <Switch
              value={lowData}
              onValueChange={(v) => { setLowData(v); save("lowData", v); }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>स्ट्रीमिंग क्वालिटी</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {QUALITY_OPTIONS.map((q, i) => (
            <TouchableOpacity
              key={q}
              onPress={() => { setQuality(q); save("quality", q); }}
              style={[
                styles.row,
                i < QUALITY_OPTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <Text style={[styles.rowLabel, { color: colors.foreground, flex: 1 }]}>{QUALITY_LABELS[q]}</Text>
              {quality === q && (
                <Feather name="check" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
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
  content: { padding: 16, gap: 12 },
  desc: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  sectionLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  rowDesc: { fontSize: 12, marginTop: 2 },
});
