import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateAudioStory,
  useCreateVideo,
  useListCategories,
  useListAudioStories,
  useListVideos,
  getListAudioStoriesQueryKey,
  getListVideosQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, Loader2, ImageIcon, AlertTriangle } from "lucide-react";

type ContentType = "audio" | "video";
type RowStatus = "ready" | "duplicate" | "missing-file" | "invalid";

interface SheetRow {
  rowNumber: number;
  filename: string;
  thumbnailFilename: string;
  title: string;
  categoryName: string;
  categoryId: number | null;
  narrator: string;
  description: string;
  thumbnailUrl: string;
  durationSeconds: number;
  searchTags: string;
  published: boolean;
  errors: string[];
}

function parseBoolean(value: any, fallback: boolean): boolean {
  if (value === undefined || value === null || value === "") return fallback;
  const s = String(value).trim().toLowerCase();
  if (["true", "yes", "1", "y", "haan", "han"].includes(s)) return true;
  if (["false", "no", "0", "n", "nahi"].includes(s)) return false;
  return fallback;
}

// Ignores extension and case, so a sheet can reference "Kaal_Bhairav_bhojpuri"
// and it will match "Kaal_Bhairav_bhojpuri.mp3" without the extension typed out.
const baseName = (filename: string) => filename.replace(/\.[^/.]+$/, "").trim().toLowerCase();

// Normalizes a title for duplicate detection — trims, lowercases, and
// collapses whitespace so "Kaal Bhairav  Mandir " and "kaal bhairav mandir"
// are recognized as the same story already in the database.
const normalizeTitle = (title: string) => title.trim().toLowerCase().replace(/\s+/g, " ");

// Reads real audio duration client-side before upload, so bulk-imported
// stories don't all sit at 0:00 unless the sheet explicitly provided one.
function readAudioDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    try {
      const audio = new Audio();
      const url = URL.createObjectURL(file);
      const cleanup = () => URL.revokeObjectURL(url);
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        const seconds = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0;
        cleanup();
        resolve(seconds);
      };
      audio.onerror = () => {
        cleanup();
        resolve(0);
      };
      audio.src = url;
    } catch {
      resolve(0);
    }
  });
}

