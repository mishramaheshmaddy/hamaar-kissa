import { Platform } from "react-native";
import messaging from "@react-native-firebase/messaging";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { BASE } from "./api";

export interface NotificationPrefs {
  master: boolean;
  notifyNewStories: boolean;
  notifyNewVideos: boolean;
  phone?: string | null;
}

export const NOTIFICATION_PREF_KEY = "pref_notifications";

interface StoredNotificationPrefs {
  master: boolean;
  prefs: {
    new_stories: boolean;
    new_videos: boolean;
    weekly: boolean;
  };
}

const DEFAULT_STORED_PREFS: StoredNotificationPrefs = {
  master: true,
  prefs: {
    new_stories: true,
    new_videos: true,
    weekly: false,
  },
};

/**
 * Foreground FCM messages are delivered to messaging().onMessage(),
 * but Android does not automatically put them in the notification tray
 * while the app is open. Expo Notifications is used only to present
 * that already-received FCM message locally.
 *
 * Background/killed notifications continue to be displayed directly
 * by FCM because the server sends a notification payload.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let notificationsConfigured = false;

export async function configureLocalNotifications(): Promise<void> {
  if (Platform.OS === "web" || notificationsConfigured) return;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("new-content", {
        name: "नई कहानियां और वीडियो",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    notificationsConfigured = true;
  } catch (e) {
    console.error("configureLocalNotifications failed:", e);
  }
}

export async function loadStoredNotificationPrefs(): Promise<StoredNotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_PREF_KEY);

    if (!raw) {
      return DEFAULT_STORED_PREFS;
    }

    const parsed = JSON.parse(raw);

    return {
      master: parsed.master ?? true,
      prefs: {
        ...DEFAULT_STORED_PREFS.prefs,
        ...parsed.prefs,
      },
    };
  } catch {
    return DEFAULT_STORED_PREFS;
  }
}

export async function registerForPushNotifications(
  prefs: NotificationPrefs,
): Promise<string | null> {
  try {
    await configureLocalNotifications();

    const authStatus = await messaging().requestPermission();

    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.warn("Push notification permission not granted");
      return null;
    }

    const token = await messaging().getToken();

    if (!token) {
      return null;
    }

    const response = await fetch(`${BASE}/api/push-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS,
        phone: prefs.phone ?? null,
        notifyNewStories: prefs.notifyNewStories,
        notifyNewVideos: prefs.notifyNewVideos,
      }),
    });

    if (!response.ok) {
      console.error(
        "Failed to register push token:",
        response.status,
        await response.text().catch(() => ""),
      );
      return null;
    }

    return token;
  } catch (e) {
    console.error("registerForPushNotifications failed:", e);
    return null;
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  try {
    const token = await messaging().getToken();

    if (!token) return;

    await fetch(
      `${BASE}/api/push-tokens/${encodeURIComponent(token)}`,
      {
        method: "DELETE",
      },
    );
  } catch (e) {
    console.error("unregisterPushNotifications failed:", e);
  }
}

/**
 * Displays an FCM message received while the app is in the foreground.
 *
 * FCM handles background/killed notification display automatically because
 * the backend sends a notification payload. This local presentation is
 * therefore only needed for foreground delivery.
 */
async function presentForegroundNotification(remoteMessage: any): Promise<void> {
  const notification = remoteMessage?.notification;
  const data = remoteMessage?.data ?? {};

  const title = notification?.title ?? "हमार किस्सा";
  const body = notification?.body ?? "";

  if (!body) return;

  try {
    await configureLocalNotifications();

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: data.type ?? "",
          id: data.id ?? "",
        },
        sound: "default",
      },
      trigger: null,
    });
  } catch (e) {
    console.error(
      "presentForegroundNotification failed:",
      e,
    );
  }
}

/**
 * Wires up all notification behavior:
 *
 * 1. Foreground:
 *    FCM receives the message -> local system notification is displayed.
 *
 * 2. Background:
 *    FCM displays the notification -> tapping it opens exact content.
 *
 * 3. Killed/cold start:
 *    FCM displays the notification -> tapping it launches the app and
 *    getInitialNotification() opens exact content.
 */
export function setupNotificationOpenHandler(
  onOpen: (type: string, id: string) => void,
): () => void {
  const handleRemoteMessage = (remoteMessage: any) => {
    const type = remoteMessage?.data?.type;
    const id = remoteMessage?.data?.id;

    if (type && id) {
      onOpen(String(type), String(id));
    }
  };

  // Foreground FCM -> local notification.
  const unsubscribeForeground = messaging().onMessage(
    async (remoteMessage) => {
      await presentForegroundNotification(remoteMessage);
    },
  );

  // Background notification tapped.
  const unsubscribeOpened =
    messaging().onNotificationOpenedApp(handleRemoteMessage);

  // Foreground notifications are displayed locally by Expo Notifications.
  // Handle their taps and open the exact story/video.
  const expoResponseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        type?: string;
        id?: string;
      };

      if (data?.type && data?.id) {
        onOpen(String(data.type), String(data.id));
      }
    });

  // Killed app notification tapped.
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        handleRemoteMessage(remoteMessage);
      }
    })
    .catch((e) => {
      console.error(
        "getInitialNotification failed:",
        e,
      );
    });

  // Also handle a locally displayed notification that launched/resumed
  // the app from a killed state.
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response) return;

      const data = response.notification.request.content.data as {
        type?: string;
        id?: string;
      };

      if (data?.type && data?.id) {
        onOpen(String(data.type), String(data.id));
      }
    })
    .catch((e) => {
      console.error(
        "getLastNotificationResponse failed:",
        e,
      );
    });

  return () => {
    unsubscribeForeground();
    unsubscribeOpened();
    expoResponseSubscription.remove();
  };
}
