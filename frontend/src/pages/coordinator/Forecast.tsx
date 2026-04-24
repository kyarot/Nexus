import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { NeedTerrainMap } from "@/components/coordinator/NeedTerrainMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableRow, TableCell, TableHead, TableHeader } from "@/components/ui/table";
import { BarChart3, Bell, Mail, MessageSquare, ExternalLink, Info, Filter, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  calibrateCommunityForecastMonthly,
  getCommunityForecastBacktesting,
  getCommunityForecastSettings,
  getCommunityForecastStreamUrl,
  getCommunityForecastSummary,
  getCommunityForecastZones,
  patchCommunityForecastSettings,
  recomputeCommunityForecast,
} from "@/lib/forecast-api";
import { getCoordinatorTerrainSnapshot } from "@/lib/coordinator-api";
import { getNotificationStreamUrl, listNotifications, type NotificationItem } from "@/lib/ops-api";
import { useToast } from "@/hooks/use-toast";

const fallbackChart = [
  { weekLabel: "W12", score: 42, confidence: 100, isForecast: false },
  { weekLabel: "W13", score: 48, confidence: 100, isForecast: false },
  { weekLabel: "W14", score: 55, confidence: 100, isForecast: false },
  { weekLabel: "W15", score: 62, confidence: 100, isForecast: false },
  { weekLabel: "W16", score: 68, confidence: 82, isForecast: true },
  { weekLabel: "W17", score: 74, confidence: 78, isForecast: true },
  { weekLabel: "W18", score: 72, confidence: 73, isForecast: true },
  { weekLabel: "W19", score: 70, confidence: 69, isForecast: true },
];

