const FALLBACK_BASE = "https://hamaar-kissa-api.onrender.com";

import AsyncStorage from "@react-native-async-storage/async-storage";

function getBase() {
  const envDomain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (envDomain) {
    return `https://${envDomain}`;
  }
  return FALLBACK_BASE;
}

export const BASE = getBase();

export interface ApiCategory {
  id: number;
  name: string;
  label: string;
  icon: string;
  type: "audio" | "video" | "both";
  slug?: string;
  active?: boolean;
}

export interface ApiAudioStory {
  id: number;
  title: string;
  categoryId: number | null;
  categoryName?: string;
  narrator: string;
  durationSeconds: number;
  description: string;
  thumbnailUrl: string | null;
  audioUrl: string;
  sourceType?: string;
  published?: boolean;
}

export interface ApiVideo {
  id: number;
  title: string;
  categoryId: number | null;
  categoryName?: string;
  description: string;
  thumbnailUrl: string | null;
  youtubeId?: string | null;
  videoUrl?: string | null;
  sourceType?: string;
}

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);

  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }

  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(`API returned non-JSON: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------
// Analytics event tracking (Phase 2) — story_play / video_play /
// download / like / save. Deliberately fire-and-forget: callers should
// NOT await this in a way that blocks the UI, and it must never throw —
// a flaky network or a slow/down analytics endpoint should never be
// visible to someone listening to a story or watching a video.
// ---------------------------------------------------------------------
export type AnalyticsEventType = "story_play" | "video_play" | "download" | "like" | "save";
export type AnalyticsContentType = "story" | "video";

export function trackEvent(
  eventType: AnalyticsEventType,
  contentType?: AnalyticsContentType,
  contentId?: string | number
): void {
  (async () => {
    try {
      const token = await AsyncStorage.getItem("hk_token");

      await fetch(`${BASE}/api/analytics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ eventType, contentType, contentId }),
      });
    } catch {
      // Fire-and-forget — never surface analytics failures to the user.
    }
  })();
}
