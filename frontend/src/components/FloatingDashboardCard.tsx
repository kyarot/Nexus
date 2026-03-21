import { Badge } from "@/components/ui/badge";

const stats = [
  { label: "Active Volunteers", value: "2,847", change: "+12%" },
  { label: "Community Score", value: "94.2", change: "+3.1" },
  { label: "Tasks Completed", value: "18,392", change: "+847" },
];

const risks = [
  { label: "Volunteer Burnout", level: "Low", color: "success" as const },
  { label: "Coverage Gap — Zone 4", level: "Medium", color: "secondary" as const },
  { label: "Onboarding Backlog", level: "High", color: "destructive" as const },
];

export function FloatingDashboardCard() {
  return (
    <div className="relative w-full max-w-lg animate-float">
      <div className="rounded-card bg-card shadow-elevated border border-border overflow-hidden">
        {/* Gradient header */}
        <div className="gradient-accent px-6 py-4">
          <p className="text-sm font-medium text-primary-foreground/80">Community Intelligence</p>
          <p className="text-2xl font-bold text-primary-foreground font-data">NEXUS Score: 94.2</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-px bg-border">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-card px-4 py-3 text-center">
              <p className="text-lg font-bold font-data text-foreground">{stat.value}</p>
              <p className="text-xs text-text-secondary">{stat.label}</p>
              <span className="text-xs font-data text-success">{stat.change}</span>
            </div>
          ))}
        </div>

        {/* Risk indicators */}
        <div className="p-4 space-y-2">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Risk Signals</p>
          {risks.map((risk) => (
            <div key={risk.label} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{risk.label}</span>
              <Badge variant={risk.color} className="text-xs">
                {risk.level}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
