import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useListAudioStories, useUpdateAudioStory, useDeleteAudioStory, getListAudioStoriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Music, Plus, Pencil, Trash2, Loader2, PlayCircle, Search } from "lucide-react";

export default function AudioStories() {
  const { data: stories, isLoading } = useListAudioStories();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const updateStory = useUpdateAudioStory();
  const deleteStory = useDeleteAudioStory();

  const filteredStories = useMemo(() => {
    if (!stories) return stories;
    const q = search.trim().toLowerCase();
    if (!q) return stories;
    return stories.filter((story: any) =>
      story.title?.toLowerCase().includes(q) ||
      story.categoryName?.toLowerCase().includes(q) ||
      story.narrator?.toLowerCase().includes(q)
    );
  }, [stories, search]);

  const handleTogglePublished = (id: number, published: boolean) => {
    updateStory.mutate(
      { id, data: { published } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAudioStoriesQueryKey() });
          toast({ title: "Status updated" });
        },
        onError: () => {
          toast({ title: "Failed to update status", variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this audio story?")) return;
    deleteStory.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAudioStoriesQueryKey() });
          toast({ title: "Audio story deleted" });
        },
        onError: () => {
          toast({ title: "Failed to delete story", variant: "destructive" });
        }
      }
    );
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Music className="w-8 h-8 text-primary" />
          Audio Stories
        </h1>
        <Button onClick={() => setLocation("/audio-stories/new")} className="gap-2">
          <Plus className="w-4 h-4" /> Add Audio Story
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-background"
          placeholder="Search by title, category, or narrator..."
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
          ) : !stories?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              No audio stories found.
            </div>
          ) : !filteredStories?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              No audio stories match "{search}".
            </div>
          ) : (
            <div className="divide-y">
              {filteredStories.map((story) => (
                <div key={story.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-muted rounded-md overflow-hidden relative flex-shrink-0 flex items-center justify-center">
                      {story.thumbnailUrl ? (
                        <img src={story.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <PlayCircle className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{story.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {story.categoryName} • Narrator: {story.narrator} • {formatDuration(story.durationSeconds)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Published</span>
                      <Switch
                        checked={story.published}
                        onCheckedChange={(checked) => handleTogglePublished(story.id, checked)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setLocation(`/audio-stories/${story.id}`)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(story.id)}>
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
