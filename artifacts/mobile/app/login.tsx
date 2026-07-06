import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { BASE } from "@/lib/api";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, sendOTP, verifyOTP, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<"select" | "phone" | "otp" | "name">("select");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");
  const [confirmation, setConfirmation] = useState<any>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const otpInputRef = useRef<TextInput>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  // Countdown for the "Resend OTP" button — ticks every second while on the
  // OTP screen and resendTimer > 0.
  useEffect(() => {
    if (mode !== "otp" || resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [mode, resendTimer > 0]);

  const sendOtp = async () => {
    if (!phone.match(/^\d{10}$/)) return;
    setLoading(true);
    setOtp("");
    try {
      const result = await sendOTP(`+91${phone}`);
      setConfirmation(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMode("otp");
      setResendTimer(30);
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("OTP नहीं भेजा जा सका", error instanceof Error ? error.message : "फिर से कोशिश करीं।");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.match(/^\d{6}$/) || !confirmation) return;
    setLoading(true);
    try {
      const data = await verifyOTP(confirmation, otp);
      if (data.isNewUser) {
        setToken(data.token);
        setMode("name");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("OTP गलत बा", error instanceof Error ? error.message : "फिर से कोशिश करीं।");
    } finally {
      setLoading(false);
    }
  };

  const saveName = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      await login(token, data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Google Login विफल", error instanceof Error ? error.message : "फिर से कोशिश करीं।");
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async () => {
    setLoading(true);
    try {
      const data = await signInWithGoogle();
      if (data.isNewUser) {
        setToken(data.token);
        setMode("name");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Google Login विफल", error instanceof Error ? error.message : "फिर से कोशिश करीं।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPadding }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: colors.foreground }]}>
            {mode === "select" ? "लॉग इन करीं" : mode === "phone" ? "फोन नंबर डालीं" : mode === "otp" ? "OTP दर्ज करीं" : "अपना नाम बताईं"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {mode === "select"
              ? "अपना कहानी सुनाइब, सेव करीब, लाइक करीब"
              : mode === "phone"
              ? "10 अंक के मोबाइल नंबर डालीं"
              : mode === "otp"
              ? `${phone} पर भेजल गइल 6 अंक के OTP`
              : "नाम लिखीं ताकि हम जान सकीं कि कौन हइं"}
          </Text>

          {mode === "select" && (
            <View style={styles.options}>
              <TouchableOpacity
                style={[styles.optionBtn, { backgroundColor: colors.primary }]}
                onPress={() => setMode("phone")}
                activeOpacity={0.85}
              >
                <Feather name="smartphone" size={22} color="#fff" />
                <Text style={styles.optionText}>मोबाइल नंबर से लॉगिन</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionBtn, { backgroundColor: "#4285F4" }]}
                onPress={googleLogin}
                activeOpacity={0.85}
              >
                <Feather name="globe" size={22} color="#fff" />
                <Text style={styles.optionText}>Google से लॉगिन</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === "phone" && (
            <View style={styles.inputBox}>
              <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text style={[styles.prefix, { color: colors.mutedForeground }]}>+91</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="9876543210"
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                />
              </View>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary }, (!phone.match(/^\d{10}$/) || loading) && { opacity: 0.6 }]}
                onPress={sendOtp}
                disabled={!phone.match(/^\d{10}$/) || loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>OTP भेजीं</Text>}
              </TouchableOpacity>
            </View>
          )}

          {mode === "otp" && (
            <View style={styles.inputBox}>
              <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <TextInput
                  ref={otpInputRef}
                  style={[styles.input, { color: colors.foreground, textAlign: "center", letterSpacing: 8, fontSize: 22 }]}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="000000"
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                />
              </View>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary }, (!otp.match(/^\d{6}$/) || loading) && { opacity: 0.6 }]}
                onPress={verifyOtp}
                disabled={!otp.match(/^\d{6}$/) || loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>Verify करीं</Text>}
              </TouchableOpacity>

              <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 16, gap: 6 }}>
                <Text style={{ color: colors.mutedForeground }}>OTP ना मिलल?</Text>
                {resendTimer > 0 ? (
                  <Text style={{ color: colors.mutedForeground, fontWeight: "600" }}>
                    {resendTimer}s में फिर से भेजीं
                  </Text>
                ) : (
                  <TouchableOpacity onPress={sendOtp} disabled={loading}>
                    <Text style={{ color: colors.primary, fontWeight: "700" }}>फिर से भेजीं</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity onPress={() => setMode("phone")} style={{ marginTop: 12, alignSelf: "center" }}>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>नंबर बदल दीं</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === "name" && (
            <View style={styles.inputBox}>
              <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="आपका नाम"
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                />
              </View>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary }, (!name.trim() || loading) && { opacity: 0.6 }]}
                onPress={saveName}
                disabled={!name.trim() || loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>सुरक्षित करीं</Text>}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  backBtn: { marginTop: 8, marginBottom: 12, width: 40, height: 40, justifyContent: "center" },
  scroll: { paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  subtitle: { fontSize: 15, marginBottom: 32, lineHeight: 22 },
  options: { gap: 16 },
  optionBtn: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderRadius: 16 },
  optionText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  inputBox: { gap: 16 },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  prefix: { fontSize: 16, fontWeight: "700" },
  input: { flex: 1, fontSize: 16, fontWeight: "600" },
  actionBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  actionText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
