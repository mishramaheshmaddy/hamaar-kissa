import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Users as UsersIcon,
  Music,
  Video as VideoIcon,
  Library,
  Smartphone,
  Bell,
  Search,
  Headphones,
  PlayCircle,
  Download,
  Heart,
  Bookmark,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

// ---------------------------------------------------------------------
// Types (mirror artifacts/api-server/src/routes/analytics.ts responses)
// ---------------------------------------------------------------------
type Overview = {
  users: { total: number; new7d: number; new30d: number };
  audioStories: { total: number; published: number };
  videos: { total: number; published: number };
  categories: { total: number; active: number };
  devices: number;
  submissions: { pending: number; approved: number; rejected: number };
  notificationsSent: number;
  events: {
    storyPlays: number;
    videoPlays: number;
    downloads: number;
    likes: number;
    saves: number;
  };
};

type GrowthPoint = { date: string; users: number; audioStories: number; videos: number };

type CategoryBreakdown = {
  id: number;
  name: string;
  label: string;
  icon: string;
  type: string;
  active: boolean;
  audioCount: number;
  videoCount: number;
  totalCount: number;
};

type AnalyticsUser = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  authProvider: string;
  createdAt: string;
};

type UsersResponse = { total: number; page: number; pageSize: number; users: AnalyticsUser[] };

// Phase 2 — event-tracking-backed rows (mirror /admin/analytics/audio,
// /admin/analytics/videos, /admin/analytics/downloads responses).
type AudioAnalyticsRow = {
  id: number;
  title: string;
  plays: number;
  downloads: number;
  likes: number;
  saves: number;
};

type VideoAnalyticsRow = {
  id: number;
  title: string;
  views: number;
};

type DownloadRow = {
  id: number;
  title: string;
  downloads: number;
};

const growthChartConfig: ChartConfig = {
  users: { label: "नया यूजर", color: "hsl(var(--chart-1))" },
  audioStories: { label: "ऑडियो कहानी", color: "hsl(var(--chart-2))" },
  videos: { label: "वीडियो", color: "hsl(var(--chart-3))" },
};

const categoryChartConfig: ChartConfig = {
  audioCount: { label: "ऑडियो", color: "hsl(var(--chart-1))" },
  videoCount: { label: "वीडियो", color: "hsl(var(--chart-2))" },
};

const PAGE_SIZE = 10;

