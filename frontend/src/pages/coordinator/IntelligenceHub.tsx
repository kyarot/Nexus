import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { downloadNexusPdfReport } from "@/lib/pdf-report";
import {
  getCoordinatorDashboard,
  getCoordinatorDriftAlerts,
  getCoordinatorInsights,
  getCoordinatorMissions,
  getCoordinatorVolunteers,
  getCoordinatorZones,
  evaluateCoordinatorDriftAlerts,
  synthesizeCoordinatorInsights,
  type CoordinatorMission,
  type CoordinatorVolunteerItem,
  type CoordinatorZone,
} from "@/lib/coordinator-api";
import { listCoordinatorResourceRequests } from "@/lib/ops-api";
import {
  Shield,
  Sparkles,
  BarChart3,
  TrendingUp,
  FileText,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Download,
  Vote,
  Brain,
  Network,
  Target,
} from "lucide-react";

const navigationTabs = [
  { id: "trust", label: "Trust Fabric", icon: Shield, route: "/dashboard/trust" },
  { id: "insights", label: "Gemini Insights", icon: Sparkles, route: "/dashboard/insights" },
  { id: "reports", label: "Impact Reports", icon: BarChart3, route: "/dashboard/impact" },
  { id: "forecast", label: "Community Forecast", icon: TrendingUp, route: "/dashboard/forecast" },
  { id: "constitution", label: "Living Constitution", icon: FileText, route: "/dashboard/constitution" },
];

const riskBadgeClass: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  high: "bg-warning/10 text-warning",
  medium: "bg-primary/10 text-primary",
  low: "bg-success/10 text-success",
};

