import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VolunteerAvatarCardProps {
  name: string;
  initials: string;
  color?: string;
  org?: string;
  matchPercent: number;
  distance: string;
  skills?: string[];
  burnout?: "low" | "medium" | "high";
  missions?: number;
  successRate?: number;
  compact?: boolean;
  className?: string;
  onDispatch?: () => void;
  onViewProfile?: () => void;
}

const burnoutConfig = {
  low: { dot: "bg-success", label: "Low risk" },
  medium: { dot: "bg-warning", label: "Medium risk" },
  high: { dot: "bg-destructive", label: "High risk" },
};

export function VolunteerAvatarCard({ name, initials, color = "bg-primary", org, matchPercent, distance, skills, burnout = "low", missions, successRate, compact, className, onDispatch, onViewProfile }: VolunteerAvatarCardProps) {
  if (compact) {
    return (
      <div className={cn("flex flex-wrap items-center gap-3 rounded-card border bg-card p-3 shadow-card", className)}>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shrink-0", color)}>{initials}</div>
        <div className="flex-1 min-w-[120px]">
          <p className="text-sm font-semibold text-foreground truncate">{name}</p>
          <p className="text-xs text-success font-data">{matchPercent}% match</p>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap"><MapPin className="h-3 w-3" />{distance}</span>
        <Button size="sm" variant="gradient" className="sm:ml-auto" onClick={onDispatch}>Dispatch</Button>
      </div>
    );
  }

  return (
    <div className={cn("rounded-card border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover flex flex-col h-full", className)}>
      <div className="flex items-start gap-4">
        <div className={cn("flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white shrink-0", color)}>{initials}</div>
        <div className="min-w-0 flex-1 py-1">
          <p className="text-base font-bold text-foreground leading-tight">{name}</p>
          {org && <p className="text-sm text-muted-foreground mt-0.5">{org}</p>}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        <span className="font-medium">{distance} away</span>
      </div>

      {skills && skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5 min-h-[32px]">
          {skills.map(s => (
            <span 
              key={s} 
              className="rounded-full bg-primary/5 px-3 py-1 text-[11px] font-semibold text-primary/80 whitespace-nowrap border border-primary/10 transition-colors hover:bg-primary/10"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-medium">Match</span>
          <span className="font-bold text-success font-data">{matchPercent}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${matchPercent}%` }} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn("h-2.5 w-2.5 rounded-full ring-2 ring-offset-1 ring-background", burnoutConfig[burnout].dot)} />
        <span className="font-medium">{burnoutConfig[burnout].label}</span>
      </div>

      {missions !== undefined && (
        <p className="mt-3 text-xs text-muted-foreground font-medium">
          {missions} missions · {successRate}% success
        </p>
      )}

      <div className="mt-auto pt-6 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" className="flex-1 min-w-[100px] font-bold" onClick={onViewProfile}>View Profile</Button>
        <Button size="sm" variant="gradient" className="flex-1 min-w-[100px] font-bold" onClick={onDispatch}>Dispatch →</Button>
      </div>
    </div>
  );
}
