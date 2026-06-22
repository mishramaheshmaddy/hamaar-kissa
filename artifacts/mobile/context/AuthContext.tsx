import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

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
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem("hk_token");
    await AsyncStorage.removeItem("hk_user");
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