const isRecent = (value?: string | null, hours = 24) => {
  if (!value) {
    return false;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return Date.now() - parsed.getTime() <= hours * 60 * 60 * 1000;
};

const formatRelativeTime = (value?: string | null) => {
  if (!value) {
    return "recently";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "recently";
  }
  const diffMinutes = Math.floor((Date.now() - parsed.getTime()) / 60000);
  if (diffMinutes < 1) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return `${Math.floor(diffHours / 24)}d ago`;
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default function IntelligenceHub() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = localStorage.getItem("nexus_access_token");

  const hubQuery = useQuery({
    queryKey: ["coordinator-intelligence-hub", token],
    enabled: Boolean(token),
    refetchInterval: 15_000,
    queryFn: async () => {
      const [dashboard, insights, missions, volunteers, zones, alerts, resourceRequests] = await Promise.allSettled([
        getCoordinatorDashboard(),
        getCoordinatorInsights(),
        getCoordinatorMissions(),
        getCoordinatorVolunteers({ availability: "available_now", sortBy: "match", minMatch: 55, maxDistanceKm: 25 }),
        getCoordinatorZones(),
        getCoordinatorDriftAlerts({ status: "active" }),
        listCoordinatorResourceRequests("pending"),
      ]);

      return {
        dashboard: dashboard.status === "fulfilled" ? dashboard.value : null,
        insights: insights.status === "fulfilled" ? insights.value.insights : [],
        missions: missions.status === "fulfilled" ? missions.value.missions : [],
        volunteers: volunteers.status === "fulfilled" ? volunteers.value.volunteers : [],
        zones: zones.status === "fulfilled" ? zones.value.zones : [],
        alerts: alerts.status === "fulfilled" ? alerts.value : null,
        resourceRequests: resourceRequests.status === "fulfilled" ? resourceRequests.value.requests : [],
      };
    },
  });

  const refreshAll = async () => {
    await hubQuery.refetch();
  };

  const synthesizeMutation = useMutation({
    mutationFn: synthesizeCoordinatorInsights,
    onSuccess: async (result) => {
      toast({
        title: "Insight report generated",
        description: `Updated ${result.zonesUpdated} zones from ${result.reportsAdded} reports.`,
      });
      await refreshAll();
    },
    onError: (error) => {
      toast({
        title: "Insight generation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const forecastMutation = useMutation({
    mutationFn: () => evaluateCoordinatorDriftAlerts(),
    onSuccess: async (result) => {
      toast({
        title: "Forecast refreshed",
        description: `Re-evaluated ${result.updated} alerts and triggered ${result.triggered} new signals.`,
      });
      await refreshAll();
    },
    onError: (error) => {
      toast({
        title: "Forecast refresh failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const data = hubQuery.data;
  const dashboard = data?.dashboard;
  const insights = data?.insights ?? [];
  const missions = data?.missions ?? [];
  const volunteers = data?.volunteers ?? [];
  const zones = data?.zones ?? [];
  const alerts = data?.alerts;
  const resourceRequests = data?.resourceRequests ?? [];

  const completedMissions = useMemo(
    () => missions.filter((mission: CoordinatorMission) => mission.status === "completed"),
    [missions]
  );

  const recentCompletedMissions = useMemo(
    () => completedMissions.filter((mission) => isRecent(mission.completedAt || mission.updatedAt || mission.createdAt, 7 * 24)),
    [completedMissions]
  );

  const topZones = useMemo(
    () => [...zones].sort((left, right) => right.currentScore - left.currentScore).slice(0, 4),
    [zones]
  );

  const topVolunteers = useMemo(
    () => [...volunteers].sort((left, right) => right.matchPercent - left.matchPercent).slice(0, 2),
    [volunteers]
  );

  const totalReports = useMemo(
    () => insights.reduce((sum: number, insight) => sum + (insight.sourceReports?.length ?? insight.reportCount ?? 0), 0),
    [insights]
  );

  const trustScore = Math.round(dashboard?.avgZoneScore ?? (zones.length ? zones.reduce((sum, zone: CoordinatorZone) => sum + zone.currentScore, 0) / zones.length : 0));
  const verifiedNodes = dashboard?.zoneCount ?? zones.length;
  const verificationsToday = completedMissions.filter((mission) => isRecent(mission.completedAt || mission.updatedAt || mission.createdAt, 24)).length;
  const trustTone = trustScore >= 80 ? "Strong" : trustScore >= 60 ? "Watch" : "Needs attention";

  const alertCounts = alerts?.counts;
  const activeAlertCount = alertCounts?.active ?? alerts?.alerts.length ?? 0;
  const criticalAlertCount = alertCounts?.critical ?? alerts?.alerts.filter((alert) => alert.severity === "critical").length ?? 0;
  const primaryAlert = alerts?.alerts.find((alert) => alert.severity === "critical") || alerts?.alerts[0];
  const activeInsight = insights[0];

  const processingReports = Math.max(totalReports, activeInsight?.reportCount ?? 0);
  const insightHeadline = primaryAlert?.title || activeInsight?.summary || "Signals are being processed in real time.";
  const insightDetail = primaryAlert?.recommendedAction || activeInsight?.recommendedAction || "Latest signals are feeding the coordinator model.";

  const completedCount = completedMissions.length;
  const successRate = missions.length ? Math.round((completedCount / missions.length) * 100) : 0;
  const familiesHelped = recentCompletedMissions.reduce((sum, mission) => sum + toNumber(mission.familiesHelped), 0);

  const forecastRiskLabel = criticalAlertCount > 0 || (dashboard?.zonesAtRisk ?? 0) > 0 ? "Elevated" : trustScore >= 75 ? "Stable" : "Watch";
  const forecastTrendDirection = topZones[0]?.trendDirection ?? (dashboard?.avgZoneScore && dashboard.avgZoneScore > 70 ? "up" : "stable");
  const forecastTrendLabel = forecastTrendDirection === "up" ? "Trending up" : forecastTrendDirection === "down" ? "Trending down" : "Holding steady";
  const forecastSummary = topZones[0]?.topNeeds?.[0] || primaryAlert?.summary || "Need mix is balancing across the busiest zones.";
  const nextUpdateHours = criticalAlertCount > 0 ? 3 : 6;

  const pendingVotes = resourceRequests.length;
  const recentChanges = insights.filter((insight) => isRecent(insight.generatedAt, 14 * 24)).length + recentCompletedMissions.length;
  const activePolicies = Math.max(zones.length, dashboard?.zoneCount ?? 0) + Math.max(activeAlertCount, 0);
  const constitutionSummary = pendingVotes
    ? `${pendingVotes} resource decisions are waiting for coordinator review.`
    : "No open governance votes are waiting right now.";

  const operational = !hubQuery.isError && Boolean(token) && criticalAlertCount === 0;
  const generatedAt = [dashboard?.recentInsights?.[0]?.generatedAt, activeInsight?.generatedAt, topZones[0]?.updatedAt].find(Boolean);

  const downloadHubReport = () => {
    if (!data) {
      return;
    }

    downloadNexusPdfReport({
      fileName: `nexus-intelligence-hub-${new Date().toISOString().slice(0, 10)}.pdf`,
      reportTitle: "Nexus Intelligence Hub",
      reportSubtitle: "Unified operational summary across trust, alerts, forecasts, and governance.",
      generatedAt: new Date().toISOString(),
      meta: [
        { label: "Verified Zones", value: String(verifiedNodes) },
        { label: "Volunteers", value: String(dashboard?.availableVolunteers ?? volunteers.length) },
        { label: "Critical Alerts", value: String(criticalAlertCount) },
      ],
      metrics: [
        { label: "Trust Score", value: String(trustScore), note: `Verified nodes: ${verifiedNodes}` },
        { label: "Reports", value: String(totalReports), note: `Success rate ${successRate}%` },
        { label: "Families Helped", value: String(familiesHelped), note: `Completed missions ${completedCount}` },
        { label: "Forecast", value: forecastRiskLabel, note: forecastTrendLabel },
      ],
      sections: [
        {
          title: "Trust Fabric",
          lines: [
            `Trust score: ${trustScore}`,
            `Verified nodes: ${verifiedNodes}`,
            `Verifications today: ${verificationsToday}`,
          ],
        },
        {
          title: "Gemini Insights",
          lines: [
            `Active alerts: ${activeAlertCount}`,
            `Critical alerts: ${criticalAlertCount}`,
            `Processing reports: ${processingReports}`,
            insightHeadline || "No headline available",
          ],
        },
        {
          title: "Community Forecast",
          lines: [
            `Trend: ${forecastTrendLabel}`,
            `Next update in: ${nextUpdateHours} hours`,
            forecastSummary,
          ],
        },
        {
          title: "Living Constitution",
          lines: [
            `Pending votes: ${pendingVotes}`,
            `Recent changes: ${recentChanges}`,
            `Active policies: ${activePolicies}`,
            constitutionSummary,
          ],
        },
      ],
      footerNote: "Nexus intelligence hub export.",
    });
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardTopBar
        breadcrumb="Intelligence Hub"
        subtext={token ? `Live backend sync · ${verifiedNodes} zones · ${dashboard?.availableVolunteers ?? volunteers.length} volunteers available` : "Sign in as coordinator to load live intelligence."}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="bg-card rounded-card border shadow-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Intelligence Overview</h1>
              <p className="text-sm text-muted-foreground mt-1">Real-time insights from all coordination systems</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("flex items-center gap-1.5 text-xs font-medium", operational ? "text-success" : "text-warning")}>
                <span className={cn("w-2 h-2 rounded-full animate-pulse", operational ? "bg-success" : "bg-warning")} />
                {operational ? "All systems operational" : hubQuery.isFetching ? "Synchronizing live data" : "Reviewing live signals"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {navigationTabs.map((tab) => (
              <Button key={tab.id} variant="outline" className="flex items-center gap-2 rounded-pill" onClick={() => navigate(tab.route)}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
                <ArrowRight className="w-3 h-3" />
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <div className="bg-card rounded-card border shadow-card p-6 relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Trust Fabric</h3>
                  <p className="text-xs text-muted-foreground">Network integrity</p>
                </div>
              </div>
              <Link to="/dashboard/trust" className="text-xs text-primary hover:underline font-medium">View Full →</Link>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Trust Score</span>
                <span className="text-2xl font-bold text-green-600">{hubQuery.isLoading ? "--" : trustScore}</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-foreground">{verifiedNodes} verified nodes</span>
                  <Badge variant="outline" className="text-[10px] px-2 py-0">{trustTone}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-600">{verificationsToday} new verifications today</span>
                </div>
              </div>

              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, trustScore))}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-card border shadow-card p-6 relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Gemini Insights</h3>
                  <p className="text-xs text-muted-foreground">AI intelligence</p>
                </div>
              </div>
              <Link to="/dashboard/insights" className="text-xs text-primary hover:underline font-medium">View Full →</Link>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Alerts</span>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-[10px] px-2 py-0">{criticalAlertCount}</Badge>
                  <Badge className="text-[10px] px-2 py-0 bg-warning/10 text-warning">{activeAlertCount}</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="text-xs text-foreground">{insightHeadline}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Processing {processingReports} reports</span>
                </div>
              </div>

              <div className="bg-primary-light rounded-lg p-3">
                <p className="text-xs text-primary font-medium">"{insightDetail}"</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-card border shadow-card p-6 relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Impact Reports</h3>
                  <p className="text-xs text-muted-foreground">Performance metrics</p>
                </div>
              </div>
              <Link to="/dashboard/impact" className="text-xs text-primary hover:underline font-medium">View Full →</Link>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-foreground">{totalReports.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Reports</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">{successRate}%</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Success</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-foreground">{familiesHelped} families helped this week</span>
              </div>

              <Button variant="outline" size="sm" className="w-full text-xs" onClick={downloadHubReport} disabled={!data}>
                <Download className="w-3 h-3 mr-2" />
                Download Weekly Report
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-card border shadow-card p-6 relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Community Forecast</h3>
                  <p className="text-xs text-muted-foreground">Predictive analytics</p>
                </div>
              </div>
              <Link to="/dashboard/forecast" className="text-xs text-primary hover:underline font-medium">View Full →</Link>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Risk Level</span>
                <Badge className={cn("text-[10px] px-2 py-0", forecastRiskLabel === "Elevated" ? "bg-warning/10 text-warning" : forecastRiskLabel === "Watch" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")}>{forecastRiskLabel}</Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-warning" />
                  <span className="text-xs text-foreground">{forecastTrendLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Next update: {nextUpdateHours} hours</span>
                </div>
              </div>

              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-xs text-orange-700 font-medium">{forecastSummary || "Forecast data is being synthesized from live zone telemetry."}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-card border shadow-card p-6 relative overflow-hidden xl:col-span-2">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Living Constitution</h3>
                  <p className="text-xs text-muted-foreground">Governance & policies</p>
                </div>
              </div>
              <Link to="/dashboard/constitution" className="text-xs text-primary hover:underline font-medium">View Full →</Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Vote className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-foreground">Pending Votes</span>
                </div>
                <div className="text-xl font-bold text-primary">{pendingVotes}</div>
                <p className="text-[10px] text-muted-foreground">Resource allocation amendments</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-medium text-foreground">Recent Changes</span>
                </div>
                <div className="text-xl font-bold text-green-600">{recentChanges}</div>
                <p className="text-[10px] text-muted-foreground">Policies and briefs updated</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">Active Policies</span>
                </div>
                <div className="text-xl font-bold text-foreground">{activePolicies}</div>
                <p className="text-[10px] text-muted-foreground">Live governance rules in effect</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-card rounded-card border shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Verified Mission Outcomes</h3>
              <Link to="/dashboard/impact" className="text-xs text-primary hover:underline font-medium">View ledger →</Link>
            </div>
            <div className="space-y-3">
              {missions.slice(0, 4).map((mission: CoordinatorMission, index: number) => {
                const beforeScore = topZones.find((zone) => zone.id === mission.zoneId)?.currentScore ?? dashboard?.avgZoneScore ?? 0;
                const afterScore = mission.status === "completed" ? Math.max(0, beforeScore - Math.min(20, Math.max(2, Math.round((mission.familiesHelped || 0) / 2)))) : beforeScore;
                const deltaScore = Math.round(beforeScore - afterScore);

                return (
                  <div key={mission.id} className={cn("flex items-center gap-3 py-3 border-b last:border-0", index % 2 === 1 ? "bg-background/40" : "") }>
                    <div className="text-xs font-data text-muted-foreground w-12">{mission.id.slice(0, 6)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{mission.title}</p>
                      <span className="text-xs text-muted-foreground">{mission.zoneName || mission.ward || "Zone"} · {mission.needType}</span>
                    </div>
                    <div className="w-20 text-right text-xs font-data text-muted-foreground">{Math.round(beforeScore)} → {Math.round(afterScore)}</div>
                    <div className={cn("text-xs font-semibold", deltaScore > 0 ? "text-success" : "text-muted-foreground")}>{deltaScore > 0 ? `-${deltaScore}` : "0"}</div>
                    <Badge className="text-[10px] px-2 py-0" variant={mission.status === "completed" ? "success" : "secondary"}>{mission.status}</Badge>
                  </div>
                );
              })}
              {!missions.length ? <p className="text-sm text-muted-foreground">No mission outcomes are available yet.</p> : null}
            </div>
          </div>

          <div className="bg-card rounded-card border shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Best Matched Volunteers</h3>
              <Link to="/dashboard/volunteers" className="text-xs text-primary hover:underline font-medium">Open roster →</Link>
            </div>
            <div className="space-y-3">
              {topVolunteers.map((volunteer: CoordinatorVolunteerItem) => (
                <div key={volunteer.id} className="rounded-card border bg-background p-4 flex items-center gap-4">
                  <div className={cn("h-11 w-11 rounded-full text-white flex items-center justify-center font-bold", volunteer.color || "bg-primary")}>{volunteer.initials}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{volunteer.name}</p>
                    <p className="text-xs text-muted-foreground">{volunteer.org} · {volunteer.availability}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{volunteer.matchPercent}%</p>
                    <p className="text-[10px] text-muted-foreground">{volunteer.distance}</p>
                  </div>
                </div>
              ))}
              {!topVolunteers.length ? <p className="text-sm text-muted-foreground">No volunteer matches found for the current filters.</p> : null}
            </div>
          </div>
        </div>

        <div className="bg-card rounded-card border shadow-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top Urgent Needs</h3>
          <div className="space-y-3">
            {topZones.map((zone, index) => {
              const dominantSignal = Object.entries(zone.signalCounts || {}).sort((left, right) => right[1] - left[1])[0];
              const signalLabel = dominantSignal ? `${dominantSignal[0].charAt(0).toUpperCase()}${dominantSignal[0].slice(1)} · ${dominantSignal[1]}` : "No live signals";

              return (
                <div key={zone.id} className="flex items-center gap-3 py-3 border-b last:border-0">
                  <span className="text-xs font-data text-muted-foreground w-5">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{zone.name}</p>
                    <span className="text-xs text-muted-foreground">{signalLabel}</span>
                  </div>
                  <div className="w-28">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full", riskBadgeClass[zone.riskLevel] || "bg-primary") } style={{ width: `${Math.min(100, Math.max(0, zone.currentScore))}%` }} />
                    </div>
                  </div>
                  <Badge className={cn("text-[10px] px-2 py-0", riskBadgeClass[zone.riskLevel] || "bg-primary/10 text-primary")}>{Math.round(zone.currentScore)}</Badge>
                </div>
              );
            })}
            {!topZones.length ? <p className="text-sm text-muted-foreground">No zones available yet.</p> : null}
          </div>
        </div>

        <div className="bg-card rounded-card border shadow-card p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Quick Intelligence Actions</h3>
              <p className="text-xs text-muted-foreground mt-1">All actions are wired to live coordinator endpoints.</p>
            </div>
            {generatedAt ? <div className="text-[11px] text-muted-foreground">Last updated {formatRelativeTime(generatedAt)}</div> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={() => synthesizeMutation.mutate()} disabled={synthesizeMutation.isPending}>
              <Sparkles className="w-4 h-4" />
              {synthesizeMutation.isPending ? "Generating..." : "Generate Insight Report"}
            </Button>
            <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={downloadHubReport} disabled={!data}>
              <BarChart3 className="w-4 h-4" />
              Export Analytics
            </Button>
            <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={() => forecastMutation.mutate()} disabled={forecastMutation.isPending}>
              <TrendingUp className="w-4 h-4" />
              {forecastMutation.isPending ? "Running..." : "Run Forecast"}
            </Button>
            <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={() => hubQuery.refetch()} disabled={hubQuery.isFetching}>
              <Shield className="w-4 h-4" />
              Verify Trust Network
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-card border shadow-card p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Living Constitution Brief</h3>
                <p className="text-xs text-muted-foreground">Generated from resource votes, insights, and zone updates</p>
              </div>
            </div>
            <Link to="/dashboard/constitution" className="text-xs text-primary hover:underline font-medium">Open brief →</Link>
          </div>
          <div className="rounded-lg border bg-background p-4 text-sm text-foreground leading-relaxed space-y-2">
            <p className="font-semibold">Operational Policy Snapshot</p>
            <p>{constitutionSummary}</p>
            <p>{recentChanges} updates were folded into the live governance model in the last two weeks.</p>
            <p>{Math.max(activePolicies, verifiedNodes)} live rules are currently shaping dispatch and approvals.</p>
          </div>
          <div className="mt-4 flex gap-2 flex-wrap">
            <Button size="sm" variant="ghost" onClick={downloadHubReport}>
              <Download className="h-4 w-4 mr-1" />Download brief
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/constitution")}>
              <FileText className="h-4 w-4 mr-1" />Review policy queue
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-card border shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Operational Snapshot</h3>
            <span className="text-xs text-muted-foreground">Dashboard · Insights · Missions · Volunteers · Zones</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
            <div className="rounded-card border bg-background p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Zones</p>
              <p className="mt-2 text-xl font-bold text-foreground">{verifiedNodes}</p>
            </div>
            <div className="rounded-card border bg-background p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Volunteers</p>
              <p className="mt-2 text-xl font-bold text-foreground">{dashboard?.availableVolunteers ?? volunteers.length}</p>
            </div>
            <div className="rounded-card border bg-background p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Open Alerts</p>
              <p className="mt-2 text-xl font-bold text-foreground">{activeAlertCount}</p>
            </div>
            <div className="rounded-card border bg-background p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Completed Missions</p>
              <p className="mt-2 text-xl font-bold text-foreground">{completedCount}</p>
            </div>
            <div className="rounded-card border bg-background p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Pending Votes</p>
              <p className="mt-2 text-xl font-bold text-foreground">{pendingVotes}</p>
            </div>
            <div className="rounded-card border bg-background p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Report Packets</p>
              <p className="mt-2 text-xl font-bold text-foreground">{processingReports}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}