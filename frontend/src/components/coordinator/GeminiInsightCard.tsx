import { Sparkles, Share2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignalPill } from "../coordinator/SignalPill";
import { cn } from "@/lib/utils";
import { useState } from "react";

type InsightVariant = "critical" | "high" | "watch" | "resolved";

const variantStyles: Record<InsightVariant, { border: string; badge: string; badgeText: string }> = {
  critical: { border: "border-l-destructive", badge: "bg-destructive/15 text-destructive", badgeText: "Critical" },
  high: { border: "border-l-warning", badge: "bg-warning/15 text-warning", badgeText: "High" },
  watch: { border: "border-l-primary", badge: "bg-primary/15 text-primary", badgeText: "Watch" },
  resolved: { border: "border-l-success", badge: "bg-success/15 text-success", badgeText: "Resolved" },
};

interface Signal {
  label: string;
  variant: "danger" | "warning" | "info" | "success";
}

interface GeminiInsightCardProps {
  variant?: InsightVariant;
  zone: string;
  signals?: Signal[];
  description: string;
  sourceCount?: string;
  timestamp?: string;
  className?: string;
}

export function GeminiInsightCard({ variant = "watch", zone, signals, description, sourceCount, timestamp, className }: GeminiInsightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const v = variantStyles[variant];

  return (
    <div className={cn("rounded-card border border-l-4 bg-card p-5 shadow-card", v.border, className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{zone}</span>
          <span className={cn("rounded-pill px-2 py-0.5 text-[11px] font-semibold", v.badge)}>{v.badgeText}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {sourceCount && <span>{sourceCount}</span>}
          {timestamp && <span>· {timestamp}</span>}
        </div>
      </div>
      {signals && signals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {signals.map((s, i) => <SignalPill key={i} label={s.label} variant={s.variant} />)}
        </div>
      )}
      <p className="mt-3 text-sm leading-relaxed text-foreground">{description}</p>
      <button onClick={() => setExpanded(!expanded)} className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        View source reports
      </button>
      {expanded && <div className="mt-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">Source report data would appear here.</div>}
      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" variant="gradient">Generate Plan →</Button>
        <Button size="sm" variant="ghost">Dispatch Volunteers →</Button>
        <Button size="icon" variant="ghost" className="ml-auto h-8 w-8"><Share2 className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
