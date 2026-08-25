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

export interface ApiAudioStoryStats {
  likes: number;
  saves: number;
  shares: number;
  playlistAdds: number;
  downloads: number;
}

export async function getAudioStoryStats(
  audioStoryId: number,
): Promise<ApiAudioStoryStats> {
  return apiFetch<ApiAudioStoryStats>(
    `/api/analytics/story/${audioStoryId}`,
  );
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

export interface ApiVideoComment {
  id: number;
  text: string;
  userId: number;
  user: string;
  avatarUrl: string | null;
  createdAt: string;
  parentCommentId: number | null;
}

export interface ApiVideoEngagement {
  likes: number;
  saves: number;
  liked: boolean;
  saved: boolean;
  comments: ApiVideoComment[];
}

export async function getVideoEngagement(
  videoId: number,
): Promise<ApiVideoEngagement> {
  const token = await AsyncStorage.getItem("hk_token");
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api/videos/${videoId}/engagement`, { headers });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<ApiVideoEngagement>;
}

export interface ApiVideoReaction {
  liked: boolean;
  saved: boolean;
  likes: number;
  saves: number;
}

export async function setVideoReaction(
  videoId: number,
  liked: boolean,
  saved: boolean,
): Promise<ApiVideoReaction> {
  return authenticatedFetch<ApiVideoReaction>(`/api/videos/${videoId}/reaction`, {
    method: "PUT",
    body: JSON.stringify({ liked, saved }),
  });
}

export async function addVideoComment(
  videoId: number,
  text: string,
  parentCommentId?: number | null,
): Promise<ApiVideoComment> {
  return authenticatedFetch<ApiVideoComment>(`/api/videos/${videoId}/comments`, {
    method: "POST",
    body: JSON.stringify({
      text,
      ...(parentCommentId != null ? { parentCommentId } : {}),
    }),
  });
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
export type AnalyticsEventType = "story_play" | "video_play" | "download" | "like" | "like_removed" | "save" | "save_removed" | "share";
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
// ---------------------------------------------------------------------
// Playlist API
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// Playlist API
// ---------------------------------------------------------------------

export interface ApiPlaylist {
  id: number;
  userId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPlaylistItem {
  itemId: number;
  position: number;
  story: ApiAudioStory;
}

export interface ApiPlaylistWithItems extends ApiPlaylist {
  items: ApiPlaylistItem[];
}

async function authenticatedFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await AsyncStorage.getItem("hk_token");

  if (!token) {
    throw new Error("AUTH_REQUIRED");
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("AUTH_REQUIRED");
    }

    let message = `API error ${res.status}`;

    try {
      const data = await res.json();
      if (data?.error) {
        message = data.error;
      }
    } catch {
      // Keep the generic API error.
    }

    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type");

  if (!contentType || !contentType.includes("application/json")) {
    const responseText = await res.text();
    throw new Error(
      `API returned non-JSON: ${responseText.slice(0, 200)}`,
    );
  }

  return res.json() as Promise<T>;
}

export async function getPlaylists(): Promise<ApiPlaylist[]> {
  return authenticatedFetch<ApiPlaylist[]>("/api/playlists");
}

export async function createPlaylist(
  name: string,
): Promise<ApiPlaylist> {
  return authenticatedFetch<ApiPlaylist>("/api/playlists", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function getPlaylist(
  playlistId: number,
): Promise<ApiPlaylistWithItems> {
  return authenticatedFetch<ApiPlaylistWithItems>(
    `/api/playlists/${playlistId}`,
  );
}

export async function addToPlaylist(
  playlistId: number,
  audioStoryId: number,
): Promise<ApiPlaylistItem> {
  return authenticatedFetch<ApiPlaylistItem>(
    `/api/playlists/${playlistId}/items`,
    {
      method: "POST",
      body: JSON.stringify({ audioStoryId }),
    },
  );
}

export async function removeFromPlaylist(
  playlistId: number,
  itemId: number,
): Promise<void> {
  await authenticatedFetch<void>(
    `/api/playlists/${playlistId}/items/${itemId}`,
    {
      method: "DELETE",
    },
  );
}

export async function deletePlaylist(
  playlistId: number,
): Promise<void> {
  await authenticatedFetch<void>(
    `/api/playlists/${playlistId}`,
    {
      method: "DELETE",
    },
  );
}
