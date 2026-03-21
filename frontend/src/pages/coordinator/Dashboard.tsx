import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { StatMetricCard } from "@/components/coordinator/StatMetricCard";
import { NeedTerrainMap } from "@/components/coordinator/NeedTerrainMap";
import { GeminiInsightCard } from "@/components/coordinator/GeminiInsightCard";
import { VolunteerAvatarCard } from "@/components/coordinator/VolunteerAvatarCard";
import { CommunityPulseDonut } from "@/components/coordinator/CommunityPulseDonut";
import { MissionStatusChip } from "@/components/coordinator/MissionStatusChip";
import { ZoneRiskBadge } from "@/components/coordinator/ZoneRiskBadge";
import { Button } from "@/components/ui/button";
import { Camera, UserPlus, FileText, Map } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="flex flex-col h-full">
      <DashboardTopBar breadcrumb="Dashboard" subtext="Bengaluru · 12 NGOs connected · Synced 4 min ago" />

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-card-gap">
            <StatMetricCard label="Reports Ingested" value="1,247" delta="+84 this week" accent="indigo" />
            <StatMetricCard label="Active Needs" value="63" delta="Across 9 zones" deltaDirection="up" accent="amber" />
            <StatMetricCard label="Missions Completed" value="312" delta="89% success rate" accent="green" />
            <StatMetricCard label="Volunteers Active" value="47" delta="18 available now" accent="purple" />
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-card-gap">
            {/* Left 60% */}
            <div className="lg:col-span-3 space-y-card-gap">
              <div className="rounded-card border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Need Terrain Map</h3>
                    <span className="flex items-center gap-1 text-[11px] text-success font-medium"><span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />Live</span>
                  </div>
                </div>
                <NeedTerrainMap className="h-[260px]" />
              </div>

              <div className="rounded-card border bg-card p-5 shadow-card">
                <h3 className="text-sm font-semibold text-foreground mb-4">Top Urgent Needs</h3>
                {[
                  { zone: "Hebbal North", category: "Food Security", score: 89, level: "critical" as const },
                  { zone: "Yelahanka", category: "Health", score: 72, level: "high" as const },
                  { zone: "Jalahalli", category: "Education", score: 58, level: "medium" as const },
                  { zone: "Malleswaram", category: "Shelter", score: 34, level: "low" as const },
                ].map((n, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 border-b last:border-0">
                    <span className="text-xs font-data text-muted-foreground w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{n.zone}</p>
                      <span className="text-xs text-muted-foreground">{n.category}</span>
                    </div>
                    <div className="w-24">
                      <div className="h-1.5 rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", n.level === "critical" ? "bg-destructive" : n.level === "high" ? "bg-warning" : n.level === "medium" ? "bg-primary" : "bg-success")} style={{ width: `${n.score}%` }} />
                      </div>
                    </div>
                    <ZoneRiskBadge level={n.level} score={n.score} />
                  </div>
                ))}
              </div>
            </div>

            {/* Right 40% */}
            <div className="lg:col-span-2 space-y-card-gap">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Gemini Insights</h3>
                <GeminiInsightCard variant="critical" zone="Zone 4 — Hebbal North" signals={[{ label: "Absenteeism +34%", variant: "danger" }, { label: "Whisper volume +58%", variant: "warning" }]} description="3 converging signals detected. Pattern matches 2022 Koramangala signature." sourceCount="23 reports" timestamp="3h ago" />
                <GeminiInsightCard variant="watch" zone="Zone 7 — Yelahanka" signals={[{ label: "Clinic walk-ins ↑", variant: "info" }]} description="Early indicators suggest rising health needs in the eastern corridor." sourceCount="12 reports" timestamp="6h ago" />
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Best Matched Volunteers</h3>
                <VolunteerAvatarCard compact name="Priya R." initials="PR" matchPercent={97} distance="2.1 km" color="bg-primary" />
                <VolunteerAvatarCard compact name="Arjun M." initials="AM" matchPercent={91} distance="3.4 km" color="bg-success" />
              </div>
            </div>
          </div>
        </div>

        {/* Right stats panel */}
        <div className="hidden xl:block w-panel-w border-l bg-card overflow-y-auto p-5 space-y-6 shrink-0">
          <CommunityPulseDonut score={68} trend="up" />

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
              {[
                { zone: "Zone 4 · 3 workers", status: "in_progress" as const },
                { zone: "Zone 7 · 2 workers", status: "dispatched" as const },
                { zone: "Zone 2 · 1 worker", status: "completed" as const },
              ].map((m, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{m.zone}</span>
                  <MissionStatusChip status={m.status} />
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

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