const toRelativeTime = (value?: string) => {
  if (!value) {
    return "--";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  const diffMs = Date.now() - parsed.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export default function Forecast() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const seenNotificationIds = useRef<Set<string>>(new Set());

  const [selectedZoneId, setSelectedZoneId] = useState("all");
  const [riskView, setRiskView] = useState<"map" | "grid">("map");
  const [threshold, setThreshold] = useState([75]);
  const [notificationMethods, setNotificationMethods] = useState({
    email: true,
    sms: true,
    push: false,
  });

  const summaryQuery = useQuery({
    queryKey: ["community-forecast-summary"],
    queryFn: () => getCommunityForecastSummary(),
    refetchInterval: 60_000,
  });

  const zonesQuery = useQuery({
    queryKey: ["community-forecast-zones"],
    queryFn: () => getCommunityForecastZones(false, 24),
    refetchInterval: 60_000,
  });

  const backtestingQuery = useQuery({
    queryKey: ["community-forecast-backtesting"],
    queryFn: () => getCommunityForecastBacktesting(24),
    refetchInterval: 120_000,
  });

  const terrainSnapshotQuery = useQuery({
    queryKey: ["community-forecast-terrain-map"],
    queryFn: () => getCoordinatorTerrainSnapshot({ sinceHours: 168, confidenceMin: 0 }),
    refetchInterval: 60_000,
  });

  const settingsQuery = useQuery({
    queryKey: ["community-forecast-settings"],
    queryFn: getCommunityForecastSettings,
    refetchInterval: 120_000,
  });

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }
    setThreshold([settingsQuery.data.threshold]);
    setNotificationMethods({ ...settingsQuery.data.notificationMethods });
  }, [settingsQuery.data]);

  const saveSettingsMutation = useMutation({
    mutationFn: () =>
      patchCommunityForecastSettings({
        threshold: threshold[0],
        notificationMethods,
      }),
    onSuccess: () => {
      toast({ title: "Forecast settings saved", description: "Alert configuration updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["community-forecast-settings"] });
    },
    onError: (error) => {
      toast({
        title: "Unable to save settings",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const recomputeMutation = useMutation({
    mutationFn: recomputeCommunityForecast,
    onSuccess: () => {
      toast({ title: "Forecast recomputed", description: "New predictions are now live." });
      queryClient.invalidateQueries({ queryKey: ["community-forecast-summary"] });
      queryClient.invalidateQueries({ queryKey: ["community-forecast-zones"] });
      queryClient.invalidateQueries({ queryKey: ["community-forecast-backtesting"] });
    },
    onError: (error) => {
      toast({
        title: "Recompute failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const calibrateMutation = useMutation({
    mutationFn: calibrateCommunityForecastMonthly,
    onSuccess: () => {
      toast({ title: "Monthly calibration complete", description: "Model bias calibration has been refreshed." });
      queryClient.invalidateQueries({ queryKey: ["community-forecast-summary"] });
      queryClient.invalidateQueries({ queryKey: ["community-forecast-backtesting"] });
    },
    onError: (error) => {
      toast({
        title: "Calibration failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const streamUrl = getCommunityForecastStreamUrl();
    if (!streamUrl.includes("token=")) {
      return;
    }

    const source = new EventSource(streamUrl);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        if (payload?.type !== "forecast_update") {
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["community-forecast-summary"] });
        queryClient.invalidateQueries({ queryKey: ["community-forecast-zones"] });
        queryClient.invalidateQueries({ queryKey: ["community-forecast-backtesting"] });
      } catch {
        // Ignore malformed SSE events.
      }
    };
    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [queryClient]);

  useEffect(() => {
    const token = localStorage.getItem("nexus_access_token") || "";
    if (!token) {
      return;
    }

    const streamUrl = getNotificationStreamUrl();
    const source = new EventSource(streamUrl);

    const handleForecastNotifications = async () => {
      try {
        const data = await listNotifications(true);
        const forecastNotifications = (data.notifications || []).filter(
          (item: NotificationItem) => item.type === "forecast_alert" || item.type === "forecast_calibration"
        );

        for (const item of forecastNotifications) {
          if (seenNotificationIds.current.has(item.id)) {
            continue;
          }
          seenNotificationIds.current.add(item.id);
          toast({
            title: item.title || "Forecast Notification",
            description: item.message || "Forecast event updated.",
          });
        }
      } catch {
        // Ignore transient notification fetch errors.
      }
    };

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        if (payload?.type === "notification_update") {
          handleForecastNotifications();
        }
      } catch {
        // Ignore malformed SSE payloads.
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [toast]);

  const summary = summaryQuery.data;
  const backtesting = backtestingQuery.data;
  const zoneRows = zonesQuery.data?.zones || [];

  const chartData = useMemo(() => {
    const points = summary?.mainChart.points?.length ? summary.mainChart.points : fallbackChart;
    return points.map((point) => ({
      week: point.weekLabel,
      score: point.score,
      confidence: point.confidence,
      historical: point.isForecast ? null : point.score,
      forecast: point.isForecast ? point.score : null,
    }));
  }, [summary?.mainChart.points]);

  const zoneOptions = useMemo(
    () => [
      { id: "all", name: "All Zones (Global)" },
      ...zoneRows.map((zone) => ({ id: zone.zoneId, name: zone.zone })),
    ],
    [zoneRows]
  );

  const displayedZones = useMemo(() => {
    if (selectedZoneId === "all") {
      return zoneRows.slice(0, 3);
    }
    return zoneRows.filter((zone) => zone.zoneId === selectedZoneId).slice(0, 3);
  }, [selectedZoneId, zoneRows]);

  const trendBars = summary?.performance?.trendBars?.length
    ? summary.performance.trendBars
    : backtesting?.series?.map((item) => item.accuracy).slice(-5) || [40, 50, 60, 65, 70];

  const riskRows = summary?.riskAssessmentRows || [];
  const riskRowsForDisplay = riskRows.length
    ? riskRows
    : zoneRows.map((zone) => ({
        zoneId: zone.zoneId,
        zone: zone.zone,
        atRisk: zone.needsAtRisk,
        need: zone.dominantNeed || "general",
        riskLevel: zone.riskLevel,
      }));

  const terrainMapZones = terrainSnapshotQuery.data?.zones || [];
  const terrainHeatmapPoints = terrainSnapshotQuery.data?.points || [];

  const isBusy =
    summaryQuery.isLoading ||
    zonesQuery.isLoading ||
    saveSettingsMutation.isPending ||
    recomputeMutation.isPending ||
    calibrateMutation.isPending;

  return (
    <div className="flex flex-col h-full bg-[#F8F9FE]">
      <DashboardTopBar breadcrumb="Community Forecast" />
      
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[2.5rem] font-bold text-[#1A1A3D] tracking-tight">Community Forecast</h1>
            <p className="text-lg text-slate-500 mt-1 font-medium">Predicted need intensity for next 4 weeks across all zones</p>
          </div>
          <div className="flex gap-3">
            <div className="bg-slate-100 rounded-xl px-4 h-11 flex items-center gap-2">
              <select
                value={selectedZoneId}
                onChange={(event) => setSelectedZoneId(event.target.value)}
                className="bg-transparent text-slate-700 font-bold outline-none text-sm"
              >
                {zoneOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <Filter className="w-4 h-4 text-slate-500" />
            </div>
            <Button
              onClick={() => recomputeMutation.mutate()}
              disabled={recomputeMutation.isPending}
              className="bg-[#5A57FF] hover:bg-[#4845E0] text-white font-bold px-6 rounded-xl"
            >
              {recomputeMutation.isPending ? "Recomputing..." : "Recompute Forecast"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => calibrateMutation.mutate()}
              disabled={calibrateMutation.isPending}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6"
            >
              {calibrateMutation.isPending ? "Calibrating..." : "Monthly Calibration"}
            </Button>
          </div>
        </div>

        {/* Top Grid: Main Chart & Performance Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Forecast Chart */}
          <div className="lg:col-span-2 bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 relative">
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-xl font-bold text-[#1A1A3D]">Predictive Intensity Map</h2>
              <div className="flex gap-6 text-xs font-bold uppercase tracking-widest">
                <span className="flex items-center gap-2 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#5A57FF]" /> HISTORICAL
                </span>
                <span className="flex items-center gap-2 text-[#1A1A3D]">
                  <Target className="w-3.5 h-3.5" /> FORECAST
                </span>
              </div>
            </div>

            <div className="relative h-[300px] w-full mt-8">
              <div className="absolute right-0 top-0 z-10 bg-[#1A1A3D] text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest">
                Pre-position Resources
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5A57FF" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#5A57FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="week" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94A3B8', fontSize: 11, fontWeight: 600}} 
                    dy={10}
                  />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip 
                    cursor={{ stroke: '#5A57FF', strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-50 min-w-[120px]">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{data.week} Intensity</p>
                            <div className="flex items-baseline gap-1">
                              <p className="text-2xl font-bold text-[#1A1A3D]">{data.score}</p>
                              <p className="text-[10px] font-bold text-[#5A57FF]">Pts</p>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">Confidence {Math.round(data.confidence || 0)}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="historical" 
                    stroke="#5A57FF" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorScore)" 
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#5A57FF' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="forecast" 
                    stroke="#5A57FF" 
                    strokeWidth={3} 
                    strokeDasharray="6 6"
                    fillOpacity={1} 
                    fill="url(#colorScore)" 
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#5A57FF' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-12 flex items-end justify-between">
              <div className="flex gap-12">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peak Confidence</p>
                  <p className="text-3xl font-bold text-[#5A57FF] mt-1">{summary ? `${summary.mainChart.peakConfidence.toFixed(1)}%` : "--"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Drift Ratio</p>
                  <p className="text-3xl font-bold text-[#1A1A3D] mt-1">{summary ? summary.mainChart.driftRatio.toFixed(2) : "--"}</p>
                </div>
              </div>
              <div className="flex -space-x-2">
                {(zoneRows.slice(0, 3).length ? zoneRows.slice(0, 3) : [{ zone: "Nexus" }]).map((zone) => (
                  <div key={zone.zoneId || zone.zone} className="h-10 w-10 rounded-full border-2 border-white bg-slate-200 overflow-hidden flex items-center justify-center text-xs font-bold text-[#1A1A3D]">
                    {(zone.zone || "N").slice(0, 2).toUpperCase()}
                  </div>
                ))}
                <div className="h-10 w-10 rounded-full border-2 border-white bg-[#E0E7FF] text-[#5A57FF] text-xs font-bold flex items-center justify-center">
                  +{Math.max(0, summary?.overview.totalZones ? summary.overview.totalZones - 3 : 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Forecast Performance Card */}
          <div className="bg-gradient-to-br from-[#4F46E5] to-[#3730A3] rounded-[2rem] p-8 text-white flex flex-col shadow-lg">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold leading-tight max-w-[180px]">Last Month's Forecast Performance</h2>
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                <BarChart3 className="w-6 h-6" />
              </div>
            </div>

            <div className="mt-8 space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-sm font-medium opacity-80 uppercase tracking-widest text-[10px]">Accuracy Score</span>
                <span className="text-4xl font-black">{backtesting ? `${Math.round(backtesting.accuracyScore)}%` : "--"}</span>
              </div>
              <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                <div className="h-full bg-[#10B981] rounded-full" style={{ width: `${Math.round(backtesting?.accuracyScore || 0)}%` }} />
              </div>
            </div>

            <div className="mt-12 flex-1 flex items-end justify-between gap-2 h-32">
              {trendBars.map((h, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex-1 rounded-lg transition-all duration-700",
                    i === trendBars.length - 1 ? "bg-[#10B981]" : "bg-white/20"
                  )} 
                  style={{ height: `${Math.max(20, Math.min(100, h))}%` }} 
                />
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-white/10 italic text-xs opacity-60">
              {summary?.performance.note || "Model quality details unavailable."}
            </div>
          </div>
        </div>

        {/* Zone Forecasts: 3 Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {displayedZones.map((z, i) => (
            <div key={z.zoneId} className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold text-[#1A1A3D]">{z.zone}</h3>
                <span className={cn("text-[10px] font-black px-3 py-1 rounded-full", z.badgeTone)}>{z.peakLabel}</span>
              </div>

              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confidence</p>
                  <p className="text-2xl font-bold text-[#1A1A3D] mt-1">{Math.round(z.confidence)}%</p>
                </div>
                <div className="flex items-end gap-1 h-12 w-24">
                  {z.trend.map((h, j) => (
                    <div key={j} className="flex-1 rounded-sm" style={{ height: `${Math.max(10, Math.min(100, h))}%`, backgroundColor: z.color, opacity: 0.3 + (j * 0.15) }} />
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 mb-6">
                {z.riskLevel === "critical" || z.riskLevel === "high" ? <Info className="w-4 h-4 text-[#EF4444]" /> : z.riskLevel === "low" ? <Target className="w-4 h-4 text-[#10B981]" /> : <Users className="w-4 h-4 text-[#5A57FF]" />}
                <p className="text-sm font-medium text-slate-700">{z.recommendedAction}</p>
              </div>

              <Button className={cn(
                "w-full rounded-xl py-6 font-bold uppercase tracking-widest text-xs",
                z.riskLevel === "low" ? "bg-white border-2 border-[#1A1A3D] text-[#1A1A3D] hover:bg-slate-50" : "bg-[#1A1A3D] text-white hover:bg-black"
              )}>
                {z.riskLevel === "low" ? "View Details" : "Pre-position Now"}
              </Button>
            </div>
          ))}
          {!displayedZones.length && (
            <div className="md:col-span-3 bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 text-center text-slate-500 font-medium">
              No forecast zones available yet.
            </div>
          )}
        </div>

        {/* Bottom Grid: Risk Assessment & Alert Config */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
          {/* Risk Assessment Table */}
          <div className="lg:col-span-2 bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-bold text-[#1A1A3D]">Generational Risk Assessment</h2>
                <p className="text-xs font-medium text-slate-400 mt-1">2025–2030 Cohort Analysis</p>
              </div>
              <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRiskView("map")}
                  className={cn(
                    "font-bold text-xs h-8",
                    riskView === "map" ? "bg-white shadow-sm text-[#1A1A3D]" : "text-slate-500"
                  )}
                >
                  Map View
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRiskView("grid")}
                  className={cn(
                    "font-bold text-xs h-8",
                    riskView === "grid" ? "bg-white shadow-sm text-[#1A1A3D]" : "text-slate-500"
                  )}
                >
                  Grid View
                </Button>
              </div>
            </div>

            {riskView === "map" ? (
              <div className="grid grid-cols-[35%_1fr] gap-8">
                <div className="rounded-2xl overflow-hidden h-[280px] border border-slate-100 bg-slate-50">
                  <NeedTerrainMap
                    zones={terrainMapZones}
                    heatmapPoints={terrainHeatmapPoints}
                    opacity={0.75}
                    showLegend={false}
                    className="h-full"
                  />
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="border-none hover:bg-transparent">
                      <TableHead className="uppercase text-[10px] font-black tracking-widest text-slate-400">Zone</TableHead>
                      <TableHead className="uppercase text-[10px] font-black tracking-widest text-slate-400">At-Risk</TableHead>
                      <TableHead className="uppercase text-[10px] font-black tracking-widest text-slate-400">Need</TableHead>
                      <TableHead className="uppercase text-[10px] font-black tracking-widest text-slate-400 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {riskRowsForDisplay.map((row, i) => (
                      <TableRow key={i} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-bold text-[#1A1A3D]">{row.zone}</TableCell>
                        <TableCell className="font-mono font-medium text-slate-600">{row.atRisk.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "rounded-lg border-none hover:bg-transparent px-3 py-1 text-[10px] font-bold",
                            row.riskLevel === "critical" ? "text-[#EF4444] bg-[#FEF2F2]" : row.riskLevel === "high" ? "text-orange-600 bg-orange-50" : row.riskLevel === "medium" ? "text-[#5A57FF] bg-[#F3F2FF]" : "text-[#10B981] bg-[#ECFDF5]"
                          )}>
                            {titleCase(row.need)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setSelectedZoneId(row.zoneId)}
                            className="text-[#5A57FF] hover:bg-[#F3F2FF]"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!riskRowsForDisplay.length && (
                      <TableRow className="border-slate-50">
                        <TableCell colSpan={4} className="py-8 text-center text-slate-400 font-medium">
                          Risk assessment data will appear once forecasts are generated.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {riskRowsForDisplay.map((row) => (
                  <div key={row.zoneId} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-bold text-[#1A1A3D]">{row.zone}</h3>
                      <Badge className={cn(
                        "rounded-lg border-none px-2 py-1 text-[10px] font-bold",
                        row.riskLevel === "critical" ? "text-[#EF4444] bg-[#FEF2F2]" : row.riskLevel === "high" ? "text-orange-600 bg-orange-50" : row.riskLevel === "medium" ? "text-[#5A57FF] bg-[#F3F2FF]" : "text-[#10B981] bg-[#ECFDF5]"
                      )}>
                        {titleCase(row.riskLevel)}
                      </Badge>
                    </div>
                    <p className="mt-3 text-[11px] text-slate-500 font-semibold uppercase tracking-widest">At-Risk</p>
                    <p className="text-2xl font-black text-[#1A1A3D]">{row.atRisk.toLocaleString()}</p>
                    <p className="mt-2 text-xs text-slate-600">Primary Need: <span className="font-bold">{titleCase(row.need)}</span></p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedZoneId(row.zoneId)}
                      className="mt-3 w-full text-[#5A57FF] hover:bg-[#F3F2FF]"
                    >
                      Focus Zone <ExternalLink className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                ))}
                {!riskRowsForDisplay.length && (
                  <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400 font-medium">
                    Risk assessment data will appear once forecasts are generated.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Alert Configuration Card */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col">
            <div className="flex items-center gap-4 mb-10">
              <div className="p-3 bg-amber-50 rounded-2xl">
                <Bell className="w-6 h-6 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-[#1A1A3D]">Alert Configuration</h2>
            </div>

            <div className="space-y-8 flex-1">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm font-black uppercase tracking-widest text-slate-400">
                  <span>Confidence Threshold</span>
                  <span className="text-[#5A57FF]">{threshold[0]}%</span>
                </div>
                <Slider value={threshold} onValueChange={setThreshold} max={100} step={1} className="py-4" />
              </div>

              <div className="space-y-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notification Methods</p>
                <div className="space-y-3">
                  {[
                    { icon: Mail, label: "Email Summary", key: "email" as const },
                    { icon: MessageSquare, label: "SMS Critical Alerts", key: "sms" as const },
                    { icon: Bell, label: "Push Notifications", key: "push" as const }
                  ].map((method, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl transition-all hover:bg-slate-100">
                      <div className="flex items-center gap-4">
                        <method.icon className="w-5 h-5 text-slate-400" />
                        <span className="text-sm font-bold text-[#1A1A3D]">{method.label}</span>
                      </div>
                      <Switch
                        className="data-[state=checked]:bg-[#5A57FF]"
                        checked={notificationMethods[method.key]}
                        onCheckedChange={(checked) => setNotificationMethods((prev) => ({ ...prev, [method.key]: checked }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button
              onClick={() => saveSettingsMutation.mutate()}
              disabled={saveSettingsMutation.isPending}
              className="mt-8 bg-[#3730A3] hover:bg-[#2D267E] text-white font-bold py-6 rounded-2xl shadow-lg transition-transform active:scale-95"
            >
              {saveSettingsMutation.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </div>

        {/* Footer Status Bar */}
        <div className="border-t border-slate-200 mt-12 py-6 flex flex-wrap items-center justify-between text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
          <div className="flex gap-8">
            <span className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", isBusy ? "bg-amber-400 animate-pulse" : "bg-[#10B981] animate-pulse")} /> CORE ENGINE: {isBusy ? "SYNCING" : "LIVE"}
            </span>
            <span>LAST UPDATE: {summary?.generatedAt ? toRelativeTime(summary.generatedAt) : "--"}</span>
          </div>
          <div className="flex gap-8">
            <span>API Response: <span className="text-[#5A57FF]">{summary?.telemetry?.lastComputeDurationMs ?? "--"}ms</span></span>
            <span>Uptime: <span className="text-[#10B981]">{summary?.telemetry?.uptimePercent?.toFixed(2) ?? "99.95"}%</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