export default function Analytics() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [growth, setGrowth] = useState<GrowthPoint[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingGrowth, setLoadingGrowth] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [usersData, setUsersData] = useState<UsersResponse | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [audioAnalytics, setAudioAnalytics] = useState<AudioAnalyticsRow[]>([]);
  const [loadingAudioAnalytics, setLoadingAudioAnalytics] = useState(true);
  const [videoAnalytics, setVideoAnalytics] = useState<VideoAnalyticsRow[]>([]);
  const [loadingVideoAnalytics, setLoadingVideoAnalytics] = useState(true);
  const [topDownloads, setTopDownloads] = useState<DownloadRow[]>([]);
  const [loadingDownloads, setLoadingDownloads] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/analytics/overview", { credentials: "include" });
        setOverview(await res.json());
      } catch {
        // Keep card skeletons visible on failure rather than crashing the page.
      } finally {
        setLoadingOverview(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch("/api/admin/analytics/growth?days=30", { credentials: "include" });
        setGrowth(await res.json());
      } catch {
        // no-op
      } finally {
        setLoadingGrowth(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch("/api/admin/analytics/categories", { credentials: "include" });
        setCategories(await res.json());
      } catch {
        // no-op
      } finally {
        setLoadingCategories(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch("/api/admin/analytics/audio", { credentials: "include" });
        setAudioAnalytics(await res.json());
      } catch {
        // no-op
      } finally {
        setLoadingAudioAnalytics(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch("/api/admin/analytics/videos", { credentials: "include" });
        setVideoAnalytics(await res.json());
      } catch {
        // no-op
      } finally {
        setLoadingVideoAnalytics(false);
      }
    })();

    (async () => {
      try {
        const res = await fetch("/api/admin/analytics/downloads", { credentials: "include" });
        setTopDownloads(await res.json());
      } catch {
        // no-op
      } finally {
        setLoadingDownloads(false);
      }
    })();
  }, []);

  // Debounce the search box so we're not firing a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoadingUsers(true);
    (async () => {
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
        if (search) params.set("search", search);
        const res = await fetch(`/api/admin/analytics/users?${params}`, { credentials: "include" });
        const data = await res.json();
        if (!cancelled) setUsersData(data);
      } catch {
        // no-op
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, search]);

  const totalPages = useMemo(
    () => (usersData ? Math.max(1, Math.ceil(usersData.total / usersData.pageSize)) : 1),
    [usersData]
  );

  const topCategories = useMemo(() => categories.slice(0, 8), [categories]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Analytics</h1>

      {/* --- Overview cards --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <OverviewCard
          icon={<UsersIcon className="w-4 h-4 text-primary" />}
          title="Total Users"
          loading={loadingOverview}
          value={overview?.users.total}
          subtitle={overview ? `+${overview.users.new7d} last 7d · +${overview.users.new30d} last 30d` : undefined}
        />
        <OverviewCard
          icon={<Music className="w-4 h-4 text-primary" />}
          title="Audio Stories"
          loading={loadingOverview}
          value={overview?.audioStories.total}
          subtitle={overview ? `${overview.audioStories.published} published` : undefined}
        />
        <OverviewCard
          icon={<VideoIcon className="w-4 h-4 text-primary" />}
          title="Videos"
          loading={loadingOverview}
          value={overview?.videos.total}
          subtitle={overview ? `${overview.videos.published} published` : undefined}
        />
        <OverviewCard
          icon={<Library className="w-4 h-4 text-primary" />}
          title="Categories"
          loading={loadingOverview}
          value={overview?.categories.total}
          subtitle={overview ? `${overview.categories.active} active` : undefined}
        />
        <OverviewCard
          icon={<Smartphone className="w-4 h-4 text-primary" />}
          title="Registered Devices"
          loading={loadingOverview}
          value={overview?.devices}
          subtitle="Push notification tokens"
        />
        <OverviewCard
          icon={<Bell className="w-4 h-4 text-primary" />}
          title="Notifications Sent"
          loading={loadingOverview}
          value={overview?.notificationsSent}
        />
        <Card className="border-t-4 border-t-primary sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              User Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOverview || !overview ? (
              <Skeleton className="h-6 w-full" />
            ) : (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{overview.submissions.pending} pending</Badge>
                <Badge variant="default">{overview.submissions.approved} approved</Badge>
                <Badge variant="destructive">{overview.submissions.rejected} rejected</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* --- Event-tracking overview cards (Phase 2) --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <OverviewCard
          icon={<Headphones className="w-4 h-4 text-primary" />}
          title="Total Story Plays"
          loading={loadingOverview}
          value={overview?.events.storyPlays}
        />
        <OverviewCard
          icon={<PlayCircle className="w-4 h-4 text-primary" />}
          title="Total Video Plays"
          loading={loadingOverview}
          value={overview?.events.videoPlays}
        />
        <OverviewCard
          icon={<Download className="w-4 h-4 text-primary" />}
          title="Total Downloads"
          loading={loadingOverview}
          value={overview?.events.downloads}
        />
        <OverviewCard
          icon={<Heart className="w-4 h-4 text-primary" />}
          title="Total Likes"
          loading={loadingOverview}
          value={overview?.events.likes}
        />
        <OverviewCard
          icon={<Bookmark className="w-4 h-4 text-primary" />}
          title="Total Saves"
          loading={loadingOverview}
          value={overview?.events.saves}
        />
      </div>

      {/* --- Growth chart --- */}
      <Card>
        <CardHeader>
          <CardTitle>Growth — Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingGrowth ? (
            <Skeleton className="h-64 w-full" />
          ) : growth.length === 0 ? (
            <p className="text-sm text-muted-foreground">कोई डेटा नइखे</p>
          ) : (
            <ChartContainer config={growthChartConfig} className="aspect-auto h-64 w-full">
              <LineChart data={growth} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v) => format(new Date(v), "d MMM")}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent labelFormatter={(v) => format(new Date(v), "d MMM yyyy")} />
                  }
                />
                <Line dataKey="users" type="monotone" stroke="var(--color-users)" strokeWidth={2} dot={false} />
                <Line
                  dataKey="audioStories"
                  type="monotone"
                  stroke="var(--color-audioStories)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line dataKey="videos" type="monotone" stroke="var(--color-videos)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* --- Category breakdown --- */}
      <Card>
        <CardHeader>
          <CardTitle>Content by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCategories ? (
            <Skeleton className="h-64 w-full" />
          ) : topCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">कोई कैटेगरी नइखे</p>
          ) : (
            <ChartContainer config={categoryChartConfig} className="aspect-auto h-72 w-full">
              <BarChart data={topCategories} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="audioCount" stackId="a" fill="var(--color-audioCount)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="videoCount" stackId="a" fill="var(--color-videoCount)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* --- Audio Analytics --- */}
      <Card>
        <CardHeader>
          <CardTitle>Audio Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAudioAnalytics ? (
            <Skeleton className="h-64 w-full" />
          ) : audioAnalytics.length === 0 ? (
            <p className="text-sm text-muted-foreground">कोई ऑडियो कहानी नइखे</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Story Name</TableHead>
                    <TableHead className="text-right">Plays</TableHead>
                    <TableHead className="text-right">Downloads</TableHead>
                    <TableHead className="text-right">Likes</TableHead>
                    <TableHead className="text-right">Saves</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audioAnalytics.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.title}</TableCell>
                      <TableCell className="text-right">{row.plays}</TableCell>
                      <TableCell className="text-right">{row.downloads}</TableCell>
                      <TableCell className="text-right">{row.likes}</TableCell>
                      <TableCell className="text-right">{row.saves}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Video Analytics --- */}
      <Card>
        <CardHeader>
          <CardTitle>Video Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingVideoAnalytics ? (
            <Skeleton className="h-64 w-full" />
          ) : videoAnalytics.length === 0 ? (
            <p className="text-sm text-muted-foreground">कोई वीडियो नइखे</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Video Name</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videoAnalytics.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.title}</TableCell>
                      <TableCell className="text-right">{row.views}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Downloads Dashboard --- */}
      <Card>
        <CardHeader>
          <CardTitle>Downloads Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDownloads ? (
            <Skeleton className="h-48 w-full" />
          ) : topDownloads.length === 0 ? (
            <p className="text-sm text-muted-foreground">अबतक कवनो डाउनलोड नइखे</p>
          ) : (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-3">Most Downloaded Stories</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Story Name</TableHead>
                      <TableHead className="text-right">Downloads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topDownloads.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.title}</TableCell>
                        <TableCell className="text-right">{row.downloads}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Users Dashboard --- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <OverviewCard
          icon={<UsersIcon className="w-4 h-4 text-primary" />}
          title="Total Users"
          loading={loadingOverview}
          value={overview?.users.total}
        />
        <OverviewCard
          icon={<UsersIcon className="w-4 h-4 text-primary" />}
          title="New Users (7 Days)"
          loading={loadingOverview}
          value={overview?.users.new7d}
        />
        <OverviewCard
          icon={<UsersIcon className="w-4 h-4 text-primary" />}
          title="New Users (30 Days)"
          loading={loadingOverview}
          value={overview?.users.new30d}
        />
      </div>

      {/* --- Users table (with phone numbers) --- */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle>Users</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="नाम, फ़ोन या ईमेल से खोजी..."
              className="pl-8"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loadingUsers && !usersData ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Login Method</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersData?.users.length ? (
                      usersData.users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.name || "—"}</TableCell>
                          <TableCell>{u.phone || "—"}</TableCell>
                          <TableCell>{u.email || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {u.authProvider}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(u.createdAt), "d MMM yyyy")}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          कोई यूजर नइखे मिलल
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {usersData && usersData.total > 0 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {usersData.total} में से {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, usersData.total)} देखावल जा रहल बा
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      पिछला
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      अगिला
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewCard({
  icon,
  title,
  value,
  subtitle,
  loading,
}: {
  icon: React.ReactNode;
  title: string;
  value?: number;
  subtitle?: string;
  loading: boolean;
}) {
  return (
    <Card className="border-t-4 border-t-primary">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <>
            <div className="text-3xl font-bold">{value ?? 0}</div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
