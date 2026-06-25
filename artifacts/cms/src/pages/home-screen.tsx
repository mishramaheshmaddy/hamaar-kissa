import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { LayoutGrid, Plus, Pencil, Trash2, Loader2, GripVertical, Save } from "lucide-react";

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

export default function HomeScreenManager() {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    type: "audio",
    contentSource: "latest",
    categoryId: "",
    sortOrder: 0,
    isActive: true,
  });
  const { toast } = useToast();

  const fetchSections = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/home-sections/all", { credentials: "include" });
      const data = await res.json();
      setSections(data);
    } catch {
      toast({ title: "Failed to load sections", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const handleToggle = async (id: number, isActive: boolean) => {
    try {
      await fetch(`/api/home-sections/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      setSections((prev) => prev.map((s) => (s.id === id ? { ...s, isActive } : s)));
      toast({ title: "Updated" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this section?")) return;
    try {
      await fetch(`/api/home-sections/${id}`, { method: "DELETE", credentials: "include" });
      setSections((prev) => prev.filter((s) => s.id !== id));
      toast({ title: "Deleted" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const handleReorder = async () => {
    const items = sections.map((s, i) => ({ id: s.id, sortOrder: i }));
    try {
      await fetch("/api/home-sections/reorder", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });
      toast({ title: "Order saved" });
    } catch {
      toast({ title: "Failed to save order", variant: "destructive" });
    }
  };

  const moveItem = (id: number, direction: number) => {
    const idx = sections.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(idx, 1);
    next.splice(newIdx, 0, item);
    setSections(next);
  };

  const handleSubmit = async () => {
    const payload = {
      ...form,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
    };
    try {
      if (editId) {
        await fetch(`/api/home-sections/${editId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast({ title: "Updated" });
      } else {
        await fetch("/api/home-sections", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast({ title: "Created" });
      }
      setShowForm(false);
      setEditId(null);
      setForm({ title: "", subtitle: "", type: "audio", contentSource: "latest", categoryId: "", sortOrder: 0, isActive: true });
      fetchSections();
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const openEdit = (s: HomeSection) => {
    setEditId(s.id);
    setForm({
      title: s.title,
      subtitle: s.subtitle,
      type: s.type,
      contentSource: s.contentSource,
      categoryId: s.categoryId ? String(s.categoryId) : "",
      sortOrder: s.sortOrder,
      isActive: s.isActive,
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <LayoutGrid className="w-8 h-8 text-primary" />
          Home Screen
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReorder} className="gap-2">
            <Save className="w-4 h-4" /> Save Order
          </Button>
          <Button onClick={() => { setShowForm(true); setEditId(null); setForm({ title: "", subtitle: "", type: "audio", contentSource: "latest", categoryId: "", sortOrder: 0, isActive: true }); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Section
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-lg">{editId ? "Edit Section" : "New Section"}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <input className="w-full border rounded-md px-3 py-2 mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Subtitle</label>
                <input className="w-full border rounded-md px-3 py-2 mt-1" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select className="w-full border rounded-md px-3 py-2 mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Content Source</label>
                <select className="w-full border rounded-md px-3 py-2 mt-1" value={form.contentSource} onChange={(e) => setForm({ ...form, contentSource: e.target.value })}>
                  <option value="latest">Latest</option>
                  <option value="featured">Featured</option>
                  <option value="trending">Trending</option>
                  <option value="category">Category</option>
                  <option value="manual">Manual (Direct Select)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Category ID</label>
                <input className="w-full border rounded-md px-3 py-2 mt-1" type="number" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Sort Order</label>
                <input className="w-full border rounded-md px-3 py-2 mt-1" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Active</label>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit}>Save</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !sections.length ? (
            <div className="p-8 text-center text-muted-foreground">No sections found.</div>
          ) : (
            <div className="divide-y">
              {sections.map((s) => (
                <div key={s.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveItem(s.id, -1)}>
                        <GripVertical className="w-4 h-4" />
                      </Button>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{s.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {s.subtitle} • Type: {s.type} • Source: {s.contentSource}
                        {s.categoryId ? ` • Category: ${s.categoryId}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Active</span>
                      <Switch checked={s.isActive} onCheckedChange={(checked) => handleToggle(s.id, checked)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(s.id)}>
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
