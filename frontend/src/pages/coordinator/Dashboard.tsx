import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, UserPlus, FileText, Map } from "lucide-react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { StatMetricCard } from "@/components/coordinator/StatMetricCard";
import { NeedTerrainMap } from "@/components/coordinator/NeedTerrainMap";
import { GeminiInsightCard } from "@/components/coordinator/GeminiInsightCard";
import { VolunteerAvatarCard } from "@/components/coordinator/VolunteerAvatarCard";
import { CommunityPulseDonut } from "@/components/coordinator/CommunityPulseDonut";
import { MissionStatusChip } from "@/components/coordinator/MissionStatusChip";
import { ZoneRiskBadge } from "@/components/coordinator/ZoneRiskBadge";
import { cn } from "@/lib/utils";
import {
  getCoordinatorDashboard,
  getCoordinatorTerrainSnapshot,
  type CoordinatorInsight,
  type CoordinatorTerrainZone,
} from "@/lib/coordinator-api";

const riskPalette: Record<CoordinatorTerrainZone["riskLevel"], string> = {
  critical: "bg-destructive",
  high: "bg-warning",
  medium: "bg-primary",
  low: "bg-success",
};

const fallbackInsightCards = [
  {
    variant: "critical" as const,
    zone: "No live insight yet",
    signals: [{ label: "Waiting for backend data", variant: "info" as const }],
    description: "Connect a coordinator account to see the latest insights from the backend.",
    sourceCount: "0 reports",
    timestamp: "now",
  },
];

const severityToVariant = (severity?: string) => {
  const value = (severity || "watch").toLowerCase();
  if (value === "critical") return "critical" as const;
  if (value === "high") return "high" as const;
  if (value === "resolved") return "resolved" as const;
  return "watch" as const;
};

