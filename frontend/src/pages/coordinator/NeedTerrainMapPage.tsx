import { useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { NeedTerrainMap } from "@/components/coordinator/NeedTerrainMap";
import { ZoneRiskBadge } from "@/components/coordinator/ZoneRiskBadge";
import { SignalPill } from "@/components/coordinator/SignalPill";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { X, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const filters = ["All Needs", "Food", "Health", "Education", "Shelter", "Mental Health"];

export default function NeedTerrainMapPage() {
  const [activeFilter, setActiveFilter] = useState("All Needs");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [opacity, setOpacity] = useState([70]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <DashboardTopBar breadcrumb="Need Terrain Map" />

      <div className="relative flex-1 overflow-hidden">
        {/* Floating controls */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-card bg-card/95 backdrop-blur-sm p-2 px-4 shadow-card border">
            <span className="text-sm font-semibold text-foreground">Need Terrain Map</span>
            <span className="flex items-center gap-1 text-[11px] text-success font-medium"><span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />Live</span>
            <div className="ml-3 flex gap-1">
              {filters.map(f => (
                <button key={f} onClick={() => setActiveFilter(f)} className={cn("rounded-pill px-3 py-1 text-xs font-medium transition-all", activeFilter === f ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}>{f}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost">Export Map</Button>
            <Button size="sm" variant="gradient">Add Report</Button>
          </div>
        </div>

        {/* Map */}
        <NeedTerrainMap
          className="h-full"
          showLegend={false}
          onZoneClick={(z: any) => setSelectedZone(z.name)}
        />

        {/* Floating stats */}
        <div className="absolute top-20 right-4 z-10 rounded-card bg-card/95 backdrop-blur-sm p-4 shadow-card border text-xs space-y-2">
          {[{ l: "Total Zones", v: "24" }, { l: "Critical", v: "4" }, { l: "High", v: "8" }, { l: "Improving", v: "3" }].map(s => (
            <div key={s.l} className="flex justify-between gap-6"><span className="text-muted-foreground">{s.l}</span><span className="font-semibold font-data text-foreground">{s.v}</span></div>
          ))}
        </div>

        {/* Floating legend */}
        <div className="absolute bottom-4 left-4 z-10 rounded-card bg-card/95 backdrop-blur-sm p-4 shadow-card border space-y-3">
          <div className="flex gap-4 text-xs font-medium">
            {[{ c: "bg-destructive", l: "Critical" }, { c: "bg-warning", l: "High" }, { c: "bg-primary", l: "Medium" }, { c: "bg-success", l: "Low" }, { c: "bg-muted-foreground", l: "Insufficient" }].map(i => (
              <span key={i.l} className="flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-full", i.c)} />{i.l}</span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground">Opacity</span>
            <Slider value={opacity} onValueChange={setOpacity} max={100} className="w-32" />
          </div>
        </div>

        {/* Slide-over panel */}
        {selectedZone && (
          <div className="absolute right-0 top-0 bottom-0 z-20 w-[400px] border-l bg-card shadow-elevated flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-6 scrollbar-none">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{selectedZone} — Zone 4</h2>
                  <div className="mt-1 flex gap-2">
                    <ZoneRiskBadge level="critical" score={89} />
                    <span className="text-xs text-muted-foreground">Updated 12 min ago</span>
                  </div>
                </div>
                <button onClick={() => setSelectedZone(null)} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>

              {/* Risk bar */}
              <div className="rounded-lg p-3 text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, hsl(0 84% 60%), hsl(0 84% 45%)" }}>
                Very High · Risk Score 89/100
              </div>

              {/* Tabs */}
              <div className="mt-4 flex gap-1 border-b">
                {["profile", "signals", "volunteers", "history"].map(t => (
                  <button key={t} onClick={() => setActiveTab(t)} className={cn("px-3 py-2 text-xs font-medium capitalize transition-colors border-b-2", activeTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{t === "profile" ? "Need Profile" : t}</button>
                ))}
              </div>

              <div className="mt-4">
                {activeTab === "profile" && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Intelligence Narrative</h4>
                      <p className="text-sm leading-relaxed text-foreground/80">
                        Intelligence reports indicate converging signals of supply chain disruption. Local market prices for staples have risen <span className="font-bold text-destructive">14% in 48h</span>. Volunteer feedback from Zone 4 suggests a density of 42 households with immediate priority-1 needs.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Active Responders</h4>
                      <div className="flex -space-x-2">
                        {[
                          "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=64&h=64&fit=crop",
                          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop",
                          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=64&h=64&fit=crop"
                        ].map((src, idx) => (
                          <div key={idx} className="h-10 w-10 rounded-full border-2 border-card overflow-hidden">
                            <img src={src} alt="Volunteer" className="h-full w-full object-cover" />
                          </div>
                        ))}
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-card bg-primary text-[10px] font-bold text-white">+12</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Incident Frequency</h4>
                      <div className="h-32 bg-secondary/30 rounded-xl p-4 flex items-end justify-between gap-1 overflow-hidden relative">
                        {[40, 55, 30, 70, 85, 65, 95, 98].map((h, i) => (
                          <div
                            key={i}
                            className={cn(
                              "flex-1 rounded-sm transition-all duration-500",
                              i >= 6 ? "bg-destructive" : (i >= 4 ? "bg-primary/60" : "bg-primary/30")
                            )}
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between mt-2 px-1">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">08:00 AM</span>
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">NOW</span>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === "signals" && (
                  <div className="space-y-3">
                    <SignalPill label="Absenteeism +34%" variant="danger" />
                    <SignalPill label="Whisper volume +58%" variant="warning" />
                    <SignalPill label="Clinic walk-ins ↑" variant="info" />
                  </div>
                )}
                {activeTab === "volunteers" && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><Users className="h-4 w-4" />3 volunteers assigned</div>
                    <p>Priya R. · 97% match · 2.1 km</p>
                    <p>Arjun M. · 91% match · 3.4 km</p>
                  </div>
                )}
                {activeTab === "history" && (
                  <p className="text-sm text-muted-foreground">Mission history timeline would appear here.</p>
                )}
              </div>
            </div>

            {/* Action panel footer */}
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