export default function BulkUpload() {
  const [contentType, setContentType] = useState<ContentType>("audio");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categoriesRaw } = useListCategories({});
  const categories = categoriesRaw?.filter(
    (c) => contentType === "audio" ? (c.type === "audio" || c.type === "both") : (c.type === "video" || c.type === "both")
  ) ?? [];

  // Pulled in purely to detect duplicates — if a story/video with the same
  // title already exists, we flag the row instead of silently creating a
  // second copy (the root cause of the "double upload" problem).
  const { data: existingAudio } = useListAudioStories({}, { query: { enabled: contentType === "audio" } });
  const { data: existingVideos } = useListVideos({}, { query: { enabled: contentType === "video" } });
  const existingTitles = useMemo(() => {
    const items = contentType === "audio" ? existingAudio : existingVideos;
    return new Set((items ?? []).map((i) => normalizeTitle(i.title)));
  }, [contentType, existingAudio, existingVideos]);

  const createStory = useCreateAudioStory();
  const createVideo = useCreateVideo();

  const [publishDefault, setPublishDefault] = useState(true);
  const [allowDuplicates, setAllowDuplicates] = useState(false);

  const [rows, setRows] = useState<SheetRow[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [thumbnailFiles, setThumbnailFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Record<number, "importing" | "done" | "error">>({});

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const sheetInputRef = useRef<HTMLInputElement>(null);

  const resetAll = () => {
    setRows([]);
    setMediaFiles([]);
    setThumbnailFiles([]);
    setResults({});
  };

  const handleMediaSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaFiles(Array.from(e.target.files ?? []));
    setResults({});
  };

  const handleThumbnailsSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    setThumbnailFiles(Array.from(e.target.files ?? []));
  };

  const handleSheetSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const parsed: SheetRow[] = json.map((raw, idx) => {
          const get = (...keys: string[]) => {
            for (const key of keys) {
              const foundKey = Object.keys(raw).find((k) => k.trim().toLowerCase() === key.toLowerCase());
              if (foundKey && raw[foundKey] !== "") return String(raw[foundKey]).trim();
            }
            return "";
          };

          const filename = get("filename", "file", "file name");
          const thumbnailFilename = get("thumbnailfilename", "thumbnail filename", "thumbnail file", "thumbnail");
          const title = get("title", "naam", "name");
          const categoryName = get("category", "categoryname", "kism");
          const narrator = get("narrator");
          const description = get("description", "vivaran");
          const thumbnailUrl = get("thumbnailurl", "thumbnail url", "image");
          const durationSeconds = Number(get("durationseconds", "duration")) || 0;
          const searchTags = get("searchtags", "search tags", "keywords", "aliases");
          const published = parseBoolean(get("published"), publishDefault);

          const category = categories.find(
            (c) => c.label.toLowerCase() === categoryName.toLowerCase() || c.name.toLowerCase() === categoryName.toLowerCase()
          );

          const errors: string[] = [];
          if (!filename) errors.push("filename column missing");
          if (!title) errors.push("Title missing");
          if (!categoryName) errors.push("Category missing");
          else if (!category) errors.push(`Category "${categoryName}" not found`);

          return {
            rowNumber: idx + 2,
            filename,
            thumbnailFilename,
            title,
            categoryName,
            categoryId: category?.id ?? null,
            narrator,
            description,
            thumbnailUrl,
            durationSeconds,
            searchTags,
            published,
            errors,
          };
        });

        setRows(parsed);
        setResults({});
      } catch (err) {
        toast({ title: "Could not read sheet", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  // Match every sheet row to its media file and (optional) thumbnail file,
  // and flag rows whose title already exists so we never silently create a
  // second copy of the same story.
  const matchedRows = rows.map((row) => {
    const file = mediaFiles.find((f) => baseName(f.name) === baseName(row.filename)) ?? null;
    const thumbnailFile = row.thumbnailFilename
      ? thumbnailFiles.find((f) => baseName(f.name) === baseName(row.thumbnailFilename)) ?? null
      : null;
    const isDuplicate = !allowDuplicates && !!row.title && existingTitles.has(normalizeTitle(row.title));

    let status: RowStatus = "ready";
    if (row.errors.length > 0) status = "invalid";
    else if (isDuplicate) status = "duplicate";
    else if (!file) status = "missing-file";

    return { row, file, thumbnailFile, status };
  });

  const unmatchedFiles = mediaFiles.filter(
    (f) => !rows.some((r) => baseName(r.filename) === baseName(f.name))
  );

  const readyCount = matchedRows.filter((m) => m.status === "ready").length;
  const duplicateCount = matchedRows.filter((m) => m.status === "duplicate").length;

  const uploadOneFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/media/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data?.error || "Upload failed");
    return data.url;
  };

  const runImport = async () => {
    setImporting(true);
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const readyRows = matchedRows.filter((m) => m.status === "ready");

    for (const { row, file, status } of matchedRows) {
      if (status === "invalid" || status === "missing-file") continue;
      if (status === "duplicate") {
        skipped++;
        continue;
      }
      if (!file) continue;

      const thumbnailFile = row.thumbnailFilename
        ? thumbnailFiles.find((f) => baseName(f.name) === baseName(row.thumbnailFilename)) ?? null
        : null;

      setResults((prev) => ({ ...prev, [row.rowNumber]: "importing" }));
      try {
        const url = await uploadOneFile(file);
        const thumbnailUrl = thumbnailFile ? await uploadOneFile(thumbnailFile) : (row.thumbnailUrl || undefined);
        const durationSeconds = row.durationSeconds || (contentType === "audio" ? await readAudioDurationSeconds(file) : 0);

        if (contentType === "audio") {
          await createStory.mutateAsync({
            data: {
              title: row.title,
              categoryId: row.categoryId!,
              narrator: row.narrator,
              durationSeconds,
              description: row.description,
              thumbnailUrl,
              audioUrl: url,
              sourceType: "upload",
              searchTags: row.searchTags,
              published: row.published,
              sortOrder: 0,
            } as any,
          });
        } else {
          await createVideo.mutateAsync({
            data: {
              title: row.title,
              categoryId: row.categoryId!,
              description: row.description,
              thumbnailUrl,
              videoUrl: url,
              sourceType: "upload",
              searchTags: row.searchTags,
              published: row.published,
              sortOrder: 0,
            } as any,
          });
        }
        // Recorded locally too, so a second row in the same sheet sharing a
        // title (or an accidental double-click of Import) can't slip a
        // duplicate through mid-batch.
        existingTitles.add(normalizeTitle(row.title));
        setResults((prev) => ({ ...prev, [row.rowNumber]: "done" }));
        succeeded++;
      } catch (err) {
        setResults((prev) => ({ ...prev, [row.rowNumber]: "error" }));
        failed++;
      }
      setProgress(Math.round(((succeeded + failed) / Math.max(readyRows.length, 1)) * 100));
    }

    setImporting(false);
    queryClient.invalidateQueries({ queryKey: contentType === "audio" ? getListAudioStoriesQueryKey() : getListVideosQueryKey() });
    toast({
      title: "Bulk upload complete",
      description: `${succeeded} सफल, ${failed} फेल${skipped > 0 ? `, ${skipped} duplicate skipped` : ""}`,
      variant: failed > 0 ? "destructive" : undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UploadCloud className="w-6 h-6 text-primary" /> Bulk Upload
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select your media files, thumbnails, and a details sheet — everything is matched by filename and imported together.
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant={contentType === "audio" ? "default" : "outline"} onClick={() => { setContentType("audio"); resetAll(); }}>
          Audio Stories
        </Button>
        <Button variant={contentType === "video" ? "default" : "outline"} onClick={() => { setContentType("video"); resetAll(); }}>
          Videos
        </Button>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              Your sheet references each file by its <strong>exact filename</strong> (extension optional, e.g.{" "}
              <code>peepara_wali_chudail</code> matches <code>peepara_wali_chudail.mp3</code>). Every row is matched to the
              files you select below with a precise, case-insensitive comparison — nothing is created until you review the
              table and click Import.
            </p>
            <p className="font-mono text-xs bg-muted p-2 rounded">
              filename, title, category, thumbnailFilename (optional), narrator (optional), description (optional),
              thumbnailUrl (optional — used only if no thumbnailFilename file is matched), durationSeconds (optional —
              auto-detected from the audio file if left blank), searchTags (optional — comma-separated Hinglish/English
              spellings to help search), published (optional)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={publishDefault} onCheckedChange={setPublishDefault} />
            <Label>Publish immediately (rows without a "published" column use this)</Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={allowDuplicates} onCheckedChange={setAllowDuplicates} />
            <Label>Allow duplicates (off by default — rows whose title already exists are skipped)</Label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Step 1 — Select media files</Label>
              <div className="mt-1 flex items-center gap-3">
                <Button type="button" variant="outline" className="gap-2" onClick={() => mediaInputRef.current?.click()}>
                  <UploadCloud className="w-4 h-4" /> Choose Files
                </Button>
              </div>
              <input
                ref={mediaInputRef}
                type="file"
                multiple
                accept={contentType === "audio" ? "audio/*" : "video/*"}
                onChange={handleMediaSelected}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {mediaFiles.length > 0 ? `${mediaFiles.length} files selected.` : "No files chosen"}
              </p>
            </div>
            <div>
              <Label>Step 2 — Select thumbnails (optional)</Label>
              <div className="mt-1 flex items-center gap-3">
                <Button type="button" variant="outline" className="gap-2" onClick={() => thumbnailInputRef.current?.click()}>
                  <ImageIcon className="w-4 h-4" /> Choose Thumbnails
                </Button>
              </div>
              <input
                ref={thumbnailInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleThumbnailsSelected}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {thumbnailFiles.length > 0 ? `${thumbnailFiles.length} images selected.` : "No files chosen"}
                {" "}Matched via your sheet's <code>thumbnailFilename</code> column.
              </p>
            </div>
            <div>
              <Label>Step 3 — Select the sheet</Label>
              <div className="mt-1 flex items-center gap-3">
                <Button type="button" variant="outline" className="gap-2" onClick={() => sheetInputRef.current?.click()}>
                  <FileSpreadsheet className="w-4 h-4" /> Choose Sheet
                </Button>
              </div>
              <input
                ref={sheetInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleSheetSelected}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {rows.length > 0 ? `${rows.length} rows read.` : "No file chosen"}
              </p>
            </div>
          </div>

          {rows.length > 0 && mediaFiles.length > 0 && (
            <>
              <div className="flex gap-3 text-sm flex-wrap">
                <Badge variant="outline" className="gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> {readyCount} matched & ready</Badge>
                {duplicateCount > 0 && (
                  <Badge variant="outline" className="gap-1"><AlertTriangle className="w-3 h-3 text-amber-600" /> {duplicateCount} already exist (will skip)</Badge>
                )}
                {matchedRows.some((m) => m.status === "missing-file") && (
                  <Badge variant="outline" className="gap-1"><XCircle className="w-3 h-3 text-red-600" /> {matchedRows.filter((m) => m.status === "missing-file").length} rows missing a file</Badge>
                )}
                {unmatchedFiles.length > 0 && (
                  <Badge variant="outline" className="gap-1"><XCircle className="w-3 h-3 text-amber-600" /> {unmatchedFiles.length} files not in sheet (skipped)</Badge>
                )}
              </div>

              <div className="border rounded-lg overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Filename</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Thumbnail</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchedRows.map(({ row, thumbnailFile, status }) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell className="max-w-[180px] truncate font-mono text-xs">{row.filename || <em className="text-muted-foreground">missing</em>}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{row.title}</TableCell>
                        <TableCell>{row.categoryName}</TableCell>
                        <TableCell>
                          {thumbnailFile ? (
                            <Badge variant="outline" className="gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> Matched</Badge>
                          ) : row.thumbnailFilename ? (
                            <span className="text-xs text-red-600">Not found</span>
                          ) : row.thumbnailUrl ? (
                            <span className="text-xs text-muted-foreground">URL</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {results[row.rowNumber] === "done" && <Badge className="gap-1"><CheckCircle2 className="w-3 h-3" /> Imported</Badge>}
                          {results[row.rowNumber] === "importing" && <Loader2 className="w-4 h-4 animate-spin" />}
                          {results[row.rowNumber] === "error" && <span className="text-red-600 text-xs">Failed</span>}
                          {!results[row.rowNumber] && status === "invalid" && (
                            <span className="text-red-600 text-xs" title={row.errors.join("; ")}>{row.errors[0]}</span>
                          )}
                          {!results[row.rowNumber] && status === "missing-file" && (
                            <span className="text-red-600 text-xs">No matching file selected</span>
                          )}
                          {!results[row.rowNumber] && status === "duplicate" && (
                            <span className="text-amber-600 text-xs" title="A story/video with this exact title already exists — skipped to avoid a duplicate">Already exists — skip</span>
                          )}
                          {!results[row.rowNumber] && status === "ready" && (
                            <Badge variant="outline">Ready</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {unmatchedFiles.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Not in sheet, will be skipped: {unmatchedFiles.map((f) => f.name).join(", ")}
                </p>
              )}

              {importing && <Progress value={progress} />}

              <Button onClick={runImport} disabled={readyCount === 0 || importing} className="gap-2">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                {importing ? "Importing…" : `Upload & Import ${readyCount} Item${readyCount === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
