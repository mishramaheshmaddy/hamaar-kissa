import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { LayoutGrid, Plus, Pencil, Trash2, Loader2, GripVertical, Save, ListVideo, X, Search, Check } from "lucide-react";

interface HomeSection {
  id: number;
  title: string;
  subtitle: string;
  type: string;
  contentSource: string;
  categoryId: number | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ContentItem {
  id: number;
  title: string;
  categoryName?: string | null;
  thumbnailUrl?: string | null;
  type: "audio" | "video";
  narrator?: string;
}

interface SelectedItem extends ContentItem {
  sortOrder: number;
}

export default function HomeScreenManager() {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "", subtitle: "", type: "audio", contentSource: "manual",
    categoryId: "", sortOrder: 0, isActive: true,
  });

  // Content picker modal state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSection, setPickerSection] = useState<HomeSection | null>(null);
  const [allContent, setAllContent] = useState<ContentItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const PAGE_SIZE = 50;

  const fetchSections = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/home-sections/all", { credentials: "include" });
      setSections(await res.json());
    } catch {
      toast({ title: "Failed to load sections", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSections(); }, []);

  const loadContent = async (sectionId: number, sectionType: string, pageNum = 1, append = false) => {
    if (pageNum === 1) setPickerLoading(true); else setLoadingMore(true);
    try {
      const offset = (pageNum - 1) * PAGE_SIZE;
      const endpoints: string[] = [];
      if (sectionType === "audio" || sectionType === "both")
        endpoints.push(`/api/audio-stories?published=true&limit=${PAGE_SIZE}&offset=${offset}`);
      if (sectionType === "video" || sectionType === "both")
        endpoints.push(`/api/videos?published=true&limit=${PAGE_SIZE}&offset=${offset}`);

      const results = await Promise.all(endpoints.map(ep => fetch(ep, { credentials: "include" }).then(r => r.json())));

      let items: ContentItem[] = [];
      if (sectionType === "audio") items = (results[0] || []).map((s: any) => ({ ...s, type: "audio" as const }));
      else if (sectionType === "video") items = (results[0] || []).map((v: any) => ({ ...v, type: "video" as const }));
      else {
        items = [
          ...(results[0] || []).map((s: any) => ({ ...s, type: "audio" as const })),
          ...(results[1] || []).map((v: any) => ({ ...v, type: "video" as const })),
        ];
      }

      setHasMore(items.length === PAGE_SIZE);
      setAllContent(prev => append ? [...prev, ...items] : items);

      if (pageNum === 1) {
        const existing = await fetch(`/api/home-sections/${sectionId}/content`, { credentials: "include" }).then(r => r.json());
        setSelectedItems((existing || []).map((item: any, i: number) => ({ ...item, sortOrder: i })));
      }
    } catch {
      toast({ title: "Failed to load content", variant: "destructive" });
    } finally {
      setPickerLoading(false);
      setLoadingMore(false);
    }
  };

  const openPicker = (section: HomeSection) => {
    setPickerSection(section);
    setPickerOpen(true);
    setSearch("");
    setFilter("all");
    setPage(1);
    setAllContent([]);
    loadContent(section.id, section.type, 1, false);
  };

  // Infinite scroll
  useEffect(() => {
    if (!pickerOpen || !hasMore) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loadingMore && pickerSection) {
        const nextPage = page + 1;
        setPage(nextPage);
        loadContent(pickerSection.id, pickerSection.type, nextPage, true);
      }
    }, { threshold: 0.1 });
    if (loaderRef.current) obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [pickerOpen, hasMore, loadingMore, page, pickerSection]);

  const toggleSelect = (item: ContentItem) => {
    const exists = selectedItems.find(s => s.id === item.id && s.type === item.type);
    if (exists) {
      setSelectedItems(prev => prev.filter(s => !(s.id === item.id && s.type === item.type)));
    } else {
      setSelectedItems(prev => [...prev, { ...item, sortOrder: prev.length }]);
    }
  };

  const isSelected = (item: ContentItem) => selectedItems.some(s => s.id === item.id && s.type === item.type);

  const filteredContent = allContent.filter(item => {
    const matchSearch = !search || item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.categoryName || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || item.type === filter;
    return matchSearch && matchFilter;
  });

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const updated = [...selectedItems];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(idx, 0, moved);
    setSelectedItems(updated.map((item, i) => ({ ...item, sortOrder: i })));
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleSaveContent = async () => {
    if (!pickerSection) return;
    setSaving(true);
    try {
      await fetch(`/api/home-sections/${pickerSection.id}/content`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selectedItems.map((item, i) => ({ id: item.id, contentType: item.type, sortOrder: i }))
        }),
      });
      toast({ title: "✅ Content saved!", description: `${selectedItems.length} items saved for "${pickerSection.title}"` });
      setPickerOpen(false);
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number, isActive: boolean) => {
    try {
      await fetch(`/api/home-sections/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) });
      setSections(prev => prev.map(s => s.id === id ? { ...s, isActive } : s));
      toast({ title: "Updated" });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this section?")) return;
    try {
      await fetch(`/api/home-sections/${id}`, { method: "DELETE", credentials: "include" });
      setSections(prev => prev.filter(s => s.id !== id));
      toast({ title: "Deleted" });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const handleReorder = async () => {
    const items = sections.map((s, i) => ({ id: s.id, sortOrder: i }));
    try {
      await fetch("/api/home-sections/reorder", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(items) });
      toast({ title: "Order saved" });
    } catch { toast({ title: "Failed to save order", variant: "destructive" }); }
  };

  const moveItem = (id: number, direction: number) => {
    const idx = sections.findIndex(s => s.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(idx, 1);
    next.splice(newIdx, 0, item);
    setSections(next);
  };

  const handleSubmit = async () => {
    const payload = { ...form, categoryId: form.categoryId ? Number(form.categoryId) : null };
    try {
      if (editId) {
        await fetch(`/api/home-sections/${editId}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast({ title: "Updated" });
      } else {
        await fetch("/api/home-sections", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast({ title: "Created" });
      }
      setShowForm(false); setEditId(null);
      setForm({ title: "", subtitle: "", type: "audio", contentSource: "manual", categoryId: "", sortOrder: 0, isActive: true });
      fetchSections();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const openEdit = (s: HomeSection) => {
    setEditId(s.id);
    setForm({ title: s.title, subtitle: s.subtitle, type: s.type, contentSource: s.contentSource, categoryId: s.categoryId ? String(s.categoryId) : "", sortOrder: s.sortOrder, isActive: s.isActive });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <LayoutGrid className="w-8 h-8 text-primary" /> Home Screen
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReorder} className="gap-2"><Save className="w-4 h-4" /> Save Order</Button>
          <Button onClick={() => { setShowForm(true); setEditId(null); setForm({ title: "", subtitle: "", type: "audio", contentSource: "manual", categoryId: "", sortOrder: 0, isActive: true }); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Section
          </Button>
        </div>
      </div>

      {showForm && (
        <Card><CardContent className="p-6 space-y-4">
          <h3 className="font-semibold text-lg">{editId ? "Edit Section" : "New Section"}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium">Title</label><input className="w-full border rounded-md px-3 py-2 mt-1" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className="text-sm font-medium">Subtitle</label><input className="w-full border rounded-md px-3 py-2 mt-1" value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} /></div>
            <div><label className="text-sm font-medium">Type</label>
              <select className="w-full border rounded-md px-3 py-2 mt-1" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="audio">Audio</option><option value="video">Video</option><option value="both">Both</option>
              </select>
            </div>

            <div><label className="text-sm font-medium">Sort Order</label><input className="w-full border rounded-md px-3 py-2 mt-1" type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
          </div>
          <div className="flex items-center gap-2"><label className="text-sm font-medium">Active</label><Switch checked={form.isActive} onCheckedChange={checked => setForm({ ...form, isActive: checked })} /></div>
          <div className="flex gap-2"><Button onClick={handleSubmit}>Save</Button><Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button></div>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-0">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : !sections.length ? (
          <div className="p-8 text-center text-muted-foreground">No sections found.</div>
        ) : (
          <div className="divide-y">
            {sections.map(s => (
              <div key={s.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="h-6 w-6"><GripVertical className="w-4 h-4" /></Button>
                  <div>
                    <h3 className="font-semibold text-lg">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">{s.subtitle} • Type: {s.type} • Source: {s.contentSource}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="sm" className="gap-2 text-primary border-primary hover:bg-primary/10" onClick={() => openPicker(s)}>
                    <ListVideo className="w-4 h-4" /> Manage Content
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Active</span>
                    <Switch checked={s.isActive} onCheckedChange={checked => handleToggle(s.id, checked)} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      {/* Content Picker Modal */}
      {pickerOpen && pickerSection && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background w-full max-w-5xl h-[90vh] rounded-xl flex flex-col shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10 bg-background">
              <div>
                <h2 className="text-xl font-bold">Manage Content</h2>
                <p className="text-sm text-muted-foreground">"{pickerSection.title}" • {pickerSection.type}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
                  {selectedItems.length} selected
                </span>
                <Button variant="outline" onClick={() => setPickerOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveContent} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </Button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left: Content Picker */}
              <div className="flex-1 flex flex-col overflow-hidden border-r">
                <div className="px-4 py-3 border-b space-y-2 bg-muted/30">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-background"
                      placeholder="Search by title or category..."
                      value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    {["all", "audio", "video"].map(f => (
                      <button key={f} onClick={() => setFilter(f)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filter === f ? "bg-primary text-white border-primary" : "bg-background border-border hover:bg-muted"}`}>
                        {f === "all" ? "All" : f === "audio" ? "🎵 Audio" : "🎬 Video"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {pickerLoading ? (
                    <div className="p-12 flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Loading content...</p>
                    </div>
                  ) : filteredContent.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">No content found.</div>
                  ) : (
                    <div className="divide-y">
                      {filteredContent.map(item => {
                        const selected = isSelected(item);
                        return (
                          <div key={`${item.type}-${item.id}`}
                            onClick={() => toggleSelect(item)}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${selected ? "bg-primary/5 border-l-2 border-primary" : ""}`}>
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
                              <p className="text-xs text-muted-foreground mt-0.5">{item.categoryName || "No category"}</p>
                              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${item.type === "audio" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                                {item.type === "audio" ? "🎵 Audio" : "🎬 Video"}
                              </span>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                              {selected && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={loaderRef} className="p-4 flex justify-center">
                        {loadingMore && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Selected + Drag Reorder */}
              <div className="w-80 flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/30">
                  <h3 className="font-semibold text-sm">Selected Order ({selectedItems.length})</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Drag to reorder</p>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {selectedItems.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      <div className="text-3xl mb-2">📭</div>
                      No content selected yet.<br />Click items on the left to add.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {selectedItems.map((item, idx) => (
                        <div key={`sel-${item.type}-${item.id}`}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={e => handleDragOver(e, idx)}
                          onDrop={() => handleDrop(idx)}
                          className={`flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing transition-colors ${dragOverIdx === idx ? "bg-primary/10 border-t-2 border-primary" : "hover:bg-muted/50"}`}>
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
                          <button onClick={e => { e.stopPropagation(); toggleSelect(item); }} className="text-muted-foreground hover:text-destructive flex-shrink-0">
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
    </div>
  );
}
