import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateVideo,
  useUpdateVideo,
  useGetVideo,
  useListCategories,
  getListVideosQueryKey,
  useFetchYoutubeInfo
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
import { ArrowLeft, Loader2, Save, Upload, Youtube } from "lucide-react";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  categoryId: z.coerce.number().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  thumbnailUrl: z.string().optional(),
  videoUrl: z.string().min(1, "Video URL is required"),
  sourceType: z.string().min(1, "Source type is required"),
  youtubeId: z.string().optional().nullable(),
  searchTags: z.string().optional(),
  published: z.boolean().default(false),
  sortOrder: z.coerce.number().min(0).default(0),
  homeSectionId: z.coerce.number().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function VideoForm() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const isNew = !params.id || params.id === "new";
  const id = isNew ? null : parseInt(params.id!);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: video, isLoading } = useGetVideo(id!, { query: { enabled: !!id, queryKey: ["video", id!] } });
  const { data: categoriesRaw } = useListCategories({});
  const categories = categoriesRaw?.filter((c) => c.type === "video" || c.type === "both");

  // Fetch home sections for dropdown
  const [homeSections, setHomeSections] = useState<{id: number; title: string}[]>([]);
  useEffect(() => {
    fetch("/api/home-sections/all", { credentials: "include", cache: "no-store" })
      .then(r => r.json())
      .then(data => setHomeSections(data))
      .catch(() => {});
  }, []);
  
  const createVideo = useCreateVideo();
  const updateVideo = useUpdateVideo();
  const fetchYoutubeInfo = useFetchYoutubeInfo();

  const [isUploading, setIsUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      categoryId: undefined,
      description: "",
      thumbnailUrl: "",
      videoUrl: "",
      sourceType: "youtube",
      youtubeId: "",
      searchTags: "",
      published: false,
      sortOrder: 0,
      homeSectionId: undefined,
    },
  });

  useEffect(() => {
    if (video && !isNew && categoriesRaw && categoriesRaw.length > 0) {
      form.reset({
        title: video.title,
        categoryId: video.categoryId || undefined,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl || "",
        videoUrl: video.videoUrl,
        sourceType: video.sourceType,
        youtubeId: video.youtubeId,
        searchTags: video.searchTags || "",
        published: video.published,
        sortOrder: video.sortOrder,
        homeSectionId: video.homeSectionId || undefined,
      });
      // Belt-and-suspenders: Radix Select can fail to reflect a value that
      // arrives right as it first mounts, even though the underlying form
      // state is already correct. Re-applying the values shortly after
      // guarantees the dropdowns display correctly. (Same pattern already
      // proven out in audio-story-form.tsx.)
      if (video.categoryId) {
        setTimeout(() => { form.setValue("categoryId", video.categoryId!); }, 500);
      }
      if (video.sourceType) {
        setTimeout(() => { form.setValue("sourceType", video.sourceType); }, 500);
      }
    }
  }, [video, isNew, categoriesRaw, form]);

  const onSubmit = (data: FormValues) => {
    if (isNew) {
      createVideo.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });
            toast({ title: "Video created" });
            setLocation("/videos");
          },
          onError: () => toast({ title: "Failed to create video", variant: "destructive" })
        }
      );
    } else {
      updateVideo.mutate(
        { id: id!, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });
            toast({ title: "Video updated" });
            setLocation("/videos");
          },
          onError: () => toast({ title: "Failed to update video", variant: "destructive" })
        }
      );
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: "videoUrl" | "thumbnailUrl") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
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

  const handleYoutubeFetch = () => {
    const url = form.getValues("videoUrl");
    if (!url) {
      toast({ title: "Please enter a YouTube URL first", variant: "destructive" });
      return;
    }

    fetchYoutubeInfo.mutate(
      { data: { url } },
      {
        onSuccess: (data) => {
          form.setValue("title", data.title);
          form.setValue("description", data.description);
          form.setValue("thumbnailUrl", data.thumbnailUrl);
          form.setValue("youtubeId", data.youtubeId);
          toast({ title: "YouTube info fetched!" });
        },
        onError: () => {
          toast({ title: "Failed to fetch YouTube info", variant: "destructive" });
        }
      }
    );
  };

  const isPending = createVideo.isPending || updateVideo.isPending;

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
        <Button variant="ghost" size="icon" onClick={() => setLocation("/videos")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-3xl font-bold">{isNew ? "New Video" : "Edit Video"}</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="space-y-4 border p-4 rounded-lg bg-muted/20">
                <h3 className="font-semibold">Video Source</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="sourceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Source Type</FormLabel>
                        <Select key={`sourceType-${video?.id ?? "new"}`} onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="youtube">YouTube URL</SelectItem>
                            <SelectItem value="upload">Direct Upload</SelectItem>
                            <SelectItem value="url">External URL</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex flex-col justify-end">
                    {sourceType === "youtube" && (
                      <Button type="button" variant="secondary" onClick={handleYoutubeFetch} disabled={fetchYoutubeInfo.isPending} className="gap-2">
                        {fetchYoutubeInfo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Youtube className="w-4 h-4 text-red-500" />}
                        Auto-fill from URL
                      </Button>
                    )}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="videoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Video URL</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input placeholder="https://..." {...field} disabled={sourceType === "upload" && !field.value} />
                        </FormControl>
                        {sourceType === "upload" && (
                          <>
                            <Button type="button" variant="outline" onClick={() => videoInputRef.current?.click()} disabled={isUploading}>
                              <Upload className="w-4 h-4 mr-2" /> Upload Video
                            </Button>
                            <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, "videoUrl")} />
                          </>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Video title" {...field} />
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
                        key={`categoryId-${video?.id ?? "new"}`}
                        onValueChange={(val) => field.onChange(parseInt(val))}
                        value={field.value ? field.value.toString() : ""}
                        defaultValue={field.value ? field.value.toString() : ""}
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

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Video description" rows={4} {...field} />
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
                      Add English/Hinglish spellings so people find this video even if they don't type it in Devanagari.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
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
                          <Upload className="w-4 h-4 mr-2" />
                        </Button>
                        <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "thumbnailUrl")} />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {sourceType === "youtube" && (
                  <FormField
                    control={form.control}
                    name="youtubeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>YouTube ID</FormLabel>
                        <FormControl>
                          <Input placeholder="Auto-filled" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Home Section Dropdown */}
              <FormField
                control={form.control}
                name="homeSectionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Home Section (Optional)</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))}
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
                  Save Video
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
