import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import auth from "@react-native-firebase/auth";
import { BASE } from "@/lib/api";

export interface AuthUser {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  authProvider: string;
  username?: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
  createdAt?: string | null;
  location?: string | null;
}

interface FirebaseAuthResult {
  token: string;
  user: AuthUser;
  isNewUser?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  sendOTP: (phone: string) => Promise<any>;
  verifyOTP: (confirmation: any, otp: string) => Promise<FirebaseAuthResult>;
  signInWithGoogle: () => Promise<FirebaseAuthResult>;
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
        console.error("fetchUser failed, status:", res.status);
        await logout();
      }
    } catch (err) {
      console.error("fetchUser error:", err);
    }
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

  // Send OTP via Firebase Phone Auth. `phone` must be in E.164 format (e.g. +919876543210)
  const sendOTP = async (phone: string) => {
    const confirmation = await auth().signInWithPhoneNumber(phone);
    return confirmation;
  };

  // Exchange a Firebase phone-auth token for a backend session.
  // Skips the backend login() call if the user is new so the caller can
  // collect a name first, then call login() itself.
  const verifyOTP = async (confirmation: any, otp: string): Promise<FirebaseAuthResult> => {
    const result = await confirmation.confirm(otp);
    if (!result?.user) throw new Error("OTP verification did not return a user");
    const firebaseToken = await result.user.getIdToken();
    const res = await fetch(`${BASE}/api/auth/firebase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firebaseToken }),
    });
    if (!res.ok) throw new Error("Backend auth failed");
    const data: FirebaseAuthResult = await res.json();
    await login(data.token, data.user);
    return data;
  };

  // Google Sign-In is verified by the API using Google's public signing keys.
  // This avoids a second native Firebase credential exchange after the account
  // picker, which was returning users to Login when that exchange failed.
  const signInWithGoogle = async (): Promise<FirebaseAuthResult> => {
    const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
    GoogleSignin.configure({
      webClientId: "980779060644-3imt0epjlh3i2ubshu0rj8tsi8do8i8c.apps.googleusercontent.com",
    });
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo.data?.idToken;
    if (!idToken) throw new Error("Google Sign-In did not return an ID token");

    const res = await fetch(`${BASE}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new Error("Backend auth failed");
    const data: FirebaseAuthResult = await res.json();
    await login(data.token, data.user);
    return data;
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
