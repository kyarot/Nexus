import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, X, Users, Zap } from "lucide-react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { NeedTerrainMap } from "@/components/coordinator/NeedTerrainMap";
import { ZoneRiskBadge } from "@/components/coordinator/ZoneRiskBadge";
import { SignalPill } from "@/components/coordinator/SignalPill";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getCoordinatorTerrainSidebar,
  getCoordinatorTerrainSnapshot,
  getCoordinatorZoneDetail,
  getCoordinatorZoneHistory,
} from "@/lib/coordinator-api";
import { downloadTerrainMapSnapshotPng } from "@/lib/terrain-map-export";

const filters = ["All Needs", "Food", "Health", "Education", "Shelter", "Mental Health"];

export default function NeedTerrainMapPage() {
  const [activeFilter, setActiveFilter] = useState("All Needs");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isZonePanelOpen, setIsZonePanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");
  const [opacity, setOpacity] = useState([70]);

  const token = localStorage.getItem("nexus_access_token");
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  const terrainSnapshotQuery = useQuery({
    queryKey: ["coordinator-terrain-snapshot", token, activeFilter],
    queryFn: () =>
      getCoordinatorTerrainSnapshot({
        needType: activeFilter === "All Needs" ? undefined : activeFilter.toLowerCase(),
        confidenceMin: 15,
        sinceHours: 168,
      }),
    enabled: Boolean(token),
    refetchInterval: 5_000,
  });

  const selectedZoneQuery = useQuery({
    queryKey: ["coordinator-zone-detail", selectedZoneId, token],
    queryFn: () => getCoordinatorZoneDetail(selectedZoneId as string),
    enabled: Boolean(token && selectedZoneId),
  });

  const selectedHistoryQuery = useQuery({
    queryKey: ["coordinator-zone-history", selectedZoneId, token],
    queryFn: () => getCoordinatorZoneHistory(selectedZoneId as string),
    enabled: Boolean(token && selectedZoneId),
  });

  const selectedSidebarQuery = useQuery({
    queryKey: ["coordinator-terrain-sidebar", selectedZoneId, token],
    queryFn: () => getCoordinatorTerrainSidebar(selectedZoneId as string),
    enabled: Boolean(token && selectedZoneId),
    staleTime: 30_000,
  });

  const zoneList = terrainSnapshotQuery.data?.zones ?? [];
  const filteredZones = useMemo(() => {
    if (activeFilter === "All Needs") {
      return zoneList;
    }

    const needle = activeFilter.toLowerCase();
    return zoneList.filter((zone) => {
      if (Array.isArray(zone.topNeeds) && zone.topNeeds.some((need) => String(need).toLowerCase().includes(needle))) {
        return true;
      }
      return Object.entries(zone.signalCounts || {}).some(([key, value]) => key.toLowerCase().includes(needle) && Number(value) > 0);
    });
  }, [activeFilter, zoneList]);

  const filteredHeatmapPoints = useMemo(() => {
    const points = terrainSnapshotQuery.data?.points ?? [];
    if (!points.length) {
      return [];
    }

    if (activeFilter === "All Needs") {
      return points;
    }

    const needle = activeFilter.toLowerCase();
    const zoneIds = new Set(filteredZones.map((zone) => zone.id));
    return points.filter((point) => zoneIds.has(point.zoneId) && String(point.needType || "").toLowerCase().includes(needle));
  }, [activeFilter, filteredZones, terrainSnapshotQuery.data]);

  const selectedZone = selectedZoneQuery.data?.zone;
  const selectedSidebar = selectedSidebarQuery.data;
  const selectedHistory = selectedHistoryQuery.data?.history ?? selectedZone?.scoreHistory ?? [];

  useEffect(() => {
    if (!token) {
      return;
    }

    const streamUrl = `${apiBaseUrl}/coordinator/terrain/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(streamUrl);

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        if (payload?.type !== "terrain_update") {
          return;
        }
        terrainSnapshotQuery.refetch();
        if (selectedZoneId) {
          selectedZoneQuery.refetch();
          selectedHistoryQuery.refetch();
          selectedSidebarQuery.refetch();
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
  }, [
    apiBaseUrl,
    token,
    selectedZoneId,
    terrainSnapshotQuery,
    selectedZoneQuery,
    selectedHistoryQuery,
    selectedSidebarQuery,
  ]);

  useEffect(() => {
    if (!isZonePanelOpen) {
      return;
    }

    if (!selectedZoneId && filteredZones.length > 0) {
      setSelectedZoneId(filteredZones[0].id);
      return;
    }

    if (selectedZoneId && filteredZones.length > 0 && !filteredZones.some((zone) => zone.id === selectedZoneId)) {
      setSelectedZoneId(filteredZones[0].id);
    }
  }, [filteredZones, isZonePanelOpen, selectedZoneId]);

  const totalZones = filteredZones.length;
  const criticalZones = filteredZones.filter((zone) => zone.riskLevel === "critical").length;
  const highZones = filteredZones.filter((zone) => zone.riskLevel === "high").length;
  const improvingZones = filteredZones.filter((zone) => zone.currentScore < 50).length;

  const handleExportMap = () => {
    downloadTerrainMapSnapshotPng({
      fileName: `nexus-terrain-map-${new Date().toISOString().slice(0, 10)}.png`,
      title: "Need Terrain Map",
      subtitle: "Live community need terrain export",
      filterLabel: activeFilter,
      zones: filteredZones,
      points: filteredHeatmapPoints,
    });
  };

  const historyBars = useMemo(() => {
    if ((selectedSidebar?.incidentFrequency || []).length > 0) {
      return selectedSidebar!.incidentFrequency.map((entry, index) => ({
        week: index + 1,
        score: entry.value,
        actual: entry.value,
      }));
    }

    if (selectedHistory.length > 0) {
      return selectedHistory;
    }

    return Array.from({ length: 8 }, (_, index) => ({ week: index + 1, score: 0, actual: 0 }));
  }, [selectedSidebar, selectedHistory]);

  const chartMax = Math.max(...historyBars.map((item) => Number(item.actual ?? item.score ?? 0)), 1);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <DashboardTopBar breadcrumb="Need Terrain Map" />

      <div className="relative flex-1 overflow-hidden">
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-card bg-card/95 backdrop-blur-sm p-2 px-4 shadow-card border">
            <span className="text-sm font-semibold text-foreground">Need Terrain Map</span>
            <span className="flex items-center gap-1 text-[11px] text-success font-medium"><span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />Live</span>
            <div className="ml-3 flex gap-1">
              {filters.map((filter) => (
                <button key={filter} onClick={() => setActiveFilter(filter)} className={cn("rounded-pill px-3 py-1 text-xs font-medium transition-all", activeFilter === filter ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}>{filter}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={handleExportMap} disabled={!filteredZones.length && !filteredHeatmapPoints.length}>
              <Download className="mr-2 h-4 w-4" /> Export Map
            </Button>
          </div>
        </div>

        <NeedTerrainMap
          className="h-full"
          zones={filteredZones}
          showLegend={false}
          heatmapPoints={filteredHeatmapPoints}
          opacity={opacity[0] / 100}
          onZoneClick={(zone) => {
            setIsZonePanelOpen(true);
            setSelectedZoneId(zone.id);
          }}
        />

        <div className="absolute top-20 right-4 z-10 rounded-card bg-card/95 backdrop-blur-sm p-4 shadow-card border text-xs space-y-2">
          {[{ l: "Total Zones", v: totalZones }, { l: "Critical", v: criticalZones }, { l: "High", v: highZones }, { l: "Improving", v: improvingZones }].map((stat) => (
            <div key={stat.l} className="flex justify-between gap-6"><span className="text-muted-foreground">{stat.l}</span><span className="font-semibold font-data text-foreground">{stat.v}</span></div>
          ))}
        </div>

        <div className="absolute bottom-4 left-4 z-10 rounded-card bg-card/95 backdrop-blur-sm p-4 shadow-card border space-y-3">
          <div className="flex gap-4 text-xs font-medium">
            {[{ c: "bg-destructive", l: "Critical" }, { c: "bg-warning", l: "High" }, { c: "bg-primary", l: "Medium" }, { c: "bg-success", l: "Low" }, { c: "bg-muted-foreground", l: "Insufficient" }].map((legend) => (
              <span key={legend.l} className="flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-full", legend.c)} />{legend.l}</span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground">Opacity</span>
            <Slider value={opacity} onValueChange={setOpacity} max={100} className="w-32" />
          </div>
        </div>

        {selectedZone && isZonePanelOpen && (
          <div className="absolute right-0 top-0 bottom-0 z-20 w-[400px] border-l bg-card shadow-elevated flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-6 scrollbar-none">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{selectedZone.name} — {selectedZone.ward || selectedZone.city || "Zone"}</h2>
                  <div className="mt-1 flex gap-2">
                    <ZoneRiskBadge level={selectedZone.riskLevel} score={Math.round(selectedZone.currentScore)} />
                    <span className="text-xs text-muted-foreground">Updated {selectedSidebar?.badges?.lastUpdateLabel || (selectedZone.updatedAt ? new Date(selectedZone.updatedAt).toLocaleString() : "recently")}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsZonePanelOpen(false);
                    setSelectedZoneId(null);
                  }}
                  className="rounded-lg p-1.5 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                <span className="rounded-pill bg-amber-100 px-3 py-1 text-amber-800">CATEGORY: {selectedSidebar?.badges?.category || "GENERAL"}</span>
                <span className="rounded-pill bg-rose-100 px-3 py-1 text-rose-700">RISK: {selectedSidebar?.badges?.riskPercent ?? Math.round(selectedZone.currentScore)}%</span>
                <span className="rounded-pill bg-indigo-100 px-3 py-1 text-indigo-700">LAST UPDATE: {selectedSidebar?.badges?.lastUpdateLabel || "just now"}</span>
              </div>

              <div className="rounded-lg p-3 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, hsl(0 84% 60%), hsl(0 84% 45%))" }}>
                {selectedZone.riskLevel === "critical" ? "Very High" : selectedZone.riskLevel === "high" ? "High" : selectedZone.riskLevel === "medium" ? "Moderate" : "Low"} · Risk Score {Math.round(selectedZone.currentScore)}/100
              </div>

              <div className="mt-4 flex gap-1 border-b">
                {["profile", "signals", "volunteers", "history"].map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={cn("px-3 py-2 text-xs font-medium capitalize transition-colors border-b-2", activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{tab === "profile" ? "Need Profile" : tab}</button>
                ))}
              </div>

              <div className="mt-4">
                {activeTab === "profile" && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Intelligence Narrative</h4>
                      <p className="text-sm leading-relaxed text-foreground/80">
                        {selectedSidebar?.narrative?.summary || selectedZone.lastIntervention || "Live terrain narrative is being generated from incoming reports."}
                      </p>
                      {selectedSidebar?.narrative?.etaSignal ? (
                        <p className="mt-2 text-sm font-semibold text-destructive">{selectedSidebar.narrative.etaSignal}</p>
                      ) : null}
                      {(selectedSidebar?.narrative?.highlights || []).length > 0 ? (
                        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                          {(selectedSidebar?.narrative?.highlights || []).slice(0, 3).map((highlight, index) => (
                            <li key={`${highlight}-${index}`}>• {highlight}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Active Responders</h4>
                      <div className="flex -space-x-2">
                        {(selectedSidebar?.activeResponders || []).slice(0, 3).map((responder) => (
                          <div key={responder.id} className="h-10 w-10 rounded-full border-2 border-card overflow-hidden bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">
                            {responder.photoUrl ? <img src={responder.photoUrl} alt={responder.name} className="h-full w-full object-cover" /> : responder.initials}
                          </div>
                        ))}
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-card bg-primary text-[10px] font-bold text-white">+{selectedSidebar?.zone?.activeMissions ?? selectedZone.activeMissions}</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Recent Reports</h4>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {(selectedSidebar?.recentReports || selectedZoneQuery.data?.recentReports || []).slice(0, 3).map((report, index) => (
                          <p key={`${report.needType || "report"}-${index}`}>{report.needType || "Report"} · {report.severity || "unknown"} · {report.createdAt ? new Date(report.createdAt).toLocaleString() : "recent"}</p>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Incident Frequency</h4>
                      <div className="h-32 bg-secondary/30 rounded-xl p-4 flex items-end justify-between gap-1 overflow-hidden relative">
                        {historyBars.map((entry, index) => {
                          const raw = Number(entry.actual ?? entry.score ?? 0);
                          const height = Math.max(8, Math.min(100, (raw / chartMax) * 100));
                          return (
                            <div
                              key={`${entry.week}-${index}`}
                              className={cn(
                                "flex-1 rounded-sm transition-all duration-500",
                                index >= historyBars.length - 2 ? "bg-destructive" : index >= historyBars.length - 4 ? "bg-primary/60" : "bg-primary/30"
                              )}
                              style={{ height: `${height}%` }}
                            />
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-2 px-1">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{selectedSidebar?.incidentFrequency?.[0]?.label || "8h ago"}</span>
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">NOW</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "signals" && (
                  <div className="space-y-3">
                    {Object.entries(selectedZone.signalCounts || {}).map(([label, value]) => (
                      <SignalPill key={label} label={`${label.charAt(0).toUpperCase()}${label.slice(1)} ${value}`} variant={value > 30 ? "danger" : value > 10 ? "warning" : "info"} />
                    ))}
                  </div>
                )}

                {activeTab === "volunteers" && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><Users className="h-4 w-4" />{selectedSidebar?.zone?.activeMissions ?? selectedZone.activeMissions} active missions in this zone</div>
                    <p>{selectedZone.safetyProfile.level} safety posture · score {selectedZone.safetyProfile.score}/100</p>
                    <p>{selectedZone.safetyProfile.specificFlags.length ? selectedZone.safetyProfile.specificFlags.join(" · ") : "No safety flags reported"}</p>
                  </div>
                )}

                {activeTab === "history" && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {historyBars.map((entry) => (
                      <div key={entry.week} className="flex items-center justify-between gap-3">
                        <span>Slot {entry.week}</span>
                        <span>{Math.round(Number(entry.actual ?? entry.score ?? 0))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
