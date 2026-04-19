import { useEffect, useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart3,
  Calendar,
  Clock,
  Heart,
  RefreshCcw,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import {
  dispatchDueCommunityEchoCampaigns,
  generateCommunityEchoDraft,
  getCommunityEchoOverview,
  getCommunityEchoResponses,
  getCoordinatorMissions,
  getImpactReportSummary,
  scheduleCommunityEchoCampaign,
  type CommunityEchoOverviewResponse,
  type CommunityEchoResponseAnalytics,
  type CoordinatorMissionListResponse,
  type ImpactReportExport,
} from "@/lib/coordinator-api";
import { useToast } from "@/hooks/use-toast";

const BROADCAST_LANGUAGE_STORAGE_KEY = "nexus_broadcast_language";

const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "kn", label: "Kannada" },
  { code: "hi", label: "Hindi" },
  { code: "te", label: "Telugu" },
];

const TONE_OPTIONS = [
  { value: "warm", label: "Warm & encouraging", icon: Heart },
  { value: "informational", label: "Informational", icon: BarChart3 },
  { value: "urgent", label: "Urgent", icon: Clock },
];

const toDateInput = (value: Date) => value.toISOString().slice(0, 10);

const startOfWeek = () => {
  const today = new Date();
  const offset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - offset);
  return monday;
};

const endOfWeek = () => {
  const monday = startOfWeek();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
};

