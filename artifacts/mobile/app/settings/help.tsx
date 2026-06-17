import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Linking } from "react-native";
import React, { useState } from "react";
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

const FAQS = [
  {
    q: "Hamaar Kissa कइसे काम करेला?",
    a: "हमार किस्सा एक भोजपुरी ऑडियो-वीडियो मनोरंजन ऐप ह। आप भूत-प्रेत, भक्ति, प्रेम, गांव, और भी कई किसिम के कहानी सुन और वीडियो देख सकत बाड़े।",
  },
  {
    q: "कहानी कइसे सुनल जाला?",
    a: "होम स्क्रीन पर या 'सुनी' टैब में कवनो कहानी पर टैप करीं। ऑडियो प्लेयर खुल जाई जहाँ से रोकल, आगे-पीछे करल, और स्पीड बदलल जा सकेला।",
  },
  {
    q: "क्या ऑफलाइन सुन सकत बानी?",
    a: "ऑफलाइन डाउनलोड फीचर जल्द ही आवत बा। अभी इंटरनेट कनेक्शन जरूरी बा।",
  },
  {
    q: "अपनी कहानी कइसे अपलोड करीं?",
    a: "प्रोफाइल सेक्शन में जाकर 'अपनी कहानी अपलोड करीं' बटन दबाईं। अपनी ऑडियो फाइल, टाइटल, और कैटेगरी चुनीं। हमारी टीम रिव्यू के बाद पब्लिश करेगी।",
  },
  {
    q: "स्लीप टाइमर क्या है?",
    a: "स्लीप टाइमर एक सुविधा ह जो सुते समय ऑडियो को अपने आप बंद कर देला। सेटिंग्स में जाकर टाइमर सेट करीं।",
  },
  {
    q: "कहानी पसंद या सेव कइसे करीं?",
    a: "कहानी चलावत समय ❤️ (पसंद) या 📌 (सेव) बटन दबाईं। सेव कइल कहानी प्रोफाइल के 'सेव' टैब में मिली।",
  },
];

export default function HelpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>❓ मदद और सहायता</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>
          सवाल-जवाब और सहायता
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>अक्सर पूछे जाने वाले सवाल</Text>

        <View style={[styles.faqCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {FAQS.map((item, i) => (
            <View key={i}>
              <TouchableOpacity
                onPress={() => setOpenFaq(openFaq === i ? null : i)}
                style={[
                  styles.faqRow,
                  i < FAQS.length - 1 && openFaq !== i && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.faqQ, { color: colors.foreground, flex: 1 }]}>{item.q}</Text>
                <Feather
                  name={openFaq === i ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
              {openFaq === i && (
                <View style={[styles.faqAnswer, { borderBottomWidth: i < FAQS.length - 1 ? 1 : 0, borderBottomColor: colors.border }]}>
                  <Text style={[styles.faqA, { color: colors.mutedForeground }]}>{item.a}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>संपर्क करीं</Text>

        <TouchableOpacity
          style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => Linking.openURL("mailto:thenewsheeoperations@gmail.com")}
        >
          <View style={[styles.contactIcon, { backgroundColor: "#4285F420" }]}>
            <Text style={{ fontSize: 24 }}>✉️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.contactLabel, { color: colors.foreground }]}>ईमेल सपोर्ट</Text>
            <Text style={[styles.contactValue, { color: colors.primary }]}>
              thenewsheeoperations@gmail.com
            </Text>
            <Text style={[styles.contactDesc, { color: colors.mutedForeground }]}>
              24 घंटे के अंदर जवाब मिलेगा
            </Text>
          </View>
          <Feather name="external-link" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
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
  title: { fontSize: 17, fontWeight: "800" },
  content: { padding: 16, gap: 12 },
  desc: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  sectionLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 },
  faqCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  faqRow: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  faqQ: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  faqAnswer: { paddingHorizontal: 16, paddingBottom: 16 },
  faqA: { fontSize: 13, lineHeight: 20 },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  contactIcon: { width: 50, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  contactLabel: { fontSize: 15, fontWeight: "700" },
  contactValue: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  contactDesc: { fontSize: 12, marginTop: 2 },
});
