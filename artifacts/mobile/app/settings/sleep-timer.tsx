import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { useAudio } from "@/context/AudioContext";

const TIMER_OPTIONS = [
  { label: "5 मिनट", minutes: 5 },
  { label: "10 मिनट", minutes: 10 },
  { label: "30 मिनट", minutes: 30 },
  { label: "1 घंटा", minutes: 60 },
];

export default function SleepTimerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sleepTimerMinutes, setSleepTimer, isPlaying, currentStory } = useAudio();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (sleepTimerMinutes === null) {
      setRemaining(null);
      return;
    }
    setRemaining(sleepTimerMinutes * 60);
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r === null || r <= 1) {
          clearInterval(interval);
          return null;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerMinutes]);

  const formatRemaining = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSelect = (minutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (sleepTimerMinutes === minutes) {
      setSleepTimer(null);
    } else {
      setSleepTimer(minutes);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>🌙 स्लीप टाइमर</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>
          सुनते समय टाइम सेट करें — टाइमर खत्म होने पर कहानी अपने आप बंद हो जाएगी।
        </Text>

        {sleepTimerMinutes !== null && remaining !== null && (
          <View style={[styles.activeCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}>
            <Text style={{ fontSize: 36 }}>🌙</Text>
            <Text style={[styles.activeLabel, { color: colors.foreground }]}>टाइमर चालू है</Text>
            <Text style={[styles.countdown, { color: colors.primary }]}>
              {formatRemaining(remaining)} बाकी
            </Text>
            <Text style={[styles.activeDesc, { color: colors.mutedForeground }]}>
              {currentStory ? `"${currentStory.title}" बंद होगी` : "ऑडियो बंद होगा"}
            </Text>
            <TouchableOpacity
              onPress={() => { setSleepTimer(null); Haptics.selectionAsync(); }}
              style={[styles.cancelBtn, { borderColor: colors.primary }]}
            >
              <Text style={[styles.cancelBtnText, { color: colors.primary }]}>टाइमर रद्द करीं</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>समय चुनीं</Text>
        <View style={styles.optionsGrid}>
          {TIMER_OPTIONS.map((opt) => {
            const isActive = sleepTimerMinutes === opt.minutes;
            return (
              <TouchableOpacity
                key={opt.minutes}
                onPress={() => handleSelect(opt.minutes)}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isActive ? colors.primary : colors.card,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 28 }}>🌙</Text>
                <Text style={[styles.optionLabel, { color: isActive ? "#fff" : colors.foreground }]}>
                  {opt.label}
                </Text>
                {isActive && (
                  <View style={styles.checkBadge}>
                    <Feather name="check" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {!isPlaying && (
          <View style={[styles.infoBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="info" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              टाइमर तब काम करेगा जब कोई कहानी चल रही हो।
            </Text>
          </View>
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
  content: { padding: 16, gap: 16 },
  desc: { fontSize: 14, lineHeight: 20 },
  activeCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  activeLabel: { fontSize: 16, fontWeight: "700" },
  countdown: { fontSize: 36, fontWeight: "900" },
  activeDesc: { fontSize: 13 },
  cancelBtn: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 8, marginTop: 4 },
  cancelBtnText: { fontWeight: "700", fontSize: 14 },
  sectionLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  optionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  optionCard: {
    flex: 1,
    minWidth: "44%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 8,
    position: "relative",
  },
  optionLabel: { fontSize: 15, fontWeight: "700" },
  checkBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: { fontSize: 13, flex: 1 },
});
