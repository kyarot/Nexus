import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { SignalPill } from "@/components/coordinator/SignalPill";
import { ZoneRiskBadge } from "@/components/coordinator/ZoneRiskBadge";
import { EmptyState } from "@/components/coordinator/EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  createMissionFromDriftAlert,
  dismissCoordinatorDriftAlert,
  evaluateCoordinatorDriftAlerts,
  getCoordinatorDriftAlerts,
  type CoordinatorDriftAlert,
} from "@/lib/coordinator-api";
import { isQueuedResult } from "@/lib/offline-outbox";

const relativeTime = (value?: string | null) => {
  if (!value) return "just now";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "just now";
  const diffMs = Date.now() - parsed.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
};

const toZoneRiskLevel = (alert: CoordinatorDriftAlert): "critical" | "high" | "medium" | "low" => {
  if (alert.severity === "critical") return "critical";
  if (alert.severity === "high") return "high";
  if (alert.status === "resolved") return "low";
  return "medium";
};

export default function AlertsFeed() {
  const token = localStorage.getItem("nexus_access_token");
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const [filter, setFilter] = useState("All");
  const [expandedResolved, setExpandedResolved] = useState<string[]>([]);
  const [expandedSources, setExpandedSources] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);

  const alertsQuery = useQuery({
    queryKey: ["coordinator-drift-alerts", token],
    queryFn: () => getCoordinatorDriftAlerts(),
    enabled: Boolean(token),
    refetchInterval: 10_000,
  });

  const evaluateMutation = useMutation({
    mutationFn: () => evaluateCoordinatorDriftAlerts(),
    onSuccess: () => alertsQuery.refetch(),
  });

  const createMissionMutation = useMutation({
    mutationFn: (alertId: string) => createMissionFromDriftAlert(alertId),
    onSuccess: (payload) => {
      if (isQueuedResult(payload)) {
        toast({
          title: "Mission queued",
          description: "Will sync when connectivity returns.",
        });
        return;
      }
      alertsQuery.refetch();
      toast({
        title: payload.created ? "Mission created" : "Mission already linked",
        description: payload.autoAssigned
          ? "Volunteer was auto-assigned automatically."
          : "Mission created, assignment may be pending.",
      });
    },
    onError: (error) => {
      toast({ title: "Mission action failed", description: error instanceof Error ? error.message : "Unknown error" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: ({ alertId, reason }: { alertId: string; reason: string }) => dismissCoordinatorDriftAlert(alertId, reason),
    onSuccess: (payload) => {
      if (isQueuedResult(payload)) {
        toast({ title: "Dismissal queued", description: "Will sync when connectivity returns." });
        return;
      }
      alertsQuery.refetch();
      toast({ title: "Alert dismissed", description: "Dismiss reason saved." });
    },
    onError: (error) => {
      toast({ title: "Dismiss failed", description: error instanceof Error ? error.message : "Unknown error" });
    },
  });

  useEffect(() => {
    if (!token || !isOnline) {
      return;
    }

    const streamUrl = `${apiBaseUrl}/coordinator/drift-alerts/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(streamUrl);

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        if (payload?.type === "drift_alert_update") {
          alertsQuery.refetch();
        }
      } catch {
        // Ignore malformed stream payloads.
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [alertsQuery, apiBaseUrl, token, isOnline]);

  const alerts = alertsQuery.data?.alerts ?? [];
  const counts = alertsQuery.data?.counts;

  const zones = useMemo(() => {
    const names = new Set<string>();
    alerts.forEach((alert) => {
      if (alert.zoneName) {
        names.add(alert.zoneName);
      }
    });
    return Array.from(names).sort();
  }, [alerts]);

  const filtered = useMemo(() => {
    return alerts.filter((alert) => {
      if (filter === "Critical" && alert.severity !== "critical") return false;
      if (filter === "High" && alert.severity !== "high") return false;
      if (filter === "Watch" && alert.severity !== "watch") return false;
      if (filter === "Actioned" && alert.status !== "actioned") return false;
      if (filter === "Resolved" && alert.status !== "resolved") return false;

      if (selectedZones.length > 0 && !selectedZones.includes(alert.zoneName)) return false;
      return true;
    });
  }, [alerts, filter, selectedZones]);

  const borderColor = { critical: "border-l-destructive", high: "border-l-warning", medium: "border-l-primary", low: "border-l-success", insufficient: "border-l-muted" };

  return (
    <div className="flex flex-col h-full">
      <DashboardTopBar breadcrumb="Drift Alerts" />
      <div className="flex flex-1 overflow-hidden">
        {/* Filter sidebar */}
        <div className="hidden md:block w-[200px] shrink-0 border-r bg-card p-4 overflow-y-auto space-y-5">
          <h3 className="text-sm font-semibold text-foreground">Filter by</h3>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase">Zone</p>
            {zones.map((zone) => (
              <label key={zone} className="flex items-center gap-2 text-xs text-foreground">
                <Checkbox
                  checked={selectedZones.includes(zone)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedZones((prev) => prev.includes(zone) ? prev : [...prev, zone]);
                    } else {
                      setSelectedZones((prev) => prev.filter((item) => item !== zone));
                    }
                  }}
                />
                {zone}
              </label>
            ))}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase">Actions</p>
            <Button size="sm" variant="outline" className="w-full" onClick={() => evaluateMutation.mutate()}>
              Re-evaluate
            </Button>
            <Button size="sm" variant="ghost" className="w-full" onClick={() => setSelectedZones([])}>
              Clear Filters
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-6 gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">Drift Alerts</h1>
              <p className="text-sm text-muted-foreground">
                {counts ? `${counts.active + counts.actioned} active this week · ${counts.critical} critical` : "Live trend and prediction feed"}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex gap-1 overflow-x-auto">
                {["All", "Critical", "High", "Watch", "Actioned", "Resolved"].map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={cn("rounded-pill px-3 py-1 text-xs font-medium transition-all whitespace-nowrap", filter === f ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}>{f}</button>
                ))}
              </div>
              <button className="text-xs text-primary font-medium hover:underline" onClick={() => alertsQuery.refetch()}>Refresh</button>
            </div>
          </div>

          {alertsQuery.isLoading ? (
            <div className="py-6 text-sm text-muted-foreground">Loading drift alerts...</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={AlertTriangle} heading="No alerts match your filters" subtext="Try adjusting your filter criteria" actionLabel="Clear filters" onAction={() => setFilter("All")} />
          ) : (
            <div className="space-y-4">
              {filtered.map((alert) => {
                const zoneRisk = toZoneRiskLevel(alert);
                const isResolvedLike = ["resolved", "dismissed", "expired"].includes(alert.status);
                const showCollapsed = isResolvedLike && !expandedResolved.includes(alert.id);
                const createLabel = alert.severity === "watch" ? "Schedule Follow-up Survey →" : "Create Mission →";

                return (
                <div key={alert.id} className={cn("rounded-card border border-l-4 bg-card p-4 md:p-5 shadow-card transition-opacity", borderColor[zoneRisk], isResolvedLike && "opacity-80")}>
                  {showCollapsed ? (
                    <button onClick={() => setExpandedResolved((prev) => [...prev, alert.id])} className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-foreground">{alert.title}</span>
                        <ZoneRiskBadge level={zoneRisk} />
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ) : (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-foreground">{alert.title}</span>
                          <ZoneRiskBadge level={zoneRisk} />
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{alert.status}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{relativeTime(alert.updatedAt || alert.triggeredAt)}</span>
                      </div>
                      {(alert.signals || []).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {(alert.signals || []).map((signal, index) => (
                            <SignalPill key={`${signal.label}-${index}`} label={signal.label} variant={signal.variant} />
                          ))}
                        </div>
                      )}
                      <p className="mt-3 text-sm text-foreground leading-relaxed">{alert.summary}</p>

                      {alert.predictionText ? (
                        <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm text-foreground/90">{alert.predictionText}</div>
                      ) : null}

                      {alert.recommendedAction ? (
                        <p className="mt-3 text-sm text-foreground/80"><span className="font-semibold">Gemini recommendation:</span> {alert.recommendedAction}</p>
                      ) : null}

                      {alert.linkedMissionId ? (
                        <p className="mt-2 text-xs font-medium text-success">Linked mission: {alert.linkedMissionId}</p>
                      ) : null}

                      {!isResolvedLike && (
                        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                          <span className="text-xs text-muted-foreground">Detected {relativeTime(alert.triggeredAt || alert.createdAt)}</span>
                          <div className="flex flex-wrap gap-2 sm:ml-auto">
                            <Button size="sm" variant="gradient" onClick={() => createMissionMutation.mutate(alert.id)} disabled={createMissionMutation.isPending}>
                              {createLabel}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedSources((prev) => prev.includes(alert.id) ? prev.filter((item) => item !== alert.id) : [...prev, alert.id])}
                            >
                              View source reports
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const reason = window.prompt("Dismiss reason (required):", "already handled");
                                if (!reason || !reason.trim()) {
                                  return;
                                }
                                dismissMutation.mutate({ alertId: alert.id, reason: reason.trim() });
                              }}
                              disabled={dismissMutation.isPending}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      )}

                      {expandedSources.includes(alert.id) && (alert.sourceReports || []).length > 0 ? (
                        <div className="mt-3 space-y-2 rounded-lg border bg-muted/20 p-3">
                          {(alert.sourceReports || []).map((report) => (
                            <div key={report.id} className="text-xs text-foreground/80">
                              {report.needType || "need"} · {report.severity || "unknown"} · {report.familiesAffected || 0} families · {relativeTime(report.createdAt)}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {isResolvedLike && (
                        <button onClick={() => setExpandedResolved((prev) => prev.filter((item) => item !== alert.id))} className="mt-2 text-xs text-primary hover:underline flex items-center gap-1">
                          <ChevronUp className="h-3 w-3" />Collapse
                        </button>
                      )}
                    </>
                  )}
                </div>
              )})}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
