import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Users, Zap } from "lucide-react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { NeedTerrainMap } from "@/components/coordinator/NeedTerrainMap";
import { ZoneRiskBadge } from "@/components/coordinator/ZoneRiskBadge";
import { SignalPill } from "@/components/coordinator/SignalPill";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getCoordinatorHeatmap,
  getCoordinatorZoneDetail,
  getCoordinatorZoneHistory,
  getCoordinatorZones,
} from "@/lib/coordinator-api";

const filters = ["All Needs", "Food", "Health", "Education", "Shelter", "Mental Health"];

export default function NeedTerrainMapPage() {
  const [activeFilter, setActiveFilter] = useState("All Needs");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [opacity, setOpacity] = useState([70]);

  const token = localStorage.getItem("nexus_access_token");

  const zonesQuery = useQuery({
    queryKey: ["coordinator-zones", token],
    queryFn: () => getCoordinatorZones(),
    enabled: Boolean(token),
    refetchInterval: 30_000,
  });

  const heatmapQuery = useQuery({
    queryKey: ["coordinator-heatmap", token],
    queryFn: () => getCoordinatorHeatmap(),
    enabled: Boolean(token),
    refetchInterval: 30_000,
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

  const zoneList = zonesQuery.data?.zones ?? [];
  const filteredZones = useMemo(() => {
    if (activeFilter === "All Needs") {
      return zoneList;
    }

    const needle = activeFilter.toLowerCase();
    return zoneList.filter((zone) => Object.entries(zone.signalCounts || {}).some(([key, value]) => key.toLowerCase().includes(needle) && value > 0));
  }, [activeFilter, zoneList]);

  const filteredHeatmapPoints = useMemo(() => {
    if (!heatmapQuery.data) {
      return [];
    }

    if (activeFilter === "All Needs") {
      return heatmapQuery.data;
    }

    const zoneIds = new Set(filteredZones.map((zone) => zone.id));
    return heatmapQuery.data.filter((point) => zoneIds.has(point.zoneId));
  }, [activeFilter, filteredZones, heatmapQuery.data]);

  const selectedZone = selectedZoneQuery.data?.zone;
  const selectedHistory = selectedHistoryQuery.data?.history ?? selectedZone?.scoreHistory ?? [];

  useEffect(() => {
    if (!selectedZoneId && filteredZones.length > 0) {
      setSelectedZoneId(filteredZones[0].id);
      return;
    }

    if (selectedZoneId && filteredZones.length > 0 && !filteredZones.some((zone) => zone.id === selectedZoneId)) {
      setSelectedZoneId(filteredZones[0].id);
    }
  }, [filteredZones, selectedZoneId]);

  const totalZones = filteredZones.length;
  const criticalZones = filteredZones.filter((zone) => zone.riskLevel === "critical").length;
  const highZones = filteredZones.filter((zone) => zone.riskLevel === "high").length;
  const improvingZones = filteredZones.filter((zone) => zone.currentScore < 50).length;

  const historyBars = selectedHistory.length
    ? selectedHistory
    : Array.from({ length: 8 }, (_, index) => ({ week: index + 1, score: 0, actual: 0 }));

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
            <Button size="sm" variant="ghost">Export Map</Button>
            <Button size="sm" variant="gradient">Add Report</Button>
          </div>
        </div>

        <NeedTerrainMap
          className="h-full"
          showLegend={false}
          heatmapPoints={filteredHeatmapPoints}
          onZoneClick={(zone) => setSelectedZoneId(zone.zoneId || zone.name)}
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

        {selectedZone && (
          <div className="absolute right-0 top-0 bottom-0 z-20 w-[400px] border-l bg-card shadow-elevated flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-6 scrollbar-none">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{selectedZone.name} — {selectedZone.ward || selectedZone.city || "Zone"}</h2>
                  <div className="mt-1 flex gap-2">
                    <ZoneRiskBadge level={selectedZone.riskLevel} score={Math.round(selectedZone.currentScore)} />
                    <span className="text-xs text-muted-foreground">Updated {selectedZone.updatedAt ? new Date(selectedZone.updatedAt).toLocaleString() : "recently"}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedZoneId(null)} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
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
                        {selectedZone.lastIntervention || "Backend-linked zone data is now flowing into the map and coordinator view."}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Active Responders</h4>
                      <div className="flex -space-x-2">
                        {[
                          "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=64&h=64&fit=crop",
                          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop",
                          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=64&h=64&fit=crop",
                        ].map((src, index) => (
                          <div key={index} className="h-10 w-10 rounded-full border-2 border-card overflow-hidden">
                            <img src={src} alt="Volunteer" className="h-full w-full object-cover" />
                          </div>
                        ))}
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-card bg-primary text-[10px] font-bold text-white">+{selectedZone.activeMissions}</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Recent Reports</h4>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {(selectedZoneQuery.data?.recentReports || []).slice(0, 3).map((report) => (
                          <p key={report.id}>{report.needType || "Report"} · {report.severity || "unknown"} · {report.createdAt ? new Date(report.createdAt).toLocaleString() : "recent"}</p>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Incident Frequency</h4>
                      <div className="h-32 bg-secondary/30 rounded-xl p-4 flex items-end justify-between gap-1 overflow-hidden relative">
                        {historyBars.map((entry, index) => {
                          const height = Math.max(8, Math.min(100, entry.actual ?? entry.score ?? 0));
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
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">8 weeks ago</span>
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
                    <div className="flex items-center gap-2"><Users className="h-4 w-4" />{selectedZone.activeMissions} active missions in this zone</div>
                    <p>{selectedZone.safetyProfile.level} safety posture · score {selectedZone.safetyProfile.score}/100</p>
                    <p>{selectedZone.safetyProfile.specificFlags.length ? selectedZone.safetyProfile.specificFlags.join(" · ") : "No safety flags reported"}</p>
                  </div>
                )}

                {activeTab === "history" && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {historyBars.map((entry) => (
                      <div key={entry.week} className="flex items-center justify-between gap-3">
                        <span>Week {entry.week}</span>
                        <span>{Math.round(entry.actual ?? entry.score ?? 0)} / 100</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 pt-0 mt-auto border-t bg-card/50 backdrop-blur-sm">
              <Button size="lg" className="w-full mt-6 py-7 text-base font-bold rounded-xl shadow-elevated transition-transform active:scale-95" style={{ backgroundColor: "#1A1A3D" }}>
                <Zap className="w-4 h-4 mr-2 fill-white text-white" />
                Initiate Intervention
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
