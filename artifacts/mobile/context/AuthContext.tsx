import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import auth from "@react-native-firebase/auth";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const BASE = DOMAIN ? `https://${DOMAIN}` : "";

export interface AuthUser {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  authProvider: string;
  createdAt?: string | null;
  location?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  sendOTP: (phone: string) => Promise<any>;
  verifyOTP: (confirmation: any, otp: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const savedToken = await AsyncStorage.getItem("hk_token");
        const savedUser = await AsyncStorage.getItem("hk_user");
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch {}
      setIsLoading(false);
    })();
  }, []);

  const fetchUser = async () => {
    try {
      const savedToken = await AsyncStorage.getItem("hk_token");
      if (!savedToken) return;
      const res = await fetch(`${BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        await AsyncStorage.setItem("hk_user", JSON.stringify(data));
      } else {
        await logout();
      }
    } catch {}
  };

  const login = async (newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
    await AsyncStorage.setItem("hk_token", newToken);
    await AsyncStorage.setItem("hk_user", JSON.stringify(newUser));
  };

  const logout = async () => {
    try { await auth().signOut(); } catch {}
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem("hk_token");
    await AsyncStorage.removeItem("hk_user");
  };

  // Send OTP via Firebase Phone Auth
  const sendOTP = async (phone: string) => {
    const confirmation = await auth().signInWithPhoneNumber(phone);
    return confirmation;
  };

  // Verify OTP and login to backend
  const verifyOTP = async (confirmation: any, otp: string) => {
    const result = await confirmation.confirm(otp);
    const firebaseToken = await result.user.getIdToken();
    const res = await fetch(`${BASE}/api/auth/firebase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firebaseToken }),
    });
    if (!res.ok) throw new Error("Backend auth failed");
    const data = await res.json();
    await login(data.token, data.user);
  };

  // Google Sign In
  const signInWithGoogle = async () => {
    const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
    GoogleSignin.configure({
      webClientId: "980779060644-YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
    });
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const googleCredential = auth.GoogleAuthProvider.credential(userInfo.data?.idToken ?? "");
    const result = await auth().signInWithCredential(googleCredential);
    const firebaseToken = await result.user.getIdToken();
    const res = await fetch(`${BASE}/api/auth/firebase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firebaseToken }),
    });
    if (!res.ok) throw new Error("Backend auth failed");
    const data = await res.json();
    await login(data.token, data.user);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, fetchUser, sendOTP, verifyOTP, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
