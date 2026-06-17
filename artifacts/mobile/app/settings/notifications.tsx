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

const PREF_KEY = "pref_notifications";

const NOTIFICATION_TYPES = [
  { key: "new_stories", label: "नई कहानी", desc: "जब नई कहानी जोड़ी जाए" },
  { key: "new_videos", label: "नया वीडियो", desc: "जब नया वीडियो अपलोड हो" },
  { key: "weekly", label: "साप्ताहिक सारांश", desc: "हर हफ्ते का खास चयन" },
];

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const [master, setMaster] = useState(true);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    new_stories: true,
    new_videos: true,
    weekly: false,
  });

  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY).then((v) => {
      if (v) {
        const parsed = JSON.parse(v);
        setMaster(parsed.master ?? true);
        setPrefs(parsed.prefs ?? prefs);
      }
    }).catch(() => {});
  }, []);

  const save = (newMaster: boolean, newPrefs: Record<string, boolean>) => {
    AsyncStorage.setItem(PREF_KEY, JSON.stringify({ master: newMaster, prefs: newPrefs })).catch(() => {});
  };

  const toggleMaster = (val: boolean) => {
    setMaster(val);
    save(val, prefs);
  };

  const togglePref = (key: string, val: boolean) => {
    const updated = { ...prefs, [key]: val };
    setPrefs(updated);
    save(master, updated);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>🔔 सूचना</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>
          नई कहानियों और वीडियो की सूचना पाएं
        </Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: "#FF6B0020" }]}>
              <Text style={{ fontSize: 20 }}>🔔</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>सब सूचना</Text>
              <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>सभी अधिसूचनाएँ चालू/बंद करें</Text>
            </View>
            <Switch
              value={master}
              onValueChange={toggleMaster}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {master && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>किसिम के सूचना</Text>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {NOTIFICATION_TYPES.map((item, i) => (
                <View
                  key={item.key}
                  style={[
                    styles.row,
                    i < NOTIFICATION_TYPES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: colors.foreground }]}>{item.label}</Text>
                    <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
                  </View>
                  <Switch
                    value={prefs[item.key] ?? true}
                    onValueChange={(val) => togglePref(item.key, val)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
            </View>
          </>
        )}
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
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  rowDesc: { fontSize: 12, marginTop: 2 },
});
