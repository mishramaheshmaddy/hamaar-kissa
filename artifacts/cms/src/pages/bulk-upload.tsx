import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateAudioStory,
  useCreateVideo,
  useListCategories,
  getListAudioStoriesQueryKey,
  getListVideosQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type ContentType = "audio" | "video";

interface FileRow {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

interface SheetRow {
  rowNumber: number;
  raw: Record<string, any>;
  title: string;
  categoryName: string;
  categoryId: number | null;
  mediaUrl: string;
  thumbnailUrl: string;
  narrator: string;
  description: string;
  durationSeconds: number;
  published: boolean;
  valid: boolean;
  errors: string[];
  status: "pending" | "importing" | "done" | "error";
}

function cleanTitleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, "");
  return withoutExt.replace(/[_-]+/g, " ").trim();
}

function parseBoolean(value: any, fallback: boolean): boolean {
  if (value === undefined || value === null || value === "") return fallback;
  const s = String(value).trim().toLowerCase();
  if (["true", "yes", "1", "y", "haan", "han"].includes(s)) return true;
  if (["false", "no", "0", "n", "nahi"].includes(s)) return false;
  return fallback;
}

export default function BulkUpload() {
  const [contentType, setContentType] = useState<ContentType>("audio");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: categoriesRaw } = useListCategories({});
  const categories = categoriesRaw?.filter(
    (c) => contentType === "audio" ? (c.type === "audio" || c.type === "both") : (c.type === "video" || c.type === "both")
  ) ?? [];

  const createStory = useCreateAudioStory();
  const createVideo = useCreateVideo();

  // ---- Bulk file upload state ----
  const [batchCategoryId, setBatchCategoryId] = useState<string>("");
  const [batchNarrator, setBatchNarrator] = useState("");
  const [batchPublished, setBatchPublished] = useState(true);
  const [fileRows, setFileRows] = useState<FileRow[]>([]);
  const [thumbnailFiles, setThumbnailFiles] = useState<File[]>([]);
  const [uploadingBatch, setUploadingBatch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setFileRows(files.map((file) => ({ file, status: "pending" })));
  };

  const handleThumbnailsSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    setThumbnailFiles(Array.from(e.target.files ?? []));
  };

  // Matches a media file to a thumbnail by base filename, ignoring
  // extension and case — e.g. "peepara_wali_chudail.mp3" matches
  // "peepara_wali_chudail.jpg". No sheet needed for this simpler workflow.
  const baseName = (filename: string) => filename.replace(/\.[^/.]+$/, "").toLowerCase();
  const findMatchingThumbnail = (mediaFile: File): File | undefined =>
    thumbnailFiles.find((t) => baseName(t.name) === baseName(mediaFile.name));

  const uploadOneFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/media/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data?.error || "Upload failed");
    return data.url;
  };

  const runBatchUpload = async () => {
    if (!batchCategoryId) {
      toast({ title: "पहिले category चुनीं", variant: "destructive" });
      return;
    }
    if (fileRows.length === 0) return;

    setUploadingBatch(true);
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < fileRows.length; i++) {
      const row = fileRows[i];
      setFileRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "uploading" } : r)));
      try {
        const url = await uploadOneFile(row.file);
        const title = cleanTitleFromFilename(row.file.name);

        const matchingThumbnail = findMatchingThumbnail(row.file);
        const thumbnailUrl = matchingThumbnail ? await uploadOneFile(matchingThumbnail) : undefined;

        if (contentType === "audio") {
          await createStory.mutateAsync({
            data: {
              title,
              categoryId: parseInt(batchCategoryId),
              narrator: batchNarrator || "",
              durationSeconds: 0,
              description: "",
              thumbnailUrl,
              audioUrl: url,
              sourceType: "upload",
              published: batchPublished,
              sortOrder: 0,
            } as any,
          });
        } else {
          await createVideo.mutateAsync({
            data: {
              title,
              categoryId: parseInt(batchCategoryId),
              description: "",
              thumbnailUrl,
              videoUrl: url,
              sourceType: "upload",
              published: batchPublished,
              sortOrder: 0,
            } as any,
          });
        }

        setFileRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "done" } : r)));
        succeeded++;
      } catch (err) {
        setFileRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "error", error: err instanceof Error ? err.message : String(err) } : r))
        );
        failed++;
      }
    }

    setUploadingBatch(false);
    queryClient.invalidateQueries({ queryKey: contentType === "audio" ? getListAudioStoriesQueryKey() : getListVideosQueryKey() });
    toast({
      title: "Bulk upload complete",
      description: `${succeeded} सफल, ${failed} फेल`,
      variant: failed > 0 ? "destructive" : undefined,
    });
  };

  // ---- Sheet upload state ----
  const [sheetRows, setSheetRows] = useState<SheetRow[]>([]);
  const [sheetFileName, setSheetFileName] = useState<string | null>(null);
  const [importingSheet, setImportingSheet] = useState(false);
  const [sheetProgress, setSheetProgress] = useState(0);
  const sheetInputRef = useRef<HTMLInputElement>(null);

  const handleSheetSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSheetFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        // First row is automatically used as the field/header row.
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const rows: SheetRow[] = json.map((raw, idx) => {
          // Accept a few common header spellings so the sheet doesn't have
          // to match exact casing.
          const get = (...keys: string[]) => {
            for (const key of keys) {
              const foundKey = Object.keys(raw).find((k) => k.trim().toLowerCase() === key.toLowerCase());
              if (foundKey && raw[foundKey] !== "") return String(raw[foundKey]).trim();
            }
            return "";
          };

          const title = get("title", "naam", "name");
          const categoryName = get("category", "categoryname", "kism");
          const mediaUrl = get(contentType === "audio" ? "audiourl" : "videourl", "mediaurl", "url");
          const thumbnailUrl = get("thumbnailurl", "thumbnail", "image");
          const narrator = get("narrator");
          const description = get("description", "vivaran");
          const durationSeconds = Number(get("durationseconds", "duration")) || 0;
          const published = parseBoolean(get("published"), true);

          const category = categories.find(
            (c) => c.label.toLowerCase() === categoryName.toLowerCase() || c.name.toLowerCase() === categoryName.toLowerCase()
          );

          const errors: string[] = [];
          if (!title) errors.push("Title missing");
          if (!categoryName) errors.push("Category missing");
          else if (!category) errors.push(`Category "${categoryName}" not found`);
          if (!mediaUrl) errors.push(`${contentType === "audio" ? "audioUrl" : "videoUrl"} missing`);

          return {
            rowNumber: idx + 2, // +2: row 1 is the header, spreadsheets are 1-indexed
            raw,
            title,
            categoryName,
            categoryId: category?.id ?? null,
            mediaUrl,
            thumbnailUrl,
            narrator,
            description,
            durationSeconds,
            published,
            valid: errors.length === 0,
            errors,
            status: "pending",
          };
        });

        setSheetRows(rows);
      } catch (err) {
        toast({ title: "Could not read file", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const runSheetImport = async () => {
    const validRows = sheetRows.filter((r) => r.valid);
    if (validRows.length === 0) return;

    setImportingSheet(true);
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < sheetRows.length; i++) {
      const row = sheetRows[i];
      if (!row.valid) continue;

      setSheetRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "importing" } : r)));
      try {
        if (contentType === "audio") {
          await createStory.mutateAsync({
            data: {
              title: row.title,
              categoryId: row.categoryId!,
              narrator: row.narrator,
              durationSeconds: row.durationSeconds,
              description: row.description,
              thumbnailUrl: row.thumbnailUrl || undefined,
              audioUrl: row.mediaUrl,
              sourceType: "url",
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
              thumbnailUrl: row.thumbnailUrl || undefined,
              videoUrl: row.mediaUrl,
              sourceType: "url",
              published: row.published,
              sortOrder: 0,
            } as any,
          });
        }
        setSheetRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "done" } : r)));
        succeeded++;
      } catch (err) {
        setSheetRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "error", errors: [...r.errors, err instanceof Error ? err.message : String(err)] } : r))
        );
        failed++;
      }
      setSheetProgress(Math.round(((i + 1) / sheetRows.length) * 100));
    }

    setImportingSheet(false);
    queryClient.invalidateQueries({ queryKey: contentType === "audio" ? getListAudioStoriesQueryKey() : getListVideosQueryKey() });
    toast({
      title: "Sheet import complete",
      description: `${succeeded} सफल, ${failed} फेल`,
      variant: failed > 0 ? "destructive" : undefined,
    });
  };

  const validCount = sheetRows.filter((r) => r.valid).length;
  const invalidCount = sheetRows.length - validCount;

  // ---- Folder + Sheet (exact filename matching) state ----
  interface MatchSheetRow {
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
    published: boolean;
    errors: string[];
  }

  const [matchRows, setMatchRows] = useState<MatchSheetRow[]>([]);
  const [matchFiles, setMatchFiles] = useState<File[]>([]);
  const [matchThumbnailFiles, setMatchThumbnailFiles] = useState<File[]>([]);
  const [matchImporting, setMatchImporting] = useState(false);
  const [matchProgress, setMatchProgress] = useState(0);
  const [matchResults, setMatchResults] = useState<Record<string, "pending" | "importing" | "done" | "error">>({});
  const matchSheetInputRef = useRef<HTMLInputElement>(null);
  const matchFilesInputRef = useRef<HTMLInputElement>(null);
  const matchThumbnailInputRef = useRef<HTMLInputElement>(null);

  const handleMatchSheetSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const rows: MatchSheetRow[] = json.map((raw, idx) => {
          const get = (...keys: string[]) => {
            for (const key of keys) {
              const foundKey = Object.keys(raw).find((k) => k.trim().toLowerCase() === key.toLowerCase());
              if (foundKey && raw[foundKey] !== "") return String(raw[foundKey]).trim();
            }
            return "";
          };

          const filename = get("filename", "file", "file name");
          const thumbnailFilename = get("thumbnailfilename", "thumbnail filename", "thumbnail file");
          const title = get("title", "naam", "name");
          const categoryName = get("category", "categoryname", "kism");
          const narrator = get("narrator");
          const description = get("description", "vivaran");
          const thumbnailUrl = get("thumbnailurl", "thumbnail", "image");
          const durationSeconds = Number(get("durationseconds", "duration")) || 0;
          const published = parseBoolean(get("published"), true);

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
            published,
            errors,
          };
        });

        setMatchRows(rows);
        setMatchResults({});
      } catch (err) {
        toast({ title: "Could not read sheet", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleMatchFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMatchFiles(Array.from(e.target.files ?? []));
    setMatchResults({});
  };

  const handleMatchThumbnailsSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMatchThumbnailFiles(Array.from(e.target.files ?? []));
  };

  // Exact, case-insensitive filename matching — deterministic, no guessing.
  const matchedPairs = matchRows.map((row) => {
    const file = matchFiles.find((f) => f.name.toLowerCase() === row.filename.toLowerCase());
    const thumbnailFile = row.thumbnailFilename
      ? matchThumbnailFiles.find((f) => f.name.toLowerCase() === row.thumbnailFilename.toLowerCase())
      : undefined;
    return { row, file: file ?? null, thumbnailFile: thumbnailFile ?? null };
  });
  const unmatchedFiles = matchFiles.filter(
    (f) => !matchRows.some((r) => r.filename.toLowerCase() === f.name.toLowerCase())
  );
  const readyCount = matchedPairs.filter((p) => p.file && p.row.errors.length === 0).length;

  const runMatchImport = async () => {
    setMatchImporting(true);
    let succeeded = 0;
    let failed = 0;

    for (const { row, file, thumbnailFile } of matchedPairs) {
      if (!file || row.errors.length > 0) continue;
      setMatchResults((prev) => ({ ...prev, [row.filename]: "importing" }));
      try {
        const url = await uploadOneFile(file);
        // Prefer an actual matched thumbnail file over a plain thumbnailUrl
        // column, if both happen to be present.
        const thumbnailUrl = thumbnailFile ? await uploadOneFile(thumbnailFile) : (row.thumbnailUrl || undefined);
        if (contentType === "audio") {
          await createStory.mutateAsync({
            data: {
              title: row.title,
              categoryId: row.categoryId!,
              narrator: row.narrator,
              durationSeconds: row.durationSeconds,
              description: row.description,
              thumbnailUrl,
              audioUrl: url,
              sourceType: "upload",
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
              published: row.published,
              sortOrder: 0,
            } as any,
          });
        }
        setMatchResults((prev) => ({ ...prev, [row.filename]: "done" }));
        succeeded++;
      } catch (err) {
        setMatchResults((prev) => ({ ...prev, [row.filename]: "error" }));
        failed++;
      }
      setMatchProgress(Math.round(((succeeded + failed) / readyCount) * 100));
    }

    setMatchImporting(false);
    queryClient.invalidateQueries({ queryKey: contentType === "audio" ? getListAudioStoriesQueryKey() : getListVideosQueryKey() });
    toast({
      title: "Folder + Sheet import complete",
      description: `${succeeded} सफल, ${failed} फेल`,
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
          Upload many audio stories or videos at once — either a batch of files, or a spreadsheet of already-hosted content.
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant={contentType === "audio" ? "default" : "outline"} onClick={() => { setContentType("audio"); setFileRows([]); setSheetRows([]); }}>
          Audio Stories
        </Button>
        <Button variant={contentType === "video" ? "default" : "outline"} onClick={() => { setContentType("video"); setFileRows([]); setSheetRows([]); }}>
          Videos
        </Button>
      </div>

      <Tabs defaultValue="files">
        <TabsList>
          <TabsTrigger value="files">Upload Files</TabsTrigger>
          <TabsTrigger value="sheet">Upload Sheet (CSV/Excel)</TabsTrigger>
          <TabsTrigger value="match">Folder + Sheet (Matched)</TabsTrigger>
        </TabsList>

        {/* ---------------- FILES TAB ---------------- */}
        <TabsContent value="files" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                All files in this batch will be created under the same category. You can edit each item individually afterward.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category (applies to all files)</Label>
                  <Select value={batchCategoryId} onValueChange={setBatchCategoryId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.icon} {c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {contentType === "audio" && (
                  <div>
                    <Label>Narrator (optional, applies to all files)</Label>
                    <Input className="mt-1" value={batchNarrator} onChange={(e) => setBatchNarrator(e.target.value)} placeholder="Narrator name" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={batchPublished} onCheckedChange={setBatchPublished} />
                <Label>Publish immediately</Label>
              </div>

              <div>
                <Label>Select {contentType === "audio" ? "audio (.mp3, .wav, .m4a)" : "video (.mp4, .mov)"} files</Label>
                <div className="mt-1 flex items-center gap-3">
                  <Button type="button" variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                    <UploadCloud className="w-4 h-4" /> Choose Files
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {fileRows.length > 0 ? `${fileRows.length} file${fileRows.length === 1 ? "" : "s"} selected` : "No files chosen"}
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={contentType === "audio" ? "audio/*" : "video/*"}
                  onChange={handleFilesSelected}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Titles are auto-generated from filenames (underscores/dashes become spaces) — you can rename each item later.
                </p>
              </div>

              <div>
                <Label>Select thumbnail images (optional)</Label>
                <div className="mt-1 flex items-center gap-3">
                  <Button type="button" variant="outline" className="gap-2" onClick={() => thumbnailInputRef.current?.click()}>
                    <UploadCloud className="w-4 h-4" /> Choose Thumbnails
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {thumbnailFiles.length > 0 ? `${thumbnailFiles.length} image${thumbnailFiles.length === 1 ? "" : "s"} selected` : "No files chosen"}
                  </span>
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
                  Matched to a media file by same filename (ignoring extension) — e.g. <code>chudail.mp3</code> pairs automatically with <code>chudail.jpg</code>. Files without a matching thumbnail just won't have one; you can add it later.
                </p>
              </div>

              {fileRows.length > 0 && (
                <div className="border rounded-lg divide-y">
                  {fileRows.map((row, i) => {
                    const thumb = findMatchingThumbnail(row.file);
                    return (
                    <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                      <span className="truncate flex-1">{cleanTitleFromFilename(row.file.name)}</span>
                      <span className="ml-2 flex items-center gap-1">
                        {thumb ? (
                          <Badge variant="outline" className="gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> Thumbnail matched</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">No thumbnail</span>
                        )}
                      </span>
                      <span className="ml-3 flex items-center gap-1">
                        {row.status === "pending" && <Badge variant="outline">Pending</Badge>}
                        {row.status === "uploading" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                        {row.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                        {row.status === "error" && (
                          <span className="flex items-center gap-1 text-red-600" title={row.error}>
                            <XCircle className="w-4 h-4" /> Failed
                          </span>
                        )}
                      </span>
                    </div>
                    );
                  })}
                </div>
              )}

              <Button onClick={runBatchUpload} disabled={fileRows.length === 0 || uploadingBatch} className="gap-2">
                {uploadingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                {uploadingBatch ? "Uploading…" : `Upload ${fileRows.length || ""} File${fileRows.length === 1 ? "" : "s"}`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- SHEET TAB ---------------- */}
        <TabsContent value="sheet" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Upload a .csv or .xlsx file. The first row is read as column headers automatically. Expected columns:</p>
                <p className="font-mono text-xs bg-muted p-2 rounded">
                  {contentType === "audio"
                    ? "title, category, audioUrl, narrator (optional), description (optional), thumbnailUrl (optional), durationSeconds (optional), published (optional)"
                    : "title, category, videoUrl, description (optional), thumbnailUrl (optional), published (optional)"}
                </p>
                <p>
                  <strong>category</strong> must match an existing category's name exactly. <strong>{contentType === "audio" ? "audioUrl" : "videoUrl"}</strong> must be a direct link to an already-hosted file (this tool doesn't upload files from the sheet — use the "Upload Files" tab for that).
                </p>
              </div>

              <div>
                <Label>Select sheet</Label>
                <div className="mt-1 flex items-center gap-3">
                  <Button type="button" variant="outline" className="gap-2" onClick={() => sheetInputRef.current?.click()}>
                    <FileSpreadsheet className="w-4 h-4" /> Choose Sheet
                  </Button>
                  <span className="text-sm text-muted-foreground">{sheetFileName ?? "No file chosen"}</span>
                </div>
                <input
                  ref={sheetInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleSheetSelected}
                  className="hidden"
                />
              </div>

              {sheetRows.length > 0 && (
                <>
                  <div className="flex gap-3 text-sm">
                    <Badge variant="outline" className="gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> {validCount} valid</Badge>
                    {invalidCount > 0 && (
                      <Badge variant="outline" className="gap-1"><XCircle className="w-3 h-3 text-red-600" /> {invalidCount} invalid</Badge>
                    )}
                  </div>

                  <div className="border rounded-lg overflow-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sheetRows.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell>{row.rowNumber}</TableCell>
                            <TableCell className="max-w-[220px] truncate">{row.title || <em className="text-muted-foreground">missing</em>}</TableCell>
                            <TableCell>{row.categoryName || <em className="text-muted-foreground">missing</em>}</TableCell>
                            <TableCell>
                              {row.status === "done" && <Badge className="gap-1"><CheckCircle2 className="w-3 h-3" /> Imported</Badge>}
                              {row.status === "importing" && <Loader2 className="w-4 h-4 animate-spin" />}
                              {row.status === "error" && (
                                <span className="text-red-600 text-xs" title={row.errors.join("; ")}>Failed</span>
                              )}
                              {row.status === "pending" && row.valid && <Badge variant="outline">Ready</Badge>}
                              {row.status === "pending" && !row.valid && (
                                <span className="text-red-600 text-xs" title={row.errors.join("; ")}>{row.errors[0]}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {importingSheet && <Progress value={sheetProgress} />}

                  <Button onClick={runSheetImport} disabled={validCount === 0 || importingSheet} className="gap-2">
                    {importingSheet ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                    {importingSheet ? "Importing…" : `Import ${validCount} Valid Row${validCount === 1 ? "" : "s"}`}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- FOLDER + SHEET (MATCHED) TAB ---------------- */}
        <TabsContent value="match" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  The most reliable way to bulk-upload real files with full metadata. Your sheet references each file by its
                  <strong> exact filename</strong> — no guessing, no fuzzy matching. Every row is matched to a file with a
                  precise, case-insensitive comparison, and you'll see exactly what matched before anything is created.
                </p>
                <p className="font-mono text-xs bg-muted p-2 rounded">
                  filename, title, category, thumbnailFilename (optional), narrator (optional), description (optional), thumbnailUrl (optional), durationSeconds (optional), published (optional)
                </p>
                <p><strong>filename</strong> must exactly match the name of a file you select below (e.g. <code>peepara_wali_chudail.mp3</code>).</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Step 1 — Select the sheet</Label>
                  <div className="mt-1 flex items-center gap-3">
                    <Button type="button" variant="outline" className="gap-2" onClick={() => matchSheetInputRef.current?.click()}>
                      <FileSpreadsheet className="w-4 h-4" /> Choose Sheet
                    </Button>
                  </div>
                  <input
                    ref={matchSheetInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleMatchSheetSelected}
                    className="hidden"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {matchRows.length > 0 ? `${matchRows.length} rows read.` : "No file chosen"}
                  </p>
                </div>
                <div>
                  <Label>Step 2 — Select the matching files</Label>
                  <div className="mt-1 flex items-center gap-3">
                    <Button type="button" variant="outline" className="gap-2" onClick={() => matchFilesInputRef.current?.click()}>
                      <UploadCloud className="w-4 h-4" /> Choose Files
                    </Button>
                  </div>
                  <input
                    ref={matchFilesInputRef}
                    type="file"
                    multiple
                    accept={contentType === "audio" ? "audio/*" : "video/*"}
                    onChange={handleMatchFilesSelected}
                    className="hidden"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {matchFiles.length > 0 ? `${matchFiles.length} files selected.` : "No files chosen"}
                  </p>
                </div>
                <div>
                  <Label>Step 3 — Select thumbnails (optional)</Label>
                  <div className="mt-1 flex items-center gap-3">
                    <Button type="button" variant="outline" className="gap-2" onClick={() => matchThumbnailInputRef.current?.click()}>
                      <UploadCloud className="w-4 h-4" /> Choose Thumbnails
                    </Button>
                  </div>
                  <input
                    ref={matchThumbnailInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleMatchThumbnailsSelected}
                    className="hidden"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {matchThumbnailFiles.length > 0 ? `${matchThumbnailFiles.length} images selected.` : "No files chosen"}
                    {" "}Matched via your sheet's <code>thumbnailFilename</code> column.
                  </p>
                </div>
              </div>

              {matchRows.length > 0 && matchFiles.length > 0 && (
                <>
                  <div className="flex gap-3 text-sm flex-wrap">
                    <Badge variant="outline" className="gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> {readyCount} matched & ready</Badge>
                    {matchedPairs.some((p) => !p.file) && (
                      <Badge variant="outline" className="gap-1"><XCircle className="w-3 h-3 text-red-600" /> {matchedPairs.filter((p) => !p.file).length} rows missing a file</Badge>
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
                        {matchedPairs.map(({ row, file, thumbnailFile }) => (
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
                              {matchResults[row.filename] === "done" && <Badge className="gap-1"><CheckCircle2 className="w-3 h-3" /> Imported</Badge>}
                              {matchResults[row.filename] === "importing" && <Loader2 className="w-4 h-4 animate-spin" />}
                              {matchResults[row.filename] === "error" && <span className="text-red-600 text-xs">Failed</span>}
                              {!matchResults[row.filename] && row.errors.length > 0 && (
                                <span className="text-red-600 text-xs" title={row.errors.join("; ")}>{row.errors[0]}</span>
                              )}
                              {!matchResults[row.filename] && row.errors.length === 0 && !file && (
                                <span className="text-red-600 text-xs">No matching file selected</span>
                              )}
                              {!matchResults[row.filename] && row.errors.length === 0 && file && (
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

                  {matchImporting && <Progress value={matchProgress} />}

                  <Button onClick={runMatchImport} disabled={readyCount === 0 || matchImporting} className="gap-2">
                    {matchImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                    {matchImporting ? "Importing…" : `Upload & Import ${readyCount} Matched Item${readyCount === 1 ? "" : "s"}`}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
