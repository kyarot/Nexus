import { MapPin, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useState } from "react";
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
  aiBreakdown?: {
    dimensions: {
      skillMatch: number;
      proximity: number;
      languageMatch: number;
      pastSuccess: number;
      emotionalCapacity: number;
      zoneFamiliarity: number;
      availability: number;
      burnoutRisk: number;
    };
    reasoning: string;
  };
}

const burnoutConfig = {
  low: { dot: "bg-success", label: "Low risk" },
  medium: { dot: "bg-warning", label: "Medium risk" },
  high: { dot: "bg-destructive", label: "High risk" },
};

export function VolunteerAvatarCard({ 
  name, initials, color = "bg-primary", org, matchPercent, distance, skills, burnout = "low", 
  missions, successRate, compact, className, onDispatch, onViewProfile, aiBreakdown 
}: VolunteerAvatarCardProps) {
  const [isScoringExpanded, setIsScoringExpanded] = useState(false);
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
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${matchPercent}%` }} />
        </div>
      </div>

      <div className="mt-4">
        <button 
          onClick={() => setIsScoringExpanded(!isScoringExpanded)}
          className="text-xs font-bold text-primary flex items-center gap-1 hover:opacity-80 transition-opacity"
        >
          Why {matchPercent}%? {isScoringExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {isScoringExpanded && aiBreakdown && (
          <div className="mt-3 bg-[#EEF2FF] border border-indigo-100 rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 text-[#3730A3]">
              <Sparkles className="h-3.5 w-3.5 fill-[#3730A3]/20" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Gemini scoring breakdown</span>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                { label: "Skill match", val: aiBreakdown.dimensions.skillMatch },
                { label: "Proximity", val: aiBreakdown.dimensions.proximity },
                { label: "Language", val: aiBreakdown.dimensions.languageMatch },
                { label: "Past success", val: aiBreakdown.dimensions.pastSuccess },
                { label: "Emotional", val: aiBreakdown.dimensions.emotionalCapacity },
                { label: "Zone fam.", val: aiBreakdown.dimensions.zoneFamiliarity },
                { label: "Availability", val: aiBreakdown.dimensions.availability },
                { label: "Burnout risk", val: aiBreakdown.dimensions.burnoutRisk },
              ].map((d, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-[10px] font-medium text-slate-500">
                    <span>{d.label}</span>
                    <span className="font-bold text-primary">{d.val}%</span>
                  </div>
                  <div className="h-1 w-full bg-indigo-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${d.val}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-indigo-100/50">
              <p className="text-[11px] leading-relaxed text-slate-500 italic">
                "{aiBreakdown.reasoning}"
              </p>
            </div>

            <button 
              onClick={() => setIsScoringExpanded(false)}
              className="text-[10px] font-bold text-slate-400 hover:text-primary transition-colors block w-full text-center pt-1"
            >
              Close
            </button>
          </div>
        )}
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