const toDateTimeLocalDefault = () => {
  const nextHour = new Date();
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  const year = nextHour.getFullYear();
  const month = `${nextHour.getMonth() + 1}`.padStart(2, "0");
  const day = `${nextHour.getDate()}`.padStart(2, "0");
  const hours = `${nextHour.getHours()}`.padStart(2, "0");
  const minutes = `${nextHour.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const sentimentBadgeClass = (sentiment: string) => {
  if (sentiment === "positive") return "bg-emerald-50 text-emerald-700";
  if (sentiment === "negative") return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-600";
};

export default function CommunityEcho() {
  const { toast } = useToast();

  const [weekStart, setWeekStart] = useState(toDateInput(startOfWeek()));
  const [weekEnd, setWeekEnd] = useState(toDateInput(endOfWeek()));

  const [language, setLanguage] = useState(() => {
    if (typeof window === "undefined") {
      return "kn";
    }

    const stored = window.localStorage.getItem(BROADCAST_LANGUAGE_STORAGE_KEY);
    const valid = LANGUAGE_OPTIONS.some((option) => option.code === stored);
    return valid && stored ? stored : "kn";
  });
  const [tone, setTone] = useState("warm");
  const [sendAt, setSendAt] = useState(toDateTimeLocalDefault());
  const [coordinatorNotes, setCoordinatorNotes] = useState("");

  const [overview, setOverview] = useState<CommunityEchoOverviewResponse | null>(null);
  const [responses, setResponses] = useState<CommunityEchoResponseAnalytics | null>(null);
  const [impactSummary, setImpactSummary] = useState<ImpactReportExport | null>(null);
  const [missions, setMissions] = useState<CoordinatorMissionListResponse | null>(null);

  const [draftTitle, setDraftTitle] = useState("Weekly Community Echo");
  const [draftMessage, setDraftMessage] = useState("");
  const [draftHighlights, setDraftHighlights] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDashboard = async (asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      const [overviewPayload, responsePayload, impactPayload, missionPayload] = await Promise.all([
        getCommunityEchoOverview(weekStart, weekEnd),
        getCommunityEchoResponses({ limit: 30 }),
        getImpactReportSummary("month").catch(() => null),
        getCoordinatorMissions().catch(() => null),
      ]);

      setOverview(overviewPayload);
      setResponses(responsePayload);
      setImpactSummary(impactPayload);
      setMissions(missionPayload);

      if (!draftMessage.trim()) {
        setDraftMessage(
          `This week we completed ${overviewPayload.summary.completedMissions} missions and reached ${overviewPayload.summary.weekFamiliesHelped} families. Thank you for your continued support.`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load Community Echo data";
      setErrorMessage(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [weekStart, weekEnd]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(BROADCAST_LANGUAGE_STORAGE_KEY, language);
    }
  }, [language]);

  const sentimentStats = responses?.summary;
  const positivePercent = sentimentStats?.positivePercent ?? overview?.responseAnalytics.positivePercent ?? 0;

  const missionSuccessRate = useMemo(() => {
    const value = impactSummary?.metrics?.missionSuccessRate;
    if (typeof value === "number") {
      return Math.round(value);
    }
    if (!overview) {
      return 0;
    }
    const total = overview.summary.totalMissions;
    if (total <= 0) {
      return 0;
    }
    return Math.round((overview.summary.completedMissions / total) * 100);
  }, [impactSummary, overview]);

  const handleGenerateDraft = async () => {
    setGenerating(true);
    try {
      const payload = await generateCommunityEchoDraft({
        weekStart,
        weekEnd,
        language,
        tone,
        coordinatorNotes: coordinatorNotes.trim() || undefined,
      });
      setDraftTitle(payload.draftTitle);
      setDraftMessage(payload.draftMessage);
      setDraftHighlights(payload.highlights);
      toast({
        title: "Draft generated",
        description: `Gemini prepared a ${payload.language.toUpperCase()} draft for ${payload.audienceCount} linked contacts.`,
      });
    } catch (error) {
      toast({
        title: "Draft generation failed",
        description: error instanceof Error ? error.message : "Unable to generate draft",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSchedule = async () => {
    if (!draftMessage.trim()) {
      toast({
        title: "Draft required",
        description: "Generate or write a draft message before scheduling.",
        variant: "destructive",
      });
      return;
    }

    setScheduling(true);
    try {
      const sendAtIso = sendAt ? new Date(sendAt).toISOString() : undefined;
      const payload = await scheduleCommunityEchoCampaign({
        weekStart,
        weekEnd,
        language,
        tone,
        draftTitle: draftTitle.trim() || undefined,
        draftMessage,
        sendAt: sendAtIso,
      });

      toast({
        title: "Campaign scheduled",
        description: `Campaign ${payload.campaignId} prepared for ${payload.recipientsCount} recipients on dummy SMS adapter.`,
      });

      await loadDashboard(true);
    } catch (error) {
      toast({
        title: "Scheduling failed",
        description: error instanceof Error ? error.message : "Unable to schedule campaign",
        variant: "destructive",
      });
    } finally {
      setScheduling(false);
    }
  };

  const handleDispatchDue = async () => {
    setDispatching(true);
    try {
      const payload = await dispatchDueCommunityEchoCampaigns(10);
      toast({
        title: "Dispatch run complete",
        description: `${payload.processed} due campaign(s) processed via dummy SMS delivery.`,
      });
      await loadDashboard(true);
    } catch (error) {
      toast({
        title: "Dispatch failed",
        description: error instanceof Error ? error.message : "Unable to dispatch due campaigns",
        variant: "destructive",
      });
    } finally {
      setDispatching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#F8F9FE]">
        <DashboardTopBar breadcrumb="Community Echo" />
        <div className="flex-1 flex items-center justify-center text-slate-500 font-bold">Loading live Community Echo data...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F8F9FE]">
      <DashboardTopBar
        breadcrumb="Community Echo"
        rightElement={
          <Button variant="outline" size="sm" onClick={() => void loadDashboard(true)} disabled={refreshing}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-[#1A1A3D] tracking-tight">Community Echo</h1>
            <p className="text-slate-500 font-medium mt-1">Real-time mission-linked broadcasts and community response loop</p>
            <p className="text-xs text-slate-400 font-semibold mt-2">Dummy SMS provider enabled. Broadcast audience is linked by mission and zone scope.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-indigo-50 text-indigo-700 border-none">SMS Adapter: dummy-static</Badge>
            <Button variant="outline" onClick={handleDispatchDue} disabled={dispatching}>
              <Send className="w-4 h-4 mr-2" />
              {dispatching ? "Dispatching" : "Run Due Dispatch"}
            </Button>
          </div>
        </div>

        {errorMessage ? (
          <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-medium">{errorMessage}</div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-100">
            <p className="text-[10px] tracking-widest font-black text-slate-400 uppercase">Linked Audience</p>
            <p className="text-3xl font-black text-[#1A1A3D] mt-2">{overview?.summary.linkedAudience ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">Contacts linked through missions and zones</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-100">
            <p className="text-[10px] tracking-widest font-black text-slate-400 uppercase">Weekly Families Helped</p>
            <p className="text-3xl font-black text-[#1A1A3D] mt-2">{overview?.summary.weekFamiliesHelped ?? 0}</p>
            <p className="text-xs text-slate-500 mt-1">Derived from mission outcomes this week</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-100">
            <p className="text-[10px] tracking-widest font-black text-slate-400 uppercase">Mission Success Rate</p>
            <p className="text-3xl font-black text-[#1A1A3D] mt-2">{missionSuccessRate}%</p>
            <p className="text-xs text-slate-500 mt-1">Based on completed missions from impact summary</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-100">
            <p className="text-[10px] tracking-widest font-black text-slate-400 uppercase">Positive Responses</p>
            <p className="text-3xl font-black text-[#1A1A3D] mt-2">{positivePercent}%</p>
            <p className="text-xs text-slate-500 mt-1">Live community feedback from tracking portal</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl font-bold text-[#1A1A3D]">Broadcast Composer</h2>
                <p className="text-sm text-slate-500">Coordinator can edit Gemini draft before scheduling.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                <Calendar className="w-4 h-4" />
                {weekStart} to {weekEnd}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-black tracking-widest text-slate-400 uppercase mb-2">Week Start</p>
                <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
              </div>
              <div>
                <p className="text-xs font-black tracking-widest text-slate-400 uppercase mb-2">Week End</p>
                <Input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-black tracking-widest text-slate-400 uppercase mb-2">Broadcast Language</p>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-black tracking-widest text-slate-400 uppercase mb-2">Tone</p>
                <div className="flex gap-2 flex-wrap">
                  {TONE_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={tone === option.value ? "default" : "outline"}
                      className={tone === option.value ? "bg-[#4F46E5] hover:bg-[#4338CA]" : ""}
                      onClick={() => setTone(option.value)}
                    >
                      <option.icon className="w-4 h-4 mr-2" />
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-black tracking-widest text-slate-400 uppercase mb-2">Coordinator Notes (Optional)</p>
              <Textarea
                value={coordinatorNotes}
                onChange={(e) => setCoordinatorNotes(e.target.value)}
                placeholder="Add local context, specific requests, or reminders for this week's broadcast."
                className="min-h-[90px]"
              />
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3">
              <Button type="button" onClick={handleGenerateDraft} disabled={generating}>
                <Sparkles className="w-4 h-4 mr-2" />
                {generating ? "Generating Draft" : "Generate with Gemini"}
              </Button>
              <div className="text-xs text-slate-500 font-semibold">
                Audience preview: {overview?.summary.linkedAudience ?? 0} recipients
              </div>
            </div>

            <div className="space-y-3">
              <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Draft title" />
              <Textarea
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                className="min-h-[180px]"
                placeholder="Draft broadcast message"
              />
              {draftHighlights.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {draftHighlights.map((item, index) => (
                    <Badge key={`${item}-${index}`} className="bg-indigo-50 text-indigo-700 border-none">
                      {item}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <p className="text-xs font-black tracking-widest text-slate-400 uppercase mb-2">Schedule Send Time</p>
                <Input type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
                <p className="mt-2 text-[11px] text-slate-500 font-semibold">
                  Broadcast will be sent in <span className="text-[#1A1A3D]">{LANGUAGE_OPTIONS.find((option) => option.code === language)?.label || "Selected language"}</span>.
                </p>
              </div>
              <Button className="bg-[#4F46E5] hover:bg-[#4338CA]" onClick={handleSchedule} disabled={scheduling}>
                {scheduling ? "Scheduling" : "Schedule Broadcast"}
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-[#1A1A3D] mb-4">Community Response</h3>
              <div className="space-y-2 mb-5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-emerald-600">{positivePercent}% positive</span>
                  <span className="text-slate-400">{responses?.summary.total ?? 0} responses</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(0, Math.min(100, positivePercent))}%` }} />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap mb-5">
                {(responses?.summary.tags || overview?.responseAnalytics.tags || []).slice(0, 6).map((tag) => (
                  <Badge key={tag.label} className="bg-slate-100 text-slate-700 border-none">
                    {tag.label} ({tag.count})
                  </Badge>
                ))}
              </div>

              <div className="space-y-3">
                {(responses?.responses || overview?.responseAnalytics.latest || []).slice(0, 3).map((entry) => (
                  <div key={entry.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge className={sentimentBadgeClass(entry.sentiment || "neutral")}>{entry.sentiment || "neutral"}</Badge>
                      <span className="text-[10px] text-slate-400 font-semibold">{formatDateTime(entry.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{entry.message}</p>
                  </div>
                ))}
                {!(responses?.responses?.length || overview?.responseAnalytics.latest?.length) ? (
                  <p className="text-sm text-slate-500">No public feedback submitted yet.</p>
                ) : null}
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#4F46E5] to-[#3730A3] rounded-3xl p-6 text-white">
              <p className="text-[10px] tracking-widest uppercase font-black opacity-70">Operational Snapshot</p>
              <p className="text-3xl font-black mt-2">{overview?.summary.activeMissions ?? 0} Active Missions</p>
              <p className="text-sm mt-2 opacity-90">{missions?.pending ?? 0} pending · {missions?.completed ?? 0} completed</p>
              <div className="mt-4 text-xs opacity-90">
                Reports linked this week: {overview?.summary.totalReports ?? 0}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[#1A1A3D]">Broadcast History</h2>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Users className="w-4 h-4" />
              {overview?.campaigns.length ?? 0} campaigns
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(overview?.campaigns || []).map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{formatDateTime(campaign.sendAt || campaign.createdAt)}</TableCell>
                  <TableCell>{campaign.weekStart && campaign.weekEnd ? `${campaign.weekStart} to ${campaign.weekEnd}` : "-"}</TableCell>
                  <TableCell>{campaign.recipientsCount}</TableCell>
                  <TableCell>{campaign.sentCount}</TableCell>
                  <TableCell>
                    <Badge className={campaign.status === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{campaign.tone}</TableCell>
                </TableRow>
              ))}
              {!(overview?.campaigns.length) ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    No campaigns yet. Generate and schedule your first Community Echo broadcast.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
