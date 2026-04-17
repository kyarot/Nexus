import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";
import CountUp from "@/components/ui/CountUp";

type AccentColor = "indigo" | "amber" | "green" | "purple" | "red";

const accentStyles: Record<AccentColor, string> = {
  indigo: "border-l-primary",
  amber: "border-l-warning",
  green: "border-l-success",
  purple: "border-l-primary-glow",
  red: "border-l-destructive",
};

interface StatMetricCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaDirection?: "up" | "down";
  accent?: AccentColor;
  countUp?: boolean;
  countUpFrom?: number;
  countUpDuration?: number;
  countUpDelay?: number;
  countUpSeparator?: string;
  countUpDirection?: "up" | "down";
  countUpStartWhen?: boolean;
  className?: string;
}

export function StatMetricCard({
  label,
  value,
  delta,
  deltaDirection = "up",
  accent = "indigo",
  countUp = false,
  countUpFrom = 0,
  countUpDuration = 1,
  countUpDelay = 0,
  countUpSeparator = "",
  countUpDirection = "up",
  countUpStartWhen = true,
  className
}: StatMetricCardProps) {
  const shouldAnimate = countUp && typeof value === "number" && Number.isFinite(value);

  return (
    <div className={cn("rounded-card border border-l-4 bg-card p-5 shadow-card", accentStyles[accent], className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-[28px] font-bold leading-tight text-foreground font-data">
        {shouldAnimate ? (
          <CountUp
            to={value}
            from={countUpFrom}
            direction={countUpDirection}
            duration={countUpDuration}
            delay={countUpDelay}
            separator={countUpSeparator}
            startWhen={countUpStartWhen}
          />
        ) : (
          value
        )}
      </p>
      {delta && (
        <div className={cn("mt-2 flex items-center gap-1 text-xs font-medium", deltaDirection === "up" ? "text-success" : "text-destructive")}>
          {deltaDirection === "up" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {delta}
        </div>
      )}
    </div>
  );
}
