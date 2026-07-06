import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, ArrowLeft } from "lucide-react";

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

export default function UserSubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [durationTouched, setDurationTouched] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subRes, catRes] = await Promise.all([
        fetch(`/api/submissions/${id}`, { credentials: "include" }),
        fetch("/api/categories", { credentials: "include" }),
      ]);
      if (!subRes.ok) throw new Error("Submission not found");
      const sub: Submission = await subRes.json();
      const cats: Category[] = await catRes.json();
      setSubmission(sub);
      setCategories(cats.filter((c) => c.type === "audio" || c.type === "both"));
      setCategoryId(sub.categoryId ? String(sub.categoryId) : "");
      setTitle(sub.title);
      setDescription(sub.description);
      setDurationSeconds(sub.durationSeconds);
      setDurationTouched(sub.durationSeconds > 0);
    } catch (err) {
      toast({ title: "Failed to load submission", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // If the stored duration is missing/0, read the real duration straight
  // from the audio file's own metadata once it loads, so the field shows
  // an accurate value instead of "0s". Only auto-fills if the admin
  // hasn't already typed a value themselves.
  const handleAudioLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const real = Math.round(e.currentTarget.duration);
    if (!durationTouched && isFinite(real) && real > 0) {
      setDurationSeconds(real);
    }
  };

  const handleApprove = async () => {
    if (!categoryId) {
      toast({ title: "पहिले category चुनीं", description: "Approve करे से पहिले एक category select करीं।", variant: "destructive" });
      return;
    }
    if (!title.trim()) {
      toast({ title: "Title खाली नाही हो सकता", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/submissions/${id}/approve`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: Number(categoryId),
          title: title.trim(),
          description: description.trim(),
          durationSeconds,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Approve failed");
      }
      toast({ title: "Approved", description: "Story published to the app and the user has been notified." });
      setLocation("/user-submissions");
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/submissions/${id}/reject`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNotes: rejectReason }),
      });
      if (!res.ok) throw new Error("Reject failed");
      toast({ title: "Rejected" });
      setLocation("/user-submissions");
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="space-y-4">
        <Link href="/user-submissions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to submissions
        </Link>
        <div className="p-8 text-center text-muted-foreground">Submission not found.</div>
      </div>
    );
  }

  const selectedCategoryOriginal = submission.categoryId
    ? categories.find((c) => c.id === submission.categoryId)
    : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/user-submissions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to submissions
      </Link>

      {rejectOpen ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold text-lg">Rejection Reason</h3>
            <textarea
              className="w-full border rounded-md px-3 py-2 min-h-[80px]"
              placeholder="Enter reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleReject} disabled={saving}>
                <XCircle className="w-4 h-4 mr-1" /> {saving ? "Rejecting…" : "Reject"}
              </Button>
              <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex gap-4">
              {submission.thumbnailUrl ? (
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="w-32 h-32 rounded-lg overflow-hidden flex-shrink-0 bg-muted cursor-zoom-in ring-0 hover:ring-2 hover:ring-primary transition-all"
                  title="Click to view full size"
                >
                  <img src={submission.thumbnailUrl} alt={title} className="w-full h-full object-cover" />
                </button>
              ) : (
                <div className="w-32 h-32 rounded-lg flex-shrink-0 bg-muted flex items-center justify-center text-sm text-muted-foreground">
                  No image
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Title</label>
                  <input
                    type="text"
                    className="w-full border rounded-md px-3 py-2 text-lg font-bold mt-0.5"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={submission.status !== "pending"}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  By {submission.userName || submission.userPhone || "Unknown"}
                  {submission.fileSize ? ` • Size: ${(submission.fileSize / 1024 / 1024).toFixed(1)} MB` : ""}
                </p>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Duration (seconds)</label>
                    <input
                      type="number"
                      min={0}
                      className="w-28 border rounded-md px-3 py-2 text-sm mt-0.5"
                      value={durationSeconds}
                      onChange={(e) => {
                        setDurationTouched(true);
                        setDurationSeconds(Number(e.target.value));
                      }}
                      disabled={submission.status !== "pending"}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground pb-2">
                    {durationSeconds > 0 ? `≈ ${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s` : "auto-fills once audio loads below"}
                  </p>
                </div>
              </div>
            </div>

            {lightboxOpen && submission.thumbnailUrl && (
              <div
                className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6 cursor-zoom-out"
                onClick={() => setLightboxOpen(false)}
              >
                <img
                  src={submission.thumbnailUrl}
                  alt={title}
                  className="max-w-full max-h-full rounded-lg shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  className="absolute top-4 right-4 text-white text-3xl leading-none"
                  onClick={() => setLightboxOpen(false)}
                >
                  ×
                </button>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm mt-0.5 min-h-[70px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submission.status !== "pending"}
              />
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Audio</p>
              <audio
                controls
                src={submission.audioUrl}
                className="w-full"
                onLoadedMetadata={handleAudioLoadedMetadata}
              />
            </div>

            <div>
              <p className="text-sm font-medium mb-1">
                Category
                {selectedCategoryOriginal && (
                  <span className="text-muted-foreground font-normal"> — user selected "{selectedCategoryOriginal.label}"</span>
                )}
              </p>
              <select
                className="border rounded-md px-3 py-2 text-sm w-full max-w-xs"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={submission.status !== "pending"}
              >
                <option value="">Select a category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Check whether the user's chosen category is correct — you can change it before approving.
              </p>
            </div>

            {submission.adminNotes && (
              <p className="text-sm text-muted-foreground">Note: {submission.adminNotes}</p>
            )}

            {submission.status === "pending" ? (
              <div className="flex gap-2 pt-2">
                <Button className="gap-1" onClick={handleApprove} disabled={saving}>
                  <CheckCircle className="w-4 h-4" /> {saving ? "Approving…" : "Approve"}
                </Button>
                <Button variant="destructive" className="gap-1" onClick={() => setRejectOpen(true)} disabled={saving}>
                  <XCircle className="w-4 h-4" /> Reject
                </Button>
              </div>
            ) : (
              <p className="text-sm font-medium pt-2">
                Status: <span className={submission.status === "approved" ? "text-green-600" : "text-red-600"}>{submission.status}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
