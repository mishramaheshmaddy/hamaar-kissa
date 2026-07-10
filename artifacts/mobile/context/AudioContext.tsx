import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { AppState } from "react-native";
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
  queue: AudioStory[];
  currentQueueIndex: number;
  setQueue: React.Dispatch<React.SetStateAction<AudioStory[]>>;
  setCurrentQueueIndex: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  progress: number;
  speed: number;
  shuffle: boolean;
  repeatMode: "off" | "all" | "one";
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  playStory: (story: AudioStory) => void;
  addToQueue: (story: AudioStory) => void;
  playStoryNext: (story: AudioStory) => void;
  playNext: () => void;
  playPrevious: () => void;
  removeFromQueue: (storyId: string) => void;
  clearQueue: () => void;
  moveQueueItemToTop: (storyId: string) => void;
  moveQueueItemToBottom: (storyId: string) => void;
  togglePlay: () => void;
  pauseAudio: () => void;
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
  listeningMinutes: number;
  completedStories: number;
  listeningStreak: number;
  setSleepTimer: (minutes: number | null) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [currentStory, setCurrentStory] = useState<AudioStory | null>(null);
  const [queue, setQueue] = useState<AudioStory[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeedState] = useState(1);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [likedStories, setLikedStories] = useState<string[]>([]);
  const [savedStories, setSavedStories] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [sleepTimerMinutes, setSleepTimerState] = useState<number | null>(null);
  const [listeningMinutes, setListeningMinutes] = useState(0);
  const [completedStories, setCompletedStories] = useState(0);
  const [listeningStreak, setListeningStreak] = useState(0);

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
        const queueData = await AsyncStorage.getItem("audio_queue");
        const queueIndex = await AsyncStorage.getItem("audio_queue_index");

        if (liked) setLikedStories(JSON.parse(liked));
        if (saved) setSavedStories(JSON.parse(saved));
        if (hist) setHistory(JSON.parse(hist));

        const savedSpeed = await AsyncStorage.getItem("audio_speed");
        if (savedSpeed) {
          setSpeedState(Number(savedSpeed));
        }

        const savedSleep = await AsyncStorage.getItem("sleep_timer_minutes");
        if (savedSleep) {
          setSleepTimer(Number(savedSleep));
        }

        const savedShuffle = await AsyncStorage.getItem("audio_shuffle");
        if (savedShuffle) {
          setShuffle(savedShuffle === "true");
        }

        const savedRepeat = await AsyncStorage.getItem("audio_repeat");
        if (savedRepeat === "off" || savedRepeat === "all" || savedRepeat === "one") {
          setRepeatMode(savedRepeat);
        }

        const mins = await AsyncStorage.getItem("listening_minutes");
        if (mins) setListeningMinutes(Number(mins));

        const completed = await AsyncStorage.getItem("completed_stories");
        if (completed) setCompletedStories(Number(completed));

        const streak = await AsyncStorage.getItem("listening_streak");
        if (streak) setListeningStreak(Number(streak));


        if (queueData) {
          try {
            setQueue(JSON.parse(queueData));
          } catch {}
        }

        if (queueIndex) {
          const idx = Number(queueIndex);
          setCurrentQueueIndex(idx);

          if (
            queueData &&
            idx >= 0
          ) {
            try {
              const q = JSON.parse(queueData);
              if (q[idx]) {
                setCurrentStory(q[idx]);
              }
            } catch {}
          }
        }
      } catch {}
    })();
  }, []);


  useEffect(() => {
    AsyncStorage.setItem(
      "audio_queue",
      JSON.stringify(queue)
    ).catch(() => {});

    AsyncStorage.setItem(
      "audio_queue_index",
      String(currentQueueIndex)
    ).catch(() => {});
  }, [queue, currentQueueIndex]);

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

    AsyncStorage.multiRemove([
      "audio_current_story",
      "audio_playback_position",
      "audio_was_playing",
      "last_open_story",
    ]).catch(() => {});
  }, [unloadSound]);

  const setSleepTimer = useCallback(
    (minutes: number | null) => {
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }
      setSleepTimerState(minutes);

      if (minutes === null) {
        AsyncStorage.removeItem("sleep_timer_minutes").catch(() => {});
      } else {
        AsyncStorage.setItem(
          "sleep_timer_minutes",
          String(minutes)
        ).catch(() => {});
      }
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

      AsyncStorage.setItem(
        "last_open_story",
        JSON.stringify(story)
      ).catch(() => {});
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

              if (status.isPlaying && pos > 0 && pos % 60000 < 1000) {
                setListeningMinutes(prev => {
                  const next = prev + 1;
                  AsyncStorage.setItem(
                    "listening_minutes",
                    String(next)
                  ).catch(() => {});
                  return next;
                });
              }

              AsyncStorage.multiSet([
                ["audio_current_story", story.id],
                ["audio_playback_position", String(pos)],
                ["audio_was_playing", String(status.isPlaying ?? false)],
                [`progress_${story.id}`, String(pos)],
              ]).catch(() => {});
              if (status.didJustFinish) {
                setProgress(100);

                setCompletedStories(prev => {
                  const next = prev + 1;
                  AsyncStorage.setItem(
                    "completed_stories",
                    String(next)
                  ).catch(() => {});
                  return next;
                });

                (async () => {
                  const today = new Date().toISOString().slice(0,10);

                  const lastDay =
                    await AsyncStorage.getItem("last_listening_day");

                  if (lastDay !== today) {

                    const streak =
                      Number(
                        await AsyncStorage.getItem(
                          "listening_streak"
                        )
                      ) || 0;

                    const next = streak + 1;

                    setListeningStreak(next);

                    await AsyncStorage.multiSet([
                      ["listening_streak", String(next)],
                      ["last_listening_day", today],
                    ]);
                  }
                })().catch(() => {});

                setCurrentQueueIndex((index) => {

                  if (repeatMode === "one") {
                    playStory(story);
                    return index;
                  }

                  if (shuffle && queue.length > 1) {
                    const next =
                      Math.floor(Math.random() * queue.length);

                    return next;
                  }

                  if (index >= 0 && index + 1 < queue.length) {
                    return index + 1;
                  }

                  if (repeatMode === "all" && queue.length > 0) {
                    return 0;
                  }

                  setIsPlaying(false);
                  return index;
                });
              }
            }
          }
        );
        soundRef.current = sound;

        try {
          const values = await AsyncStorage.multiGet([
            "audio_current_story",
            "audio_playback_position",
            "audio_was_playing",
          ]);

          const savedStory = values[0][1];
          let savedPosition = Number(values[1][1] ?? "0");

          try {
            const storyPos = await AsyncStorage.getItem(`progress_${story.id}`);
            if (storyPos) {
              savedPosition = Number(storyPos);
            }
          } catch {}
          const wasPlaying = values[2][1] === "true";

          if (
            savedStory === story.id &&
            savedPosition > 0
          ) {
            await sound.setPositionAsync(savedPosition);

            if (!wasPlaying) {
              await sound.pauseAsync();
              setIsPlaying(false);
            } else {
              setIsPlaying(true);
            }
          } else {
            setIsPlaying(true);
          }

        } catch {
          setIsPlaying(true);
        }
      } catch (e) {
        console.error("AUDIO ERROR:", e);
        console.log("Story:", story.title);
        console.log("Audio URL:", uri);
        setIsPlaying(false);
      }
    },
    [history, speed, unloadSound, shuffle, repeatMode, queue]
  );


  const addToQueue = useCallback((story: AudioStory) => {
    setQueue((prev) => {
      if (prev.some((s) => s.id === story.id)) return prev;
      return [...prev, story];
    });
  }, []);



  const playStoryNext = useCallback((story: AudioStory) => {
    setQueue(prev => {

      const withoutStory = prev.filter(s => s.id !== story.id);

      const insertAt = Math.min(
        currentQueueIndex + 1,
        withoutStory.length
      );

      return [
        ...withoutStory.slice(0, insertAt),
        story,
        ...withoutStory.slice(insertAt),
      ];

    });
  }, [currentQueueIndex]);

  const playNext = useCallback(() => {
    setCurrentQueueIndex((index) => {
      if (index + 1 >= queue.length) return index;
      return index + 1;
    });
  }, [queue]);

  const playPrevious = useCallback(() => {
    setCurrentQueueIndex((index) => {
      if (index <= 0) return index;
      return index - 1;
    });
  }, []);


  const removeFromQueue = useCallback((storyId: string) => {
    setQueue(prev => prev.filter(s => s.id !== storyId));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentQueueIndex(-1);
  }, []);

  const moveQueueItemToTop = useCallback((storyId: string) => {
    setQueue(prev => {
      const story = prev.find(s => s.id === storyId);
      if (!story) return prev;

      return [
        story,
        ...prev.filter(s => s.id !== storyId)
      ];
    });
  }, []);

  const moveQueueItemToBottom = useCallback((storyId: string) => {
    setQueue(prev => {
      const story = prev.find(s => s.id === storyId);
      if (!story) return prev;

      return [
        ...prev.filter(s => s.id !== storyId),
        story
      ];
    });
  }, []);





  useEffect(() => {
    if (
      currentQueueIndex < 0 ||
      currentQueueIndex >= queue.length
    ) {
      return;
    }

    const story = queue[currentQueueIndex];

    if (!story) return;

    if (currentStory?.id === story.id) return;

    playStory(story);
  }, [
    currentQueueIndex,
    queue,
    currentStory?.id,
    playStory,
  ]);


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

  // Explicit pause (not a toggle) — used when the whole app backgrounds, or
  // when the user switches to the Video tab, so audio and video never play
  // on top of each other.
  const pauseAudio = useCallback(async () => {
    if (soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync();
        }
      } catch {}
    }
    setIsPlaying(false);
  }, []);

  // Pause audio whenever the app itself goes to background/inactive
  // (switching to another app, locking the phone, etc.) — matches the same
  // behavior already in place for video.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        pauseAudio();
      }
    });
    return () => sub.remove();
  }, [pauseAudio]);

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
    await AsyncStorage.setItem("audio_speed", String(s)).catch(() => {});
    if (soundRef.current) {
      try {
        await soundRef.current.setRateAsync(s, true);
      } catch {}
    }
  }, []);


  const toggleShuffle = useCallback(() => {
    setShuffle(prev => {
      const next = !prev;
      AsyncStorage.setItem("audio_shuffle", String(next)).catch(() => {});
      return next;
    });
  }, []);


  const toggleRepeat = useCallback(() => {
    setRepeatMode(prev => {
      const next =
        prev === "off"
          ? "all"
          : prev === "all"
          ? "one"
          : "off";

      AsyncStorage.setItem("audio_repeat", next).catch(() => {});
      return next;
    });
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
        queue,
        currentQueueIndex,
        setQueue,
        setCurrentQueueIndex,
        isPlaying,
        progress,
        speed,
        shuffle,
        repeatMode,
        playStory,
        addToQueue,
        playStoryNext,
        playNext,
        playPrevious,
        removeFromQueue,
        clearQueue,
        moveQueueItemToTop,
        moveQueueItemToBottom,
        togglePlay,
        pauseAudio,
        seekForward,
        seekBackward,
        setSpeed,
        toggleShuffle,
        toggleRepeat,
        stopPlayer,
        likedStories,
        savedStories,
        history,
        toggleLike,
        toggleSave,
        sleepTimerMinutes,
        listeningMinutes,
        completedStories,
        listeningStreak,
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
