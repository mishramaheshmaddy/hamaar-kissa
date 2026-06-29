import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

const DOWNLOAD_DIR =
  (FileSystem.documentDirectory ?? "file:///") +
  "hamaar_kissa_downloads/";

export async function ensureDownloadDir() {
  const info = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
  }
}

export function getLocalPath(storyId: string): string {
  return DOWNLOAD_DIR + "story_" + storyId + ".mp3";
}

export async function isDownloaded(storyId: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const path = getLocalPath(storyId);
  const info = await FileSystem.getInfoAsync(path);
  return info.exists;
}

export async function deleteDownload(storyId: string): Promise<void> {
  const path = getLocalPath(storyId);
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) {
    await FileSystem.deleteAsync(path, { idempotent: true });
  }
}

export async function downloadAudio(
  storyId: string,
  audioUrl: string,
  onProgress: (progress: number) => void
): Promise<string> {
  await ensureDownloadDir();
  const localPath = getLocalPath(storyId);

  const downloadResumable = FileSystem.createDownloadResumable(
    audioUrl,
    localPath,
    {},
    (downloadProgress) => {
      const progress =
        downloadProgress.totalBytesWritten /
        downloadProgress.totalBytesExpectedToWrite;
      onProgress(Math.round(progress * 100));
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result) throw new Error("Download failed");
  return result.uri;
}

export async function getFileSize(storyId: string): Promise<number> {
  const path = getLocalPath(storyId);
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists && "size" in info) return info.size ?? 0;
  return 0;
}
