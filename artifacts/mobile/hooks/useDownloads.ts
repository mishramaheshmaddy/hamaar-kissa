import * as SQLite from "expo-sqlite";
import { useEffect, useState, useCallback } from "react";
import { deleteDownload, getFileSize } from "@/lib/downloadManager";
import { Platform } from "react-native";

export interface DownloadedStory {
  storyId: string;
  title: string;
  thumbnail: string;
  duration: number;
  category: string;
  narrator: string;
  localPath: string;
  fileSize: number;
  downloadedAt: string;
}

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync("hamaar_kissa_downloads.db");
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS downloads (
        storyId TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        thumbnail TEXT,
        duration INTEGER,
        category TEXT,
        narrator TEXT,
        localPath TEXT NOT NULL,
        fileSize INTEGER,
        downloadedAt TEXT NOT NULL
      );
    `);
  }
  return db;
}

export function useDownloads() {
  const [downloads, setDownloads] = useState<DownloadedStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSize, setTotalSize] = useState(0);

  const loadDownloads = useCallback(async () => {
    if (Platform.OS === "web") { setLoading(false); return; }
    try {
      const database = await getDb();
      const rows = await database.getAllAsync<DownloadedStory>(
        "SELECT * FROM downloads ORDER BY downloadedAt DESC"
      );
      setDownloads(rows);
      const size = rows.reduce((acc, r) => acc + (r.fileSize || 0), 0);
      setTotalSize(size);
    } catch (e) {
      console.error("loadDownloads error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDownloads(); }, [loadDownloads]);

  const addDownload = useCallback(async (story: DownloadedStory) => {
    if (Platform.OS === "web") return;
    const database = await getDb();
    await database.runAsync(
      `INSERT OR REPLACE INTO downloads 
       (storyId, title, thumbnail, duration, category, narrator, localPath, fileSize, downloadedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [story.storyId, story.title, story.thumbnail, story.duration,
       story.category, story.narrator, story.localPath, story.fileSize, story.downloadedAt]
    );
    await loadDownloads();
  }, [loadDownloads]);

  const removeDownload = useCallback(async (storyId: string) => {
    if (Platform.OS === "web") return;
    await deleteDownload(storyId);
    const database = await getDb();
    await database.runAsync("DELETE FROM downloads WHERE storyId = ?", [storyId]);
    await loadDownloads();
  }, [loadDownloads]);

  const isDownloaded = useCallback((storyId: string): boolean => {
    return downloads.some(d => d.storyId === storyId);
  }, [downloads]);

  const getLocalPath = useCallback((storyId: string): string | null => {
    const d = downloads.find(d => d.storyId === storyId);
    return d ? d.localPath : null;
  }, [downloads]);

  const clearAll = useCallback(async () => {
    if (Platform.OS === "web") return;
    for (const d of downloads) {
      await deleteDownload(d.storyId);
    }
    const database = await getDb();
    await database.runAsync("DELETE FROM downloads");
    await loadDownloads();
  }, [downloads, loadDownloads]);

  return { downloads, loading, totalSize, addDownload, removeDownload, isDownloaded, getLocalPath, clearAll, refresh: loadDownloads };
}
