import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
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
import { Bell, Loader2, Send, Clock, X, RefreshCcw, Search, Check, Upload, Users, Phone } from "lucide-react";

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
  targetPhones: string | null;
  scheduledAt: string;
  status: "pending" | "sent" | "cancelled" | "failed";
  sentAt: string | null;
}

// Shared "attach content" picker: type select (none/audio/video), then a
// search box + scrollable checklist of that type's titles — sorted newest
// first — instead of a plain dropdown. Meant for a large library (hundreds
// of files) where scrolling a dropdown isn't practical. Only one item can
// be attached (a notification deep-links to a single piece of content),
// so the "checkbox" is really a single-select highlight.
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
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const source: any[] = contentType === "audio" ? (stories ?? []) : contentType === "video" ? (videos ?? []) : [];
    const sorted = [...source].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
      return tb - ta; // newest first
    });
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((item) => item.title?.toLowerCase().includes(q));
  }, [contentType, stories, videos, query]);

  const selected = items.find((i) => i.id === contentId);

  return (
    <div className="space-y-2">
      <Label>Attach content (optional)</Label>
      <Select
        value={contentType ?? "none"}
        onValueChange={(v) => { onChange(v === "none" ? null : v, null); setQuery(""); }}
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

      {contentType && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="नाम लिखीं खोजे खातिर..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {selected && (
            <p className="text-xs text-muted-foreground">चुनल गइल बा: <span className="font-medium text-foreground">{selected.title}</span></p>
          )}
          <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">कुछु नइखे मिलल</p>
            ) : (
              items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onChange(contentType, item.id === contentId ? null : item.id)}
                  className="w-full flex items-center gap-2 p-2 text-left text-sm hover:bg-muted/50 transition-colors"
                >
                  <span
                    className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                      item.id === contentId ? "bg-primary border-primary" : "border-muted-foreground/40"
                    }`}
                  >
                    {item.id === contentId && <Check className="w-3 h-3 text-primary-foreground" />}
                  </span>
                  <span className="truncate">{item.title}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// "Everyone" vs "specific phone numbers" — a single number typed in, plus
// bulk-uploading a sheet (xlsx/csv) with a phone-number column, matching
// against whichever number is currently logged in on each device.
function AudienceTarget({
  phones,
  onChange,
}: {
  phones: string[];
  onChange: (phones: string[]) => void;
}) {
  const [mode, setMode] = useState<"everyone" | "specific">(phones.length > 0 ? "specific" : "everyone");
  const [phoneInput, setPhoneInput] = useState("");
  const { toast } = useToast();

  const setEveryone = () => {
    setMode("everyone");
    onChange([]);
  };

  const addPhone = () => {
    const v = phoneInput.trim();
    if (!v) return;
    if (!phones.includes(v)) onChange([...phones, v]);
    setPhoneInput("");
  };

  const removePhone = (p: string) => onChange(phones.filter((x) => x !== p));

  const handleSheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const found: string[] = [];
        for (const row of rows) {
          for (const key of Object.keys(row)) {
            const val = String(row[key]).trim();
            // Pick up any cell that looks like a phone number, regardless
            // of the column header text (sheets vary: "Mobile number",
            // "Phone", "नंबर", etc).
            if (val.replace(/\D/g, "").length >= 10) {
              found.push(val);
              break;
            }
          }
        }
        if (found.length === 0) {
          toast({ title: "शीट में कवनो नंबर नइखे मिलल", variant: "destructive" });
          return;
        }
        const merged = Array.from(new Set([...phones, ...found]));
        onChange(merged);
        toast({ title: `${found.length} नंबर जोड़ल गइल` });
      } catch {
        toast({ title: "शीट पढ़ल नइखे भइल", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      <Label>किके भेजल जाई</Label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "everyone" ? "default" : "outline"}
          size="sm"
          onClick={setEveryone}
          className="gap-2"
        >
          <Users className="w-3.5 h-3.5" />
          सबके (Everyone)
        </Button>
        <Button
          type="button"
          variant={mode === "specific" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("specific")}
          className="gap-2"
        >
          <Phone className="w-3.5 h-3.5" />
          खास नंबर पर
        </Button>
      </div>

      {mode === "specific" && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex gap-2">
            <Input
              placeholder="मोबाइल नंबर डालीं, जइसे 9876543210"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPhone(); } }}
            />
            <Button type="button" variant="outline" onClick={addPhone}>Add</Button>
          </div>

          <label className="flex items-center gap-2 text-sm text-primary cursor-pointer w-fit">
            <Upload className="w-3.5 h-3.5" />
            शीट अपलोड करीं (.xlsx / .csv)
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleSheetUpload} />
          </label>

          {phones.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{phones.length} नंबर चुनल गइल</p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {phones.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 bg-muted text-xs rounded-full px-2.5 py-1">
                    {p}
                    <button type="button" onClick={() => removePhone(p)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])} className="text-xs h-6 px-2">
                सब हटाईं
              </Button>
            </div>
          )}
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
  const [targetPhones, setTargetPhones] = useState<string[]>([]);
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
    setTargetPhones([]);
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
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          contentType,
          contentId,
          phones: targetPhones.length > 0 ? targetPhones : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to send");
      const unmatchedNote = data.unmatched?.length ? ` — ${data.unmatched.length} नंबर के app नइखे मिलल` : "";
      toast({ title: `भेज दिहल गइल — ${data.recipients} device${unmatchedNote}` });
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
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          contentType,
          contentId,
          scheduledAt,
          phones: targetPhones.length > 0 ? targetPhones : undefined,
        }),
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

          <AudienceTarget phones={targetPhones} onChange={setTargetPhones} />

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
              {history.map((item) => {
                const phoneCount = item.targetPhones ? (JSON.parse(item.targetPhones) as string[]).length : 0;
                return (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.body}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.status === "sent" && `भेजल गइल — ${new Date(item.sentAt!).toLocaleString()}`}
                        {item.status === "pending" && `शेड्यूल्ड — ${new Date(item.scheduledAt).toLocaleString()}`}
                        {item.status === "cancelled" && "रद्द कर दिहल गइल"}
                        {item.status === "failed" && "फेल भइल"}
                        {phoneCount > 0 && ` • ${phoneCount} खास नंबर पर`}
                      </p>
                    </div>
                    {item.status === "pending" && (
                      <Button variant="ghost" size="icon" onClick={() => cancelScheduled(item.id)}>
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
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
