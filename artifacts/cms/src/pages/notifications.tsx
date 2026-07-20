import { useEffect, useState } from "react";
import { useListAudioStories, useListVideos } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bell, Loader2, Send, Clock, X, RefreshCcw } from "lucide-react";

interface Settings {
  id: number;
  dailyCycleEnabled: boolean;
  dailyCycleTitle: string;
  dailyCycleBody: string;
  dailyCycleContentType: string | null;
  dailyCycleContentId: number | null;
  dailyCycleLastSentAt: string | null;
}

interface ScheduledItem {
  id: number;
  title: string;
  body: string;
  contentType: string | null;
  contentId: number | null;
  scheduledAt: string;
  status: "pending" | "sent" | "cancelled" | "failed";
  sentAt: string | null;
}

// Shared "attach content" picker — a type select (none/audio/video) plus a
// second select listing that type's published titles. Used by both the
// daily-cycle dialog and the manual notification card.
function ContentPicker({
  contentType,
  contentId,
  onChange,
}: {
  contentType: string | null;
  contentId: number | null;
  onChange: (type: string | null, id: number | null) => void;
}) {
  const { data: stories } = useListAudioStories();
  const { data: videos } = useListVideos();

  const items =
    contentType === "audio" ? (stories ?? []) : contentType === "video" ? (videos ?? []) : [];

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label>Attach content (optional)</Label>
        <Select
          value={contentType ?? "none"}
          onValueChange={(v) => onChange(v === "none" ? null : v, null)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">कुछ नइखे (no content)</SelectItem>
            <SelectItem value="audio">Audio Story</SelectItem>
            <SelectItem value="video">Video</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {contentType && (
        <div className="space-y-2">
          <Label>Which one</Label>
          <Select
            value={contentId ? String(contentId) : undefined}
            onValueChange={(v) => onChange(contentType, Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {items.map((item: any) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "कबो नइखे भेजल गइल";
  const ms = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(ms / (1000 * 60 * 60));
  if (hrs < 1) return "अबहीं-अबहीं";
  if (hrs < 24) return `${hrs} घंटा पहिले`;
  return `${Math.floor(hrs / 24)} दिन पहिले`;
}

function nextSendEstimate(iso: string | null): string {
  if (!iso) return "जल्दिये (अगिला चेक में)";
  const nextAt = new Date(iso).getTime() + 24 * 60 * 60 * 1000;
  const msLeft = nextAt - Date.now();
  if (msLeft <= 0) return "जल्दिये (अगिला चेक में)";
  const hrs = Math.ceil(msLeft / (1000 * 60 * 60));
  return `~${hrs} घंटा बाद`;
}

export default function Notifications() {
  const { toast } = useToast();

  // --- Daily cycle state ---
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogBody, setDialogBody] = useState("");
  const [dialogContentType, setDialogContentType] = useState<string | null>(null);
  const [dialogContentId, setDialogContentId] = useState<number | null>(null);
  const [savingDialog, setSavingDialog] = useState(false);

  const loadSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await fetch("/api/admin/notifications/settings", { credentials: "include" });
      const data = await res.json();
      setSettings(data);
    } catch {
      toast({ title: "सेटिंग लोड नइखे भइल", variant: "destructive" });
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const openDialogForEnable = () => {
    setDialogTitle(settings?.dailyCycleTitle || "");
    setDialogBody(settings?.dailyCycleBody || "");
    setDialogContentType(settings?.dailyCycleContentType || null);
    setDialogContentId(settings?.dailyCycleContentId || null);
    setDialogOpen(true);
  };

  const handleMasterToggle = async (checked: boolean) => {
    if (checked) {
      openDialogForEnable();
      return;
    }
    if (!confirm("रोज के सूचना बंद करीं?")) return;
    try {
      const res = await fetch("/api/admin/notifications/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      const data = await res.json();
      setSettings(data);
      toast({ title: "बंद कर दिहल गइल" });
    } catch {
      toast({ title: "फेल भइल", variant: "destructive" });
    }
  };

  const saveDailyCycle = async () => {
    if (!dialogTitle.trim() || !dialogBody.trim()) {
      toast({ title: "Title आ message दुनो लिखीं", variant: "destructive" });
      return;
    }
    setSavingDialog(true);
    try {
      const res = await fetch("/api/admin/notifications/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          title: dialogTitle,
          body: dialogBody,
          contentType: dialogContentType,
          contentId: dialogContentId,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSettings(data);
      setDialogOpen(false);
      toast({ title: "रोज के सूचना चालू भइल 🎉" });
    } catch {
      toast({ title: "सेव नइखे भइल", variant: "destructive" });
    } finally {
      setSavingDialog(false);
    }
  };

  // --- Manual / scheduled state ---
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [contentType, setContentType] = useState<string | null>(null);
  const [contentId, setContentId] = useState<number | null>(null);
  const [scheduleOn, setScheduleOn] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<ScheduledItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/admin/notifications/scheduled", { credentials: "include" });
      setHistory(await res.json());
    } catch {
      // non-critical, silently ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !sending;
  const canSchedule = canSend && scheduleOn && scheduleDate && scheduleTime;

  const resetManualForm = () => {
    setTitle("");
    setBody("");
    setContentType(null);
    setContentId(null);
    setScheduleOn(false);
    setScheduleDate("");
    setScheduleTime("");
  };

  const handlePushNow = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications/broadcast", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), contentType, contentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to send");
      toast({ title: `भेज दिहल गइल — ${data.recipients} device` });
      resetManualForm();
      loadHistory();
    } catch (e) {
      toast({ title: "भेजल नइखे भइल", description: (e as any)?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSchedule = async () => {
    if (!canSchedule) return;
    setSending(true);
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      const res = await fetch("/api/admin/notifications/scheduled", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), contentType, contentId, scheduledAt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to schedule");
      toast({ title: "शेड्यूल हो गइल ⏰" });
      resetManualForm();
      loadHistory();
    } catch (e) {
      toast({ title: "शेड्यूल नइखे भइल", description: (e as any)?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const cancelScheduled = async (id: number) => {
    try {
      await fetch(`/api/admin/notifications/scheduled/${id}`, { method: "DELETE", credentials: "include" });
      toast({ title: "रद्द कर दिहल गइल" });
      loadHistory();
    } catch {
      toast({ title: "रद्द नइखे भइल", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Bell className="w-8 h-8 text-primary" />
        Notifications
      </h1>

      {/* Daily cycle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>रोज के सूचना (Daily Cycle)</CardTitle>
              <CardDescription className="mt-1">
                चालू रहला पर, हर 24 घंटा में एके संदेश बार-बार भेजाई, जबतक बदल ना दीं।
              </CardDescription>
            </div>
            {loadingSettings ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <Switch checked={settings?.dailyCycleEnabled ?? false} onCheckedChange={handleMasterToggle} />
            )}
          </div>
        </CardHeader>
        {settings?.dailyCycleEnabled && (
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <p className="font-semibold text-sm">{settings.dailyCycleTitle}</p>
              <p className="text-sm text-muted-foreground">{settings.dailyCycleBody}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>पिछला भेजल: {timeAgo(settings.dailyCycleLastSentAt)}</span>
              <span>अगिला: {nextSendEstimate(settings.dailyCycleLastSentAt)}</span>
            </div>
            <Button variant="outline" size="sm" onClick={openDialogForEnable} className="gap-2">
              <RefreshCcw className="w-3.5 h-3.5" />
              Edit Message
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Manual / scheduled */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Notification</CardTitle>
          <CardDescription>
            एक बेर के सूचना — अभी भेजीं, चाहे कवनो तारीख/समय खातिर शेड्यूल करीं। ई दोबारा नइखे भेजाई।
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notif-title">Title</Label>
            <Input id="notif-title" placeholder="राम-राम! 🙏" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notif-body">Message</Label>
            <Textarea
              id="notif-body"
              placeholder="आज रात 8 बजे नयका कहानी आवत बा, जरूर सुनीं!"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={200}
            />
          </div>

          <ContentPicker
            contentType={contentType}
            contentId={contentId}
            onChange={(t, id) => { setContentType(t); setContentId(id); }}
          />

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">बाद में शेड्यूल करीं</p>
              <p className="text-xs text-muted-foreground">चालू करके तारीख आ समय चुनीं</p>
            </div>
            <Switch checked={scheduleOn} onCheckedChange={setScheduleOn} />
          </div>

          {scheduleOn && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="notif-date">Date</Label>
                <Input id="notif-date" type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notif-time">Time</Label>
                <Input id="notif-time" type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handlePushNow} disabled={!canSend} className="gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              अभी भेजीं (Push Now)
            </Button>
            {scheduleOn && (
              <Button onClick={handleSchedule} disabled={!canSchedule} variant="outline" className="gap-2">
                <Clock className="w-4 h-4" />
                शेड्यूल करीं
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="py-4 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">अबहीं तक कवनो notification नइखे भेजल गइल।</p>
          ) : (
            <div className="divide-y">
              {history.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.body}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.status === "sent" && `भेजल गइल — ${new Date(item.sentAt!).toLocaleString()}`}
                      {item.status === "pending" && `शेड्यूल्ड — ${new Date(item.scheduledAt).toLocaleString()}`}
                      {item.status === "cancelled" && "रद्द कर दिहल गइल"}
                      {item.status === "failed" && "फेल भइल"}
                    </p>
                  </div>
                  {item.status === "pending" && (
                    <Button variant="ghost" size="icon" onClick={() => cancelScheduled(item.id)}>
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enable/edit daily cycle dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>रोज के सूचना के संदेश लिखीं</DialogTitle>
            <DialogDescription>
              ई संदेश हर 24 घंटा में बार-बार भेजाई, जबतक रउआ एकरा बदल ना दीं या बंद ना कर दीं।
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={dialogTitle} onChange={(e) => setDialogTitle(e.target.value)} maxLength={80} placeholder="राम-राम! 🙏" />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={dialogBody}
                onChange={(e) => setDialogBody(e.target.value)}
                rows={3}
                maxLength={200}
                placeholder="नयका कहानी सुनल जा सकेला, आईं सुनीं!"
              />
            </div>
            <ContentPicker
              contentType={dialogContentType}
              contentId={dialogContentId}
              onChange={(t, id) => { setDialogContentType(t); setDialogContentId(id); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveDailyCycle} disabled={savingDialog} className="gap-2">
              {savingDialog && <Loader2 className="w-4 h-4 animate-spin" />}
              Save & चालू करीं
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
