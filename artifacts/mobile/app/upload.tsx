import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { apiFetch, ApiCategory } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const BASE = DOMAIN ? `https://${DOMAIN}` : "";
const MAX_AUDIO_MB = 10;
const MAX_IMAGE_MB = 1;

export default function UploadScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user } = useAuth();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<"idle" | "thumbnail" | "audio" | "saving">("idle");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiFetch<ApiCategory[]>("/api/categories").then((cats) => {
      setCategories(cats.filter((c) => c.type === "audio" || c.type === "both"));
    }).catch(() => {});
  }, []);

  const pickThumbnail = async () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
          Alert.alert("फाइल बड़ी है", `थंबनेल ${MAX_IMAGE_MB}MB से कम होनी चाहिए।`);
          return;
        }
        await uploadFile(file, "thumbnailUrl");
      };
      input.click();
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("अनुमति चाहिए", "फोटो एक्सेस की अनुमति दीजिए।");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setThumbnailUri(asset.uri);
        await uploadFileFromUri(asset.uri, "thumbnailUrl");
      }
    }
  };

  const pickAudio = async () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "audio/*";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
          Alert.alert("फाइल बड़ी है", `ऑडियो ${MAX_AUDIO_MB}MB से कम होनी चाहिए।`);
          return;
        }
        setAudioName(file.name);
        await uploadFile(file, "audioUrl");
      };
      input.click();
    } else {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: "audio/*",
          copyToCacheDirectory: true,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (asset.size && asset.size > MAX_AUDIO_MB * 1024 * 1024) {
          Alert.alert("फाइल बड़ी है", `ऑडियो ${MAX_AUDIO_MB}MB से कम होनी चाहिए।`);
          return;
        }
        setAudioName(asset.name);
        await uploadFileFromUri(asset.uri, "audioUrl");
      } catch {
        Alert.alert("Error", "ऑडियो pick करे में दिक्कत भइल।");
      }
    }
  };

  const uploadFile = async (file: File, field: "audioUrl" | "thumbnailUrl") => {
    setUploading(true);
    setUploadStep(field === "thumbnailUrl" ? "thumbnail" : "audio");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${BASE}/api/media/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        if (field === "thumbnailUrl") {
          setThumbnailUrl(data.url);
          if (!thumbnailUri) setThumbnailUri(data.url.startsWith("/") ? `${BASE}${data.url}` : data.url);
        } else {
          setAudioUrl(data.url);
        }
      } else {
        Alert.alert("अपलोड विफल", "फिर से कोशिश करीं।");
      }
    } catch (e) {
      console.error("UPLOAD ERROR:", e);
      Alert.alert("अपलोड विफल", "अपलोड नहीं हो पाया। कृपया फिर से कोशिश करें।");
    } finally {
      setUploading(false);
      setUploadStep("idle");
    }
  };

  const uploadFileFromUri = async (uri: string, field: "audioUrl" | "thumbnailUrl") => {
    setUploading(true);
    setUploadStep(field === "thumbnailUrl" ? "thumbnail" : "audio");
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = uri.split("/").pop() ?? "upload.jpg";
      const file = new File([blob], filename, { type: blob.type });
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE}/api/media/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        if (field === "thumbnailUrl") setThumbnailUrl(data.url);
        else setAudioUrl(data.url);
      } else {
        Alert.alert("अपलोड विफल", "फिर से कोशिश करीं।");
      }
    } catch (e) {
      console.error("UPLOAD ERROR:", e);
      Alert.alert("अपलोड विफल", "अपलोड नहीं हो पाया। कृपया फिर से कोशिश करें।");
    } finally {
      setUploading(false);
      setUploadStep("idle");
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert("लॉगिन जरूरी बा", "आपन कहानी भेजे खातिर पहिले लॉगिन करीं।");
      router.push("/login" as any);
      return;
    }
    if (!title.trim()) { Alert.alert("जरूरी", "शीर्षक दर्ज करीं।"); return; }
    if (!description.trim()) { Alert.alert("जरूरी", "विवरण दर्ज करीं।"); return; }
    if (!categoryId) { Alert.alert("जरूरी", "श्रेणी चुनीं।"); return; }
    if (!audioUrl) { Alert.alert("जरूरी", "ऑडियो फाइल अपलोड करीं।"); return; }

    setUploading(true);
    setUploadStep("saving");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await fetch(`${BASE}/api/submissions/audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          categoryId,
          audioUrl,
          thumbnailUrl: thumbnailUrl ?? "",
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        Alert.alert("विफल", `सबमिशन निष्फल: ${err.slice(0, 100)}`);
        return;
      }
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("विफल", "सबमिट करने में समस्या हुई। फिर से कोशिश करीं।");
    } finally {
      setUploading(false);
      setUploadStep("idle");
    }
  };

  if (success) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.successBox]}>
          <Text style={{ fontSize: 72 }}>🎉</Text>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>कहानी जमा हो गई!</Text>
          <Text style={[styles.successDesc, { color: colors.mutedForeground }]}>
            हमारी टीम आपकी कहानी की समीक्षा करेगी।{"\n"}
            स्वीकृति के बाद ऐप में दिखेगी।
          </Text>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>वापस जाईं</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const selectedCat = categories.find((c) => c.id === categoryId);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>📤 अपनी कहानी अपलोड करीं</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.notice, { color: colors.mutedForeground, backgroundColor: colors.secondary }]}>
          ℹ️ भोजपुरी भाषा में कहानी अपलोड करीं। हमारी टीम समीक्षा के बाद प्रकाशित करेगी।
        </Text>

        {/* Title */}
        <Text style={[styles.label, { color: colors.foreground }]}>शीर्षक *</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="कहानी का नाम..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        />

        {/* Description */}
        <Text style={[styles.label, { color: colors.foreground }]}>विवरण *</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="कहानी के बारे में लिखीं..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={4}
          style={[styles.textarea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
        />

        {/* Category */}
        <Text style={[styles.label, { color: colors.foreground }]}>श्रेणी *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setCategoryId(cat.id)}
              style={[
                styles.catChip,
                {
                  backgroundColor: categoryId === cat.id ? colors.primary : colors.card,
                  borderColor: categoryId === cat.id ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
              <Text style={[styles.catLabel, { color: categoryId === cat.id ? "#fff" : colors.foreground }]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Thumbnail */}
        <Text style={[styles.label, { color: colors.foreground }]}>थंबनेल (अधिकतम 1MB)</Text>
        <TouchableOpacity
          onPress={pickThumbnail}
          disabled={uploading}
          style={[styles.uploadBox, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          {thumbnailUri ? (
            <Image source={{ uri: thumbnailUri.startsWith("/") ? `${BASE}${thumbnailUri}` : thumbnailUri }} style={styles.thumbPreview} contentFit="cover" />
          ) : (
            <>
              <Text style={{ fontSize: 36 }}>🖼️</Text>
              <Text style={[styles.uploadBoxLabel, { color: colors.mutedForeground }]}>
                {uploadStep === "thumbnail" ? "अपलोड हो रहा है..." : "थंबनेल चुनीं"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Audio */}
        <Text style={[styles.label, { color: colors.foreground }]}>ऑडियो फाइल * (अधिकतम 10MB)</Text>
        <TouchableOpacity
          onPress={pickAudio}
          disabled={uploading}
          style={[
            styles.uploadBox,
            { backgroundColor: audioUrl ? colors.primary + "15" : colors.card, borderColor: audioUrl ? colors.primary : colors.border },
          ]}
        >
          <Text style={{ fontSize: 36 }}>{audioUrl ? "✅" : "🎤"}</Text>
          <Text style={[styles.uploadBoxLabel, { color: audioUrl ? colors.primary : colors.mutedForeground }]}>
            {uploadStep === "audio"
              ? "अपलोड हो रहा है..."
              : audioUrl
              ? audioName ?? "ऑडियो अपलोड हो गई"
              : "ऑडियो फाइल चुनीं"}
          </Text>
        </TouchableOpacity>

        {uploading && (
          <View style={styles.progressRow}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
              {uploadStep === "thumbnail" ? "थंबनेल अपलोड हो रहा है..."
                : uploadStep === "audio" ? "ऑडियो अपलोड हो रहा है..."
                : "सेव हो रहा है..."}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={uploading}
          style={[styles.submitBtn, { backgroundColor: uploading ? colors.border : colors.primary }]}
        >
          {uploading && uploadStep === "saving" ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>📤 कहानी जमा करीं</Text>
          )}
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
  title: { fontSize: 15, fontWeight: "800", flex: 1, textAlign: "center" },
  content: { padding: 16, gap: 8, paddingBottom: 60 },
  notice: { borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: "700", marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textarea: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 100, textAlignVertical: "top" },
  catScroll: { marginVertical: 4 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  catLabel: { fontSize: 13, fontWeight: "600" },
  uploadBox: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: 14, height: 110, alignItems: "center", justifyContent: "center", gap: 8, overflow: "hidden" },
  uploadBoxLabel: { fontSize: 14, fontWeight: "600" },
  thumbPreview: { width: "100%", height: "100%" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressText: { fontSize: 13 },
  submitBtn: { borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  successBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  successTitle: { fontSize: 26, fontWeight: "900" },
  successDesc: { fontSize: 15, textAlign: "center", lineHeight: 24 },
  doneBtn: { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 16, marginTop: 8 },
});
