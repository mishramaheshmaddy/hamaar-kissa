import { Platform } from "react-native";
import messaging from "@react-native-firebase/messaging";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE } from "./api";

export interface NotificationPrefs {
  master: boolean;
  notifyNewStories: boolean;
  notifyNewVideos: boolean;
}

// Same storage key/shape as app/settings/notifications.tsx — kept here so
// both the settings screen and the app-startup registration effect read
// from a single source of truth.
export const NOTIFICATION_PREF_KEY = "pref_notifications";

interface StoredNotificationPrefs {
  master: boolean;
  prefs: { new_stories: boolean; new_videos: boolean; weekly: boolean };
}

const DEFAULT_STORED_PREFS: StoredNotificationPrefs = {
  master: true,
  prefs: { new_stories: true, new_videos: true, weekly: false },
};

export async function loadStoredNotificationPrefs(): Promise<StoredNotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_PREF_KEY);
    if (!raw) return DEFAULT_STORED_PREFS;
    const parsed = JSON.parse(raw);
    return {
      master: parsed.master ?? true,
      prefs: { ...DEFAULT_STORED_PREFS.prefs, ...parsed.prefs },
    };
  } catch {
    return DEFAULT_STORED_PREFS;
  }
}

/**
 * Asks for notification permission (no-op / auto-granted on Android <13,
 * shows the native prompt on iOS and Android 13+) and, if granted,
 * registers this device's FCM token + preferences with the backend.
 * Safe to call multiple times — the backend upserts by token.
 */
export async function registerForPushNotifications(prefs: NotificationPrefs): Promise<string | null> {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    if (!enabled) return null;

    const token = await messaging().getToken();
    if (!token) return null;

    await fetch(`${BASE}/api/push-tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        platform: Platform.OS,
        notifyNewStories: prefs.notifyNewStories,
        notifyNewVideos: prefs.notifyNewVideos,
      }),
    });

    return token;
  } catch (e) {
    console.error("registerForPushNotifications failed:", e);
    return null;
  }
}

/** Removes this device's token — called when the master toggle is turned off. */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    const token = await messaging().getToken();
    if (!token) return;
    await fetch(`${BASE}/api/push-tokens/${encodeURIComponent(token)}`, { method: "DELETE" });
  } catch (e) {
    console.error("unregisterPushNotifications failed:", e);
  }
}

/**
 * Wires up tap-to-open deep linking for notifications received while the
 * app is backgrounded, and for a cold start from a killed state. Reuses
 * the same /content/[type]/[id] route the share-link deep links use.
 * Call once near the app root; returns an unsubscribe function.
 */
export function setupNotificationOpenHandler(onOpen: (type: string, id: string) => void): () => void {
  const handleRemoteMessage = (remoteMessage: any) => {
    const type = remoteMessage?.data?.type;
    const id = remoteMessage?.data?.id;
    if (type && id) onOpen(String(type), String(id));
  };

  // App was backgrounded, user tapped the notification.
  const unsubscribeOpened = messaging().onNotificationOpenedApp(handleRemoteMessage);

  // App was fully killed, user tapped the notification to launch it.
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) handleRemoteMessage(remoteMessage);
    })
    .catch(() => {});

  return unsubscribeOpened;
}
