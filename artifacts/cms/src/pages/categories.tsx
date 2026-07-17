import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useListCategories,
  useUpdateCategory,
  useDeleteCategory,
  getListCategoriesQueryKey,
  useListAudioStories,
  useListVideos,
  useUpdateAudioStory,
  useUpdateVideo,
  getListAudioStoriesQueryKey,
  getListVideosQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Library, Plus, Pencil, Trash2, Loader2, ListVideo, Search, Check, X,
  GripVertical, Save, ArrowRightLeft,
} from "lucide-react";

interface ContentItem {
  id: number;
  title: string;
  categoryId: number | null;
  categoryName?: string | null;
  thumbnailUrl?: string | null;
  type: "audio" | "video";
  sortOrder: number;
}

export default function Categories() {
  const { data: categories, isLoading } = useListCategories();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  // ---- All content, used for counts + the Manage Content picker ----
  const { data: audioStories } = useListAudioStories();
  const { data: videos } = useListVideos();
  const updateAudioStory = useUpdateAudioStory();
  const updateVideo = useUpdateVideo();

  const allContent: ContentItem[] = useMemo(() => {
    const audio = (audioStories || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      categoryId: s.categoryId,
      categoryName: s.categoryName,
      thumbnailUrl: s.thumbnailUrl,
      type: "audio" as const,
      sortOrder: s.sortOrder ?? 0,
    }));
    const video = (videos || []).map((v: any) => ({
      id: v.id,
      title: v.title,
      categoryId: v.categoryId,
      categoryName: v.categoryName,
      thumbnailUrl: v.thumbnailUrl,
      type: "video" as const,
      sortOrder: v.sortOrder ?? 0,
    }));
    return [...audio, ...video];
  }, [audioStories, videos]);

  const countsByCategory = useMemo(() => {
    const map: Record<number, { audio: number; video: number }> = {};
    for (const item of allContent) {
      if (item.categoryId == null) continue;
      if (!map[item.categoryId]) map[item.categoryId] = { audio: 0, video: 0 };
      map[item.categoryId][item.type]++;
    }
    return map;
  }, [allContent]);

  // ---- Manage Content modal state ----
  const [manageOpen, setManageOpen] = useState(false);
  const [manageCategory, setManageCategory] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "audio" | "video">("all");
  const [selectedItems, setSelectedItems] = useState<ContentItem[]>([]);
  const [pendingMoves, setPendingMoves] = useState<Record<string, number>>({});
  const [reassigning, setReassigning] = useState<ContentItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const openManage = (cat: any) => {
    setManageCategory(cat);
    setManageOpen(true);
    setSearch("");
    setTypeFilter("all");
    setReassigning(null);
    setMoveTarget("");
    setPendingMoves({});
    const current = allContent
      .filter((item) => item.categoryId === cat.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    setSelectedItems(current);
  };

  const closeManage = () => {
    setManageOpen(false);
    setManageCategory(null);
    setReassigning(null);
  };

  const isSelected = (item: ContentItem) =>
    selectedItems.some((s) => s.id === item.id && s.type === item.type);

  const matchesCategoryType = (item: ContentItem) =>
    !manageCategory || manageCategory.type === "both" || manageCategory.type === item.type;

  const filteredAvailable = useMemo(() => {
    return allContent.filter((item) => {
      if (!matchesCategoryType(item)) return false;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.categoryName || "").toLowerCase().includes(q);
      const matchFilter = typeFilter === "all" || item.type === typeFilter;
      return matchSearch && matchFilter;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allContent, manageCategory, search, typeFilter]);

  const toggleSelect = (item: ContentItem) => {
    const alreadySelected = isSelected(item);
    if (alreadySelected) {
      // Belongs to THIS category right now -> can't just drop it, every asset needs a home.
      if (item.categoryId === manageCategory?.id) {
        setReassigning(item);
        setMoveTarget("");
        return;
      }
      // Was only staged (not yet saved) -> fine to just unstage it.
      setSelectedItems((prev) => prev.filter((s) => !(s.id === item.id && s.type === item.type)));
    } else {
      setSelectedItems((prev) => [...prev, item]);
    }
  };

  const confirmReassign = () => {
    if (!reassigning || !moveTarget) return;
    const key = `${reassigning.type}-${reassigning.id}`;
    setPendingMoves((prev) => ({ ...prev, [key]: Number(moveTarget) }));
    setSelectedItems((prev) => prev.filter((s) => !(s.id === reassigning.id && s.type === reassigning.type)));
    setReassigning(null);
    setMoveTarget("");
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const updated = [...selectedItems];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(idx, 0, moved);
    setSelectedItems(updated);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleSaveContent = async () => {
    if (!manageCategory) return;
    setSaving(true);
    try {
      const updates: Promise<any>[] = selectedItems.map((item, i) => {
        const data = { categoryId: manageCategory.id, sortOrder: i };
        return item.type === "audio"
          ? updateAudioStory.mutateAsync({ id: item.id, data })
          : updateVideo.mutateAsync({ id: item.id, data });
      });

      for (const [key, targetCategoryId] of Object.entries(pendingMoves)) {
        const [type, idStr] = key.split("-");
        const id = Number(idStr);
        const data = { categoryId: targetCategoryId };
        updates.push(
          type === "audio"
            ? updateAudioStory.mutateAsync({ id, data })
            : updateVideo.mutateAsync({ id, data })
        );
      }

      await Promise.all(updates);
      queryClient.invalidateQueries({ queryKey: getListAudioStoriesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });
      toast({
        title: "✅ Content saved!",
        description: `${selectedItems.length} items in "${manageCategory.label}"`,
      });
      closeManage();
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = (id: number, active: boolean) => {
    updateCategory.mutate(
      { id, data: { active } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast({ title: "Status updated" });
        },
        onError: () => {
          toast({ title: "Failed to update status", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    deleteCategory.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast({ title: "Category deleted" });
        },
        onError: () => {
          toast({ title: "Failed to delete category", variant: "destructive" });
        },
      }
    );
  };

  const moveTargetOptions = (categories || []).filter(
    (c: any) => c.id !== manageCategory?.id && (c.type === "both" || c.type === reassigning?.type)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Library className="w-8 h-8 text-primary" />
          Categories
        </h1>
        <Button onClick={() => setLocation("/categories/new")} className="gap-2">
          <Plus className="w-4 h-4" /> Add Category
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !categories?.length ? (
            <div className="p-8 text-center text-muted-foreground">No categories found.</div>
          ) : (
            <div className="divide-y">
              {categories.map((cat: any) => {
                const counts = countsByCategory[cat.id] || { audio: 0, video: 0 };
                return (
                  <div
                    key={cat.id}
                    className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 flex items-center justify-center bg-primary/10 rounded-lg text-2xl">
                        {cat.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{cat.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Label: {cat.label} • Type: {cat.type} • Order: {cat.sortOrder}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {counts.audio} audio • {counts.video} video
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-primary border-primary hover:bg-primary/10"
                        onClick={() => openManage(cat)}
                      >
                        <ListVideo className="w-4 h-4" /> Manage Content
                      </Button>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Active</span>
                        <Switch
                          checked={cat.active}
                          onCheckedChange={(checked) => handleToggleActive(cat.id, checked)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setLocation(`/categories/${cat.id}`)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(cat.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manage Content Modal */}
      {manageOpen && manageCategory && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background w-full max-w-5xl h-[90vh] rounded-xl flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10 bg-background">
              <div>
                <h2 className="text-xl font-bold">Manage Content</h2>
                <p className="text-sm text-muted-foreground">
                  "{manageCategory.label}" • {manageCategory.type}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
                  {selectedItems.length} selected
                </span>
                <Button variant="outline" onClick={closeManage}>
                  Cancel
                </Button>
                <Button onClick={handleSaveContent} disabled={saving || !!reassigning} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </Button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left: All content */}
              <div className="flex-1 flex flex-col overflow-hidden border-r">
                <div className="px-4 py-3 border-b space-y-2 bg-muted/30">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-background"
                      placeholder="Search by title or category..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  {manageCategory.type === "both" && (
                    <div className="flex gap-2">
                      {(["all", "audio", "video"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setTypeFilter(f)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            typeFilter === f
                              ? "bg-primary text-white border-primary"
                              : "bg-background border-border hover:bg-muted"
                          }`}
                        >
                          {f === "all" ? "All" : f === "audio" ? "🎵 Audio" : "🎬 Video"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto">
                  {filteredAvailable.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">No content found.</div>
                  ) : (
                    <div className="divide-y">
                      {filteredAvailable.map((item) => {
                        const selected = isSelected(item);
                        const elsewhereLabel =
                          item.categoryId && item.categoryId !== manageCategory.id ? item.categoryName : null;
                        return (
                          <div
                            key={`${item.type}-${item.id}`}
                            onClick={() => toggleSelect(item)}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                              selected ? "bg-primary/5 border-l-2 border-primary" : ""
                            }`}
                          >
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                              {item.thumbnailUrl ? (
                                <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl">
                                  {item.type === "audio" ? "🎵" : "🎬"}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {elsewhereLabel ? `Currently in: ${elsewhereLabel}` : item.categoryName || "No category"}
                              </p>
                              <span
                                className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                                  item.type === "audio" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {item.type === "audio" ? "🎵 Audio" : "🎬 Video"}
                              </span>
                            </div>
                            <div
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                selected ? "bg-primary border-primary" : "border-muted-foreground"
                              }`}
                            >
                              {selected && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Selected + reorder */}
              <div className="w-80 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/30">
                  <h3 className="font-semibold text-sm">Selected Order ({selectedItems.length})</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Drag to reorder</p>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {selectedItems.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      <div className="text-3xl mb-2">📭</div>
                      No content selected yet.
                      <br />
                      Click items on the left to add.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {selectedItems.map((item, idx) => (
                        <div
                          key={`sel-${item.type}-${item.id}`}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDrop={() => handleDrop(idx)}
                          className={`flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing transition-colors ${
                            dragOverIdx === idx ? "bg-primary/10 border-t-2 border-primary" : "hover:bg-muted/50"
                          }`}
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs font-bold text-muted-foreground w-5 flex-shrink-0">{idx + 1}</span>
                          <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                            {item.thumbnailUrl ? (
                              <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-lg">
                                {item.type === "audio" ? "🎵" : "🎬"}
                              </div>
                            )}
                          </div>
                          <p className="text-xs font-medium truncate flex-1">{item.title}</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(item);
                            }}
                            className="text-muted-foreground hover:text-destructive flex-shrink-0"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reassign-on-remove dialog: every asset must live in some category */}
      {reassigning && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-background w-full max-w-sm rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-lg">Move "{reassigning.title}"</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              This item is currently in "{manageCategory?.label}". Pick where it should move to instead — it can't be
              left without a category.
            </p>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={moveTarget}
              onChange={(e) => setMoveTarget(e.target.value)}
            >
              <option value="">Select a category...</option>
              {moveTargetOptions.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setReassigning(null);
                  setMoveTarget("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={confirmReassign} disabled={!moveTarget}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
