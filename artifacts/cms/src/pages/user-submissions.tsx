import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, PlayCircle, Filter } from "lucide-react";

interface Submission {
  id: number;
  userId: number;
  userName: string;
  userPhone: string;
  title: string;
  description: string;
  audioUrl: string;
  thumbnailUrl: string | null;
  categoryId: number | null;
  fileSize: number | null;
  durationSeconds: number;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: number;
  label: string;
  type: string;
}

export default function UserSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: number | null; reason: string }>({ open: false, id: null, reason: "" });
  const { toast } = useToast();

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/submissions/all", { credentials: "include" });
      const data = await res.json();
      setSubmissions(data);
    } catch {
      toast({ title: "Failed to load submissions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/categories", { credentials: "include" });
      const data = await res.json();
      setCategories(data.filter((c: Category) => c.type === "audio" || c.type === "both"));
    } catch {
      toast({ title: "Failed to load categories", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchSubmissions();
    fetchCategories();
  }, []);

  const handleApprove = async (id: number) => {
    const categoryId = selectedCategory[id];
    if (!categoryId) {
      toast({ title: "पहिले category चुनीं", description: "Approve करे से पहिले एक category select करीं।", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/submissions/${id}/approve`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Approve failed");
      }
      toast({ title: "Approved", description: "Story published to the app." });
      fetchSubmissions();
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!rejectModal.id) return;
    try {
      await fetch(`/api/submissions/${rejectModal.id}/reject`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: rejectModal.reason }),
      });
      toast({ title: "Rejected" });
      setRejectModal({ open: false, id: null, reason: "" });
      fetchSubmissions();
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const filtered = filter === "all" ? submissions : submissions.filter((s) => s.status === filter);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return (
      <span className={`px-2 py-1 rounded-md text-xs font-semibold ${colors[status] || "bg-gray-100 text-gray-800"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <PlayCircle className="w-8 h-8 text-primary" />
          User Submissions
        </h1>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select className="border rounded-md px-2 py-1 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {rejectModal.open && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-lg">Rejection Reason</h3>
            <textarea
              className="w-full border rounded-md px-3 py-2 min-h-[80px]"
              placeholder="Enter reason for rejection..."
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
            />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleReject}>
                <XCircle className="w-4 h-4 mr-1" /> Reject
              </Button>
              <Button variant="outline" onClick={() => setRejectModal({ open: false, id: null, reason: "" })}>
                Cancel
              </Button>
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
          ) : !filtered.length ? (
            <div className="p-8 text-center text-muted-foreground">No submissions found.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((sub) => (
                <div key={sub.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 flex gap-3">
                      {sub.thumbnailUrl ? (
                        <img
                          src={sub.thumbnailUrl}
                          alt={sub.title}
                          className="w-16 h-16 rounded-md object-cover flex-shrink-0 bg-muted"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-md flex-shrink-0 bg-muted flex items-center justify-center text-xs text-muted-foreground">
                          No image
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{sub.title}</h3>
                          {statusBadge(sub.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          By {sub.userName || sub.userPhone || "Unknown"} • Duration: {sub.durationSeconds}s
                          {sub.fileSize ? ` • Size: ${(sub.fileSize / 1024 / 1024).toFixed(1)} MB` : ""}
                        </p>
                        {sub.adminNotes && (
                          <p className="text-sm text-red-600 mb-2">Note: {sub.adminNotes}</p>
                        )}
                        <audio controls src={sub.audioUrl} className="w-full max-w-md h-8 mb-2" />
                        {sub.status === "pending" && (
                          <select
                            className="border rounded-md px-2 py-1 text-sm w-full max-w-xs"
                            value={selectedCategory[sub.id] ?? sub.categoryId ?? ""}
                            onChange={(e) =>
                              setSelectedCategory({ ...selectedCategory, [sub.id]: Number(e.target.value) })
                            }
                          >
                            <option value="">Select a category…</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      {sub.status === "pending" && (
                        <>
                          <Button size="sm" className="gap-1" onClick={() => handleApprove(sub.id)}>
                            <CheckCircle className="w-4 h-4" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" className="gap-1" onClick={() => setRejectModal({ open: true, id: sub.id, reason: "" })}>
                            <XCircle className="w-4 h-4" /> Reject
                          </Button>
                        </>
                      )}
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
