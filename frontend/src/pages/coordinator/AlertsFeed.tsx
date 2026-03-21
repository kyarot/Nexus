import { useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { SignalPill } from "@/components/coordinator/SignalPill";
import { ZoneRiskBadge } from "@/components/coordinator/ZoneRiskBadge";
import { EmptyState } from "@/components/coordinator/EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const alerts = [
  {
    id: 1, zone: "Zone 4 — Hebbal North", level: "critical" as const, badge: "Critical",
    signals: [{ label: "Absenteeism +34%", variant: "danger" as const }, { label: "Whisper volume +58%", variant: "warning" as const }, { label: "Clinic walk-ins ↑", variant: "info" as const }],
    description: "Pattern matches 2022 Koramangala signature. Est. 4–5 weeks to threshold.",
    time: "3h ago",
  },
  {
    id: 2, zone: "Zone 7 — Yelahanka East", level: "high" as const, badge: "Watch",
    signals: [{ label: "Ration delays +2 weeks", variant: "warning" as const }, { label: "Migration ↑", variant: "info" as const }],
    description: "Rising food insecurity indicators detected in eastern corridor. Monitor closely.",
    time: "8h ago",
  },
  {
    id: 3, zone: "Zone 2 — Jalahalli", level: "low" as const, badge: "Resolved",
    signals: [],
    description: "Intervention successful — need score dropped 40% over 3 weeks.",
    time: "2d ago", resolved: true,
  },
];

export default function AlertsFeed() {
  const [filter, setFilter] = useState("All");
  const [expandedResolved, setExpandedResolved] = useState<number[]>([]);
  const [severityRange, setSeverityRange] = useState([0]);

  const filtered = alerts.filter(a => {
    if (filter === "Critical") return a.level === "critical";
    if (filter === "High") return a.level === "high";
    if (filter === "Watch") return a.level === "high";
    return true;
  });

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
            {["Hebbal North", "Yelahanka", "Jalahalli", "Malleswaram"].map(z => (
              <label key={z} className="flex items-center gap-2 text-xs text-foreground"><Checkbox />{z}</label>
            ))}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase">Category</p>
            {["Food", "Health", "Education", "Shelter"].map(c => (
              <label key={c} className="flex items-center gap-2 text-xs text-foreground"><Checkbox />{c}</label>
            ))}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Severity</p>
            <Slider value={severityRange} onValueChange={setSeverityRange} max={100} />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-foreground">Drift Alerts</h1>
              <p className="text-sm text-muted-foreground">7 active this week</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {["All", "Critical", "High", "Watch"].map(f => (
                  <button key={f} onClick={() => setFilter(f)} className={cn("rounded-pill px-3 py-1 text-xs font-medium transition-all", filter === f ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}>{f}</button>
                ))}
              </div>
              <button className="text-xs text-primary font-medium hover:underline">Mark all read</button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={AlertTriangle} heading="No alerts match your filters" subtext="Try adjusting your filter criteria" actionLabel="Clear filters" onAction={() => setFilter("All")} />
          ) : (
            <div className="space-y-4">
              {filtered.map(a => (
                <div key={a.id} className={cn("rounded-card border border-l-4 bg-card p-5 shadow-card transition-opacity", borderColor[a.level], a.resolved && "opacity-70")}>
                  {a.resolved && !expandedResolved.includes(a.id) ? (
                    <button onClick={() => setExpandedResolved(p => [...p, a.id])} className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-foreground">{a.zone}</span>
                        <ZoneRiskBadge level={a.level} />
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-foreground">{a.zone}</span>
                          <ZoneRiskBadge level={a.level} />
                        </div>
                        <span className="text-xs text-muted-foreground">{a.time}</span>
                      </div>
                      {a.signals.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {a.signals.map((s, i) => <SignalPill key={i} label={s.label} variant={s.variant} />)}
                        </div>
                      )}
                      <p className="mt-3 text-sm text-foreground leading-relaxed">{a.description}</p>
                      {!a.resolved && (
                        <div className="mt-4 flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">Detected {a.time}</span>
                          <div className="ml-auto flex gap-2">
                            <Button size="sm" variant="gradient">Generate Brief →</Button>
                            <Button size="sm" variant="ghost">Dispatch Volunteer →</Button>
                          </div>
                        </div>
                      )}
                      {a.resolved && (
                        <button onClick={() => setExpandedResolved(p => p.filter(x => x !== a.id))} className="mt-2 text-xs text-primary hover:underline flex items-center gap-1">
                          <ChevronUp className="h-3 w-3" />Collapse
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
