import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useListVideos, useUpdateVideo, useDeleteVideo, getListVideosQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Video as VideoIcon, Plus, Pencil, Trash2, Loader2, PlayCircle, Eye, Search } from "lucide-react";

export default function Videos() {
  const { data: videos, isLoading } = useListVideos();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const updateVideo = useUpdateVideo();
  const deleteVideo = useDeleteVideo();

  const filteredVideos = useMemo(() => {
    if (!videos) return videos;
    const q = search.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter((video: any) =>
      video.title?.toLowerCase().includes(q) ||
      video.categoryName?.toLowerCase().includes(q) ||
      video.searchTags?.toLowerCase().includes(q)
    );
  }, [videos, search]);

  const handleTogglePublished = (id: number, published: boolean) => {
    updateVideo.mutate(
      { id, data: { published } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });
          toast({ title: "Status updated" });
        },
        onError: () => {
          toast({ title: "Failed to update status", variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this video?")) return;
    deleteVideo.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });
          toast({ title: "Video deleted" });
        },
        onError: () => {
          toast({ title: "Failed to delete video", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <VideoIcon className="w-8 h-8 text-primary" />
          Videos
        </h1>
        <Button onClick={() => setLocation("/videos/new")} className="gap-2">
          <Plus className="w-4 h-4" /> Add Video
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-background"
          placeholder="Search by title or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !videos?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              No videos found.
            </div>
          ) : !filteredVideos?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              No videos match "{search}".
            </div>
          ) : (
            <div className="divide-y">
              {filteredVideos.map((video) => (
                <div key={video.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4 w-1/2">
                    <div className="w-24 h-16 bg-muted rounded-md overflow-hidden relative flex-shrink-0 flex items-center justify-center">
                      {video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <PlayCircle className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-lg truncate" title={video.title}>{video.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {video.categoryName || 'Uncategorized'} • {video.sourceType}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1 text-muted-foreground text-sm" title="Views">
                      <Eye className="w-4 h-4" />
                      {video.views}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Published</span>
                      <Switch
                        checked={video.published}
                        onCheckedChange={(checked) => handleTogglePublished(video.id, checked)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setLocation(`/videos/${video.id}`)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(video.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
