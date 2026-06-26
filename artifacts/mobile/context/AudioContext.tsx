import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { getLocalPath, isDownloaded } from "@/lib/downloadManager";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const BASE = DOMAIN ? `https://${DOMAIN}` : "";

export interface AudioStory {
  id: string;
  title: string;
  category: string;
  categoryId?: number;
  categoryName?: string;
  duration: number;
  thumbnail: string;
  narrator: string;
  description: string;
  audioUrl?: string;
}

interface AudioContextType {
  currentStory: AudioStory | null;
  isPlaying: boolean;
  progress: number;
  speed: number;
  playStory: (story: AudioStory) => void;
  togglePlay: () => void;
  seekForward: () => void;
  seekBackward: () => void;
  setSpeed: (s: number) => void;
  stopPlayer: () => void;
  likedStories: string[];
  savedStories: string[];
  history: string[];
  toggleLike: (id: string) => void;
  toggleSave: (id: string) => void;
  sleepTimerMinutes: number | null;
  setSleepTimer: (minutes: number | null) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [currentStory, setCurrentStory] = useState<AudioStory | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeedState] = useState(1);
  const [likedStories, setLikedStories] = useState<string[]>([]);
  const [savedStories, setSavedStories] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [sleepTimerMinutes, setSleepTimerState] = useState<number | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const liked = await AsyncStorage.getItem("liked_stories");
        const saved = await AsyncStorage.getItem("saved_stories");
        const hist = await AsyncStorage.getItem("history_stories");
        if (liked) setLikedStories(JSON.parse(liked));
        if (saved) setSavedStories(JSON.parse(saved));
        if (hist) setHistory(JSON.parse(hist));
      } catch {}
    })();
  }, []);

  const unloadSound = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
  }, []);

  const stopPlayer = useCallback(async () => {
    await unloadSound();
    setIsPlaying(false);
    setCurrentStory(null);
    setProgress(0);
  }, [unloadSound]);

  const setSleepTimer = useCallback(
    (minutes: number | null) => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
      setSleepTimerState(minutes);
      if (minutes !== null) {
        sleepTimerRef.current = setTimeout(() => {
          stopPlayer();
          setSleepTimerState(null);
        }, minutes * 60 * 1000);
      }
    },
    [stopPlayer]
  );

  const playStory = useCallback(
    async (story: AudioStory) => {
      await unloadSound();

      setCurrentStory(story);
      setProgress(0);

      const newHistory = [story.id, ...history.filter((id) => id !== story.id)].slice(0, 20);
      setHistory(newHistory);
      await AsyncStorage.setItem("history_stories", JSON.stringify(newHistory)).catch(() => {});

      if (!story.audioUrl) {
        setIsPlaying(false);
        return;
      }

      let uri = story.audioUrl.startsWith("/")
        ? `${BASE}${story.audioUrl}`
        : story.audioUrl;

      try {
        if (await isDownloaded(story.id)) {
          uri = getLocalPath(story.id);
          console.log("▶️ Playing offline:", uri);
        }
      } catch (e) {
        console.log("Offline check failed:", e);
      }

      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true, rate: speed },
          (status) => {
            if (status.isLoaded) {
              const dur = status.durationMillis ?? story.duration * 1000;
              const pos = status.positionMillis ?? 0;
              setProgress(dur > 0 ? (pos / dur) * 100 : 0);
              setIsPlaying(status.isPlaying ?? false);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setProgress(100);
              }
            }
          }
        );
        soundRef.current = sound;
        setIsPlaying(true);
      } catch (_e) {
        setIsPlaying(false);
      }
    },
    [history, speed, unloadSound]
  );

  const togglePlay = useCallback(async () => {
    if (soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await soundRef.current.pauseAsync();
            setIsPlaying(false);
          } else {
            await soundRef.current.playAsync();
            setIsPlaying(true);
          }
        }
      } catch {}
    } else {
      setIsPlaying((p) => !p);
    }
  }, []);

  const seekForward = useCallback(async () => {
    if (soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          const newPos = Math.min((status.positionMillis ?? 0) + 10000, status.durationMillis ?? 0);
          await soundRef.current.setPositionAsync(newPos);
        }
      } catch {}
    }
  }, []);

  const seekBackward = useCallback(async () => {
    if (soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          const newPos = Math.max((status.positionMillis ?? 0) - 10000, 0);
          await soundRef.current.setPositionAsync(newPos);
        }
      } catch {}
    }
  }, []);

  const setSpeed = useCallback(async (s: number) => {
    setSpeedState(s);
    if (soundRef.current) {
      try {
        await soundRef.current.setRateAsync(s, true);
      } catch {}
    }
  }, []);

  const toggleLike = useCallback(
    async (id: string) => {
      const updated = likedStories.includes(id)
        ? likedStories.filter((s) => s !== id)
        : [...likedStories, id];
      setLikedStories(updated);
      await AsyncStorage.setItem("liked_stories", JSON.stringify(updated)).catch(() => {});
    },
    [likedStories]
  );

  const toggleSave = useCallback(
    async (id: string) => {
      const updated = savedStories.includes(id)
        ? savedStories.filter((s) => s !== id)
        : [...savedStories, id];
      setSavedStories(updated);
      await AsyncStorage.setItem("saved_stories", JSON.stringify(updated)).catch(() => {});
    },
    [savedStories]
  );

  return (
    <AudioContext.Provider
      value={{
        currentStory,
        isPlaying,
        progress,
        speed,
        playStory,
        togglePlay,
        seekForward,
        seekBackward,
        setSpeed,
        stopPlayer,
        likedStories,
        savedStories,
        history,
        toggleLike,
        toggleSave,
        sleepTimerMinutes,
        setSleepTimer,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}
