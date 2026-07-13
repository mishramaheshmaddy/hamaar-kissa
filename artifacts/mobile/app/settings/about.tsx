import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Linking } from "react-native";
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

const logo = require("@/assets/images/logo.png");

const FEATURES = [
  { icon: "🎙️", text: "भोजपुरी ऑडियो कहानी सुनीं" },
  { icon: "📱", text: "वर्टिकल शॉर्ट वीडियो देखीं" },
  { icon: "👻", text: "भूत-प्रेत, भक्ति, प्रेम, हास्य और गांव की कहानी" },
  { icon: "🌙", text: "स्लीप टाइमर के साथ सुरक्षित सुनाई" },
  { icon: "📤", text: "अपनी कहानी अपलोड करीं" },
];

export default function AboutScreen() {
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
        <Text style={[styles.title, { color: colors.foreground }]}>ℹ️ हमार किस्सा के बारे में</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroSection}>
          <Image source={logo} style={styles.logo} contentFit="contain" />
          <Text style={[styles.appName, { color: colors.foreground }]}>Hamaar Kissa</Text>
          <View style={[styles.versionBadge, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[styles.version, { color: colors.primary }]}>संस्करण 1.0.0</Text>
          </View>
        </View>

        <View style={[styles.missionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.missionTitle, { color: colors.foreground }]}>🎯 हमारा मिशन</Text>
          <Text style={[styles.missionText, { color: colors.mutedForeground }]}>
            हमार किस्सा एक भोजपुरी मनोरंजन प्लेटफार्म ह जहाँ आप अपनी मातृभाषा में कहानी सुन सकत बाड़े, वीडियो देख सकत बाड़े, और खुद की कहानी शेयर कर सकत बाड़े।{"\n\n"}
            हमार लक्ष्य बा कि भोजपुरी संस्कृति और भाषा को डिजिटल मंच पर जिंदा रखल जाव, और हर उम्र के लोगन के लिए मनोरंजन उपलब्ध कराओ।
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>मुख्य सुविधाएँ</Text>
        <View style={[styles.featuresCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {FEATURES.map((f, i) => (
            <View
              key={i}
              style={[
                styles.featureRow,
                i < FEATURES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <Text style={{ fontSize: 22 }}>{f.icon}</Text>
              <Text style={[styles.featureText, { color: colors.foreground }]}>{f.text}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.contactTitle, { color: colors.foreground }]}>📬 संपर्क</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL("mailto:hamaarkissa@gmail.com")}
            style={styles.emailRow}
          >
            <Feather name="mail" size={16} color={colors.primary} />
            <Text style={[styles.emailText, { color: colors.primary }]}>
              hamaarkissa@gmail.com
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.copyright, { color: colors.mutedForeground }]}>
          © 2024–2025 Hamaar Kissa{"\n"}हमार भाषा, हमार कहनी 🙏
        </Text>
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
  title: { fontSize: 16, fontWeight: "800" },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  heroSection: { alignItems: "center", paddingVertical: 24, gap: 10 },
  logo: { width: 100, height: 100 },
  appName: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  versionBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  version: { fontSize: 13, fontWeight: "700" },
  missionCard: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 10 },
  missionTitle: { fontSize: 16, fontWeight: "800" },
  missionText: { fontSize: 14, lineHeight: 22 },
  sectionLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  featuresCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  featureRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 14 },
  featureText: { fontSize: 14, fontWeight: "500", flex: 1 },
  contactCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  contactTitle: { fontSize: 15, fontWeight: "700" },
  emailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  emailText: { fontSize: 13, fontWeight: "600" },
  copyright: { textAlign: "center", fontSize: 12, lineHeight: 20 },
});
