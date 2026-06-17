const FALLBACK_BASE = "https://bhojpuri-beats--maheshgkp.replit.app";

function getBase() {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `https://${window.location.hostname}`;
  }
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
