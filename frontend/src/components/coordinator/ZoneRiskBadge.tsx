import { cn } from "@/lib/utils";

type RiskLevel = "critical" | "high" | "medium" | "low" | "insufficient";

const riskStyles: Record<RiskLevel, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-warning/15 text-warning border-warning/30",
  medium: "bg-primary/15 text-primary border-primary/30",
  low: "bg-success/15 text-success border-success/30",
  insufficient: "bg-muted text-muted-foreground border-border",
};

interface ZoneRiskBadgeProps {
  level: RiskLevel;
  score?: number;
  zone?: string;
  className?: string;
}

export function ZoneRiskBadge({ level, score, zone, className }: ZoneRiskBadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-semibold", riskStyles[level], className)}>
      <span className={cn("h-2 w-2 rounded-full", {
        "bg-destructive": level === "critical",
        "bg-warning": level === "high",
        "bg-primary": level === "medium",
        "bg-success": level === "low",
        "bg-muted-foreground": level === "insufficient",
      })} />
      {zone && <span>{zone}</span>}
      {score !== undefined && <span className="font-data">{score}</span>}
      <span className="capitalize">{level}</span>
    </span>
  );
}
