import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";

interface CommunityPulseDonutProps {
  score: number;
  label?: string;
  trend?: "up" | "down";
  className?: string;
}

export function CommunityPulseDonut({ score, label = "Community Pulse", trend, className }: CommunityPulseDonutProps) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? "hsl(var(--success))" : score >= 40 ? "hsl(var(--warning))" : "hsl(var(--destructive))";

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative h-32 w-32">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
          <circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-data text-foreground">{score}</span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {trend && (trend === "up" ? <ArrowUp className="h-3.5 w-3.5 text-success" /> : <ArrowDown className="h-3.5 w-3.5 text-destructive" />)}
      </div>
    </div>
  );
}