const timeAgo = (value?: string) => {
  if (!value) return "recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

export default function Dashboard() {
  const token = localStorage.getItem("nexus_access_token");
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  const dashboardQuery = useQuery({
    queryKey: ["coordinator-dashboard", token],
    queryFn: async () => {
      const [dashboard, terrainSnapshot] = await Promise.all([
        getCoordinatorDashboard(),
        getCoordinatorTerrainSnapshot({
          confidenceMin: 15,
          sinceHours: 168,
        }),
      ]);

      return {
        dashboard,
        zones: terrainSnapshot.zones,
        heatmap: terrainSnapshot.points,
      };
    },
    enabled: Boolean(token),
    refetchInterval: 5_000,
  });

  const { data, isLoading } = dashboardQuery;

  useEffect(() => {
    if (!token) {
      return;
    }

    const streamUrl = `${apiBaseUrl}/coordinator/terrain/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(streamUrl);

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        if (payload?.type === "terrain_update") {
          dashboardQuery.refetch();
        }
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
  }, [apiBaseUrl, dashboardQuery, token]);

  const zones = data?.zones ?? [];
  const heatmapPoints = data?.heatmap ?? [];
  const dashboard = data?.dashboard;

  const topZones = useMemo(
    () => [...zones].sort((left, right) => right.currentScore - left.currentScore).slice(0, 4),
    [zones]
  );

  const insights = dashboard?.recentInsights?.length ? dashboard.recentInsights : [];
  const insightCards = insights.map((insight: CoordinatorInsight, index: number) => ({
    variant: severityToVariant(insight.severity),
    zone: insight.title || `Insight ${index + 1}`,
    signals: insight.recommendedAction ? [{ label: insight.recommendedAction, variant: "info" as const }] : undefined,
    description: insight.summary || "No summary available from backend.",
    sourceCount: insight.status ? `${insight.status} · ${insight.title || "insight"}` : undefined,
    timestamp: timeAgo(insight.generatedAt),
  }));

  return (
    <div className="flex flex-col h-full">
      <DashboardTopBar
        breadcrumb="Dashboard"
        subtext={dashboard ? `Live backend sync · ${dashboard.zoneCount} zones · ${dashboard.availableVolunteers} volunteers available` : "Connecting to backend..."}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-card-gap">
            <StatMetricCard
              label="Avg Zone Score"
              value={isLoading ? "--" : `${Math.round(dashboard?.avgZoneScore ?? 0)}`}
              delta={dashboard ? `${dashboard.zoneCount} zones tracked` : "Loading zone metrics"}
              accent="indigo"
            />
            <StatMetricCard
              label="Zones at Risk"
              value={isLoading ? "--" : `${dashboard?.zonesAtRisk ?? 0}`}
              delta={dashboard ? `${dashboard?.criticalZones?.length ?? 0} critical zones` : "Loading risk profile"}
              deltaDirection="up"
              accent="amber"
            />
            <StatMetricCard
              label="Active Missions"
              value={isLoading ? "--" : `${dashboard?.activeMissions ?? 0}`}
              delta="From coordinator NGO"
              accent="green"
            />
            <StatMetricCard
              label="Volunteers Active"
              value={isLoading ? "--" : `${dashboard?.availableVolunteers ?? 0}`}
              delta="Presence feed from RTDB"
              accent="purple"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-card-gap">
            <div className="lg:col-span-3 space-y-card-gap">
              <div className="rounded-card border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Need Terrain Map</h3>
                    <span className="flex items-center gap-1 text-[11px] text-success font-medium"><span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />Live</span>
                  </div>
                </div>
                <NeedTerrainMap zones={zones} heatmapPoints={heatmapPoints} opacity={0.95} className="h-[260px]" />
                {!token ? <p className="mt-2 text-[11px] text-muted-foreground">Sign in as coordinator to load live terrain hotspots.</p> : null}
                {token && !isLoading && zones.length === 0 && heatmapPoints.length === 0 ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">Live terrain stream connected, but no recent signals are available yet.</p>
                ) : null}
              </div>

              <div className="rounded-card border bg-card p-5 shadow-card">
                <h3 className="text-sm font-semibold text-foreground mb-4">Top Urgent Needs</h3>
                {topZones.length ? topZones.map((zone, index) => {
                  const dominantSignal = Object.entries(zone.signalCounts || {}).sort((left, right) => right[1] - left[1])[0];
                  const signalLabel = dominantSignal ? `${dominantSignal[0].charAt(0).toUpperCase()}${dominantSignal[0].slice(1)} · ${dominantSignal[1]}` : "No live signals";

                  return (
                    <div key={zone.id} className="flex items-center gap-3 py-3 border-b last:border-0">
                      <span className="text-xs font-data text-muted-foreground w-5">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{zone.name}</p>
                        <span className="text-xs text-muted-foreground">{signalLabel}</span>
                      </div>
                      <div className="w-24">
                        <div className="h-1.5 rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", riskPalette[zone.riskLevel])}
                            style={{ width: `${Math.min(100, Math.max(0, zone.currentScore))}%` }}
                          />
                        </div>
                      </div>
                      <ZoneRiskBadge level={zone.riskLevel} score={Math.round(zone.currentScore)} />
                    </div>
                  );
                }) : (
                  <div className="py-4 text-sm text-muted-foreground">No zones available yet.</div>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-card-gap">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Gemini Insights</h3>
                {(insightCards.length ? insightCards : fallbackInsightCards).map((insight, index) => (
                  <GeminiInsightCard
                    key={index}
                    variant={insight.variant}
                    zone={insight.zone}
                    signals={insight.signals}
                    description={insight.description}
                    sourceCount={insight.sourceCount}
                    timestamp={insight.timestamp}
                  />
                ))}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Best Matched Volunteers</h3>
                <VolunteerAvatarCard compact name="Priya R." initials="PR" matchPercent={97} distance="2.1 km" color="bg-primary" />
                <VolunteerAvatarCard compact name="Arjun M." initials="AM" matchPercent={91} distance="3.4 km" color="bg-success" />
              </div>
            </div>
          </div>
        </div>

        <div className="hidden xl:block w-panel-w border-l bg-card overflow-y-auto p-5 space-y-6 shrink-0">
          <CommunityPulseDonut score={Math.round(dashboard?.avgZoneScore ?? 0)} trend="up" />

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">2-Week Forecast</h4>
            <div className="flex items-end gap-1 h-20">
              {[30, 35, 42, 50, 58, 65, 72, 80].map((h, i) => (
                <div key={i} className={cn("flex-1 rounded-t transition-all", h > 65 ? "bg-destructive/70" : h > 45 ? "bg-warning/70" : "bg-success/70")} style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground"><span>W15</span><span>W22</span></div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Active Missions</h4>
            <div className="space-y-2">
              {(dashboard?.criticalZones?.length ? dashboard.criticalZones : [{ name: "Live NGO zones", score: 0, riskLevel: "low" }]).map((zone, index) => (
                <div key={`${zone.name || index}`} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{zone.name || `Zone ${index + 1}`}</span>
                  <MissionStatusChip status={index === 0 ? "in_progress" : index === 1 ? "dispatched" : "completed"} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Camera, label: "Scan Report" },
                { icon: UserPlus, label: "Add Volunteer" },
                { icon: FileText, label: "Generate Brief" },
                { icon: Map, label: "View Map" },
              ].map((a, i) => (
                <button key={i} className="flex flex-col items-center gap-1.5 rounded-card border p-3 text-xs font-medium text-muted-foreground hover:bg-primary-light hover:text-primary hover:border-primary/30 transition-all">
                  <a.icon className="h-4 w-4" />
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
