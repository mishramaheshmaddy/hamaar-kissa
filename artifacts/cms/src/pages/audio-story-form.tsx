import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateAudioStory,
  useUpdateAudioStory,
  useGetAudioStory,
  useListCategories,
  getListAudioStoriesQueryKey,
  useListHomeSections
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save, Upload } from "lucide-react";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  categoryId: z.coerce.number().min(1, "Category is required"),
  narrator: z.string().min(1, "Narrator is required"),
  durationSeconds: z.coerce.number().min(1, "Duration is required"),
  description: z.string().min(1, "Description is required"),
  thumbnailUrl: z.string().optional(),
  audioUrl: z.string().min(1, "Audio URL is required"),
  sourceType: z.string().min(1, "Source type is required"),
  searchTags: z.string().optional(),
  published: z.boolean().default(false),
  sortOrder: z.coerce.number().min(0).default(0),
  homeSectionId: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof schema>;

// Reads real duration client-side from the selected audio file, so
// "Duration (Seconds)" doesn't have to be typed in by hand.
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

export default function AudioStoryForm() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const isNew = !params.id || params.id === "new";
  const id = isNew ? null : parseInt(params.id!);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: story, isLoading } = useGetAudioStory(id!, { query: { enabled: !!id, queryKey: ["audio-story", id!] } });
  const { data: categoriesRaw } = useListCategories({ request: { headers: { "Cache-Control": "no-cache" } } });
  const categories = categoriesRaw?.filter((c) => c.type === "audio" || c.type === "both");
  
  // Fetch home sections for dropdown
  const [homeSections, setHomeSections] = useState<{id: number; title: string}[]>([]);
  useEffect(() => {
    fetch("/api/home-sections/all", { credentials: "include", cache: "no-store" })
      .then(r => r.json())
      .then(data => setHomeSections(data))
      .catch(() => {});
  }, []);
  
  const createStory = useCreateAudioStory();
  const updateStory = useUpdateAudioStory();

  const [isUploading, setIsUploading] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      categoryId: undefined,
      narrator: "",
      durationSeconds: 0,
      description: "",
      thumbnailUrl: "",
      audioUrl: "",
      sourceType: "upload",
      searchTags: "",
      published: false,
      sortOrder: 0,
      homeSectionId: undefined,
    },
  });

  useEffect(() => {
    if (story && !isNew && categories && categories.length > 0) {
      form.reset({
        title: story.title,
        categoryId: story.categoryId || undefined,
        narrator: story.narrator,
        durationSeconds: story.durationSeconds,
        description: story.description,
        thumbnailUrl: story.thumbnailUrl || "",
        audioUrl: story.audioUrl,
        sourceType: story.sourceType,
        searchTags: story.searchTags || "",
        published: story.published,
        sortOrder: story.sortOrder,
        homeSectionId: story.homeSectionId || undefined,
      });
      if (story.categoryId) {
        setTimeout(() => { form.setValue("categoryId", story.categoryId!); }, 500);
      }
    }
  }, [story, isNew]);

  const onSubmit = (data: FormValues) => {
    if (isNew) {
      createStory.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListAudioStoriesQueryKey() });
            toast({ title: "Audio story created" });
            setLocation("/audio-stories");
          },
          onError: () => toast({ title: "Failed to create story", variant: "destructive" })
        }
      );
    } else {
      updateStory.mutate(
        { id: id!, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListAudioStoriesQueryKey() });
            toast({ title: "Audio story updated" });
            setLocation("/audio-stories");
          },
          onError: () => toast({ title: "Failed to update story", variant: "destructive" })
        }
      );
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: "audioUrl" | "thumbnailUrl") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    // Audio duration is read from the file itself before uploading, so the
    // Duration field fills in automatically instead of being typed by hand.
    if (fieldName === "audioUrl") {
      readAudioDurationSeconds(file).then((seconds) => {
        if (seconds > 0) {
          form.setValue("durationSeconds", seconds);
        }
      });
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        form.setValue(fieldName, data.url);
        toast({ title: "Upload successful" });
      } else {
        throw new Error("No URL returned");
      }
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const isPending = createStory.isPending || updateStory.isPending;

  if (isLoading || (!isNew && !categoriesRaw)) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sourceType = form.watch("sourceType");

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/audio-stories")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-3xl font-bold">{isNew ? "New Audio Story" : "Edit Audio Story"}</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Story title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select 
                        onValueChange={(val) => field.onChange(parseInt(val))} 
                        value={field.value ? String(field.value) : ""}
                        defaultValue={field.value ? String(field.value) : ""}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                              {cat.icon} {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="narrator"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Narrator</FormLabel>
                      <FormControl>
                        <Input placeholder="Narrator name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="durationSeconds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (Seconds) — auto-fills on upload</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g. 180" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Story description" rows={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="searchTags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Search Keywords (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Alternate spellings people might search, comma-separated e.g. peepara wali chudail, pipra wali chudail, bhoot pret kahani"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">
                      Add English/Hinglish spellings so people find this story even if they don't type it in Devanagari.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4 border p-4 rounded-lg bg-muted/20">
                <h3 className="font-semibold">Media Files</h3>
                
                <FormField
                  control={form.control}
                  name="thumbnailUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thumbnail URL (Optional)</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <Button type="button" variant="outline" onClick={() => imageInputRef.current?.click()} disabled={isUploading}>
                          <Upload className="w-4 h-4 mr-2" /> Upload
                        </Button>
                        <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "thumbnailUrl")} />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sourceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Audio Source Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="upload">Direct Upload</SelectItem>
                          <SelectItem value="url">External URL</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="audioUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Audio URL</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input placeholder="https://..." {...field} disabled={sourceType === "upload" && !field.value} />
                        </FormControl>
                        {sourceType === "upload" && (
                          <>
                            <Button type="button" variant="outline" onClick={() => audioInputRef.current?.click()} disabled={isUploading}>
                              <Upload className="w-4 h-4 mr-2" /> Upload Audio
                            </Button>
                            <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={(e) => handleFileUpload(e, "audioUrl")} />
                          </>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Home Section Dropdown */}
              <FormField
                control={form.control}
                name="homeSectionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Home Section (Optional)</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === "none" ? undefined : parseInt(val))}
                      value={field.value ? String(field.value) : "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select home section" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">-- Koi nahi --</SelectItem>
                        {homeSections?.map((sec) => (
                          <SelectItem key={sec.id} value={sec.id.toString()}>
                            {sec.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort Order</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="published"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Published Status</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={isPending || isUploading} className="gap-2">
                  {(isPending || isUploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Story
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
