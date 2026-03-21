import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MapPin, Sparkles, Star, User } from "lucide-react";

export function HeroFloatingCards() {
  return (
    <div className="relative w-full h-[520px]">
      {/* G2 badge */}
      <div className="absolute -top-2 right-0 z-30 bg-surface rounded-pill shadow-card border border-border px-3 py-1.5 flex items-center gap-1.5 animate-fade-in" style={{ animationDelay: "0.6s", animationFillMode: "both" }}>
        <Star className="w-3.5 h-3.5 text-warning fill-warning" />
        <span className="text-xs font-bold text-foreground">G2</span>
        <span className="text-xs font-semibold text-text-secondary">5.0/5.0</span>
      </div>

      {/* Card 1 — Need Terrain Map */}
      <div
        className="absolute top-6 right-4 w-[340px] rounded-card bg-card shadow-elevated border border-border overflow-hidden animate-fade-in"
        style={{ animationDelay: "0.2s", animationFillMode: "both" }}
      >
        <div className="px-4 py-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Need Terrain — Live</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-success font-medium">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Live
          </span>
        </div>
        {/* Map placeholder */}
        <div className="relative h-[180px] bg-[#1a1a2e] overflow-hidden">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-4 left-8 w-20 h-20 rounded-full bg-destructive/40 blur-xl" />
            <div className="absolute top-12 right-12 w-16 h-16 rounded-full bg-warning/40 blur-xl" />
            <div className="absolute bottom-6 left-1/2 w-12 h-12 rounded-full bg-primary/40 blur-xl" />
          </div>
          {/* Zone labels */}
          <div className="absolute top-6 left-10 text-[10px] font-mono text-destructive/90 font-bold">Hebbal</div>
          <div className="absolute top-16 right-14 text-[10px] font-mono text-warning/90 font-bold">Yelahanka</div>
          <div className="absolute bottom-8 left-1/2 text-[10px] font-mono text-primary/80 font-bold">Jalahalli</div>
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-10">
            <line x1="0" y1="60" x2="100%" y2="60" stroke="white" strokeWidth="0.5" />
            <line x1="0" y1="120" x2="100%" y2="120" stroke="white" strokeWidth="0.5" />
            <line x1="113" y1="0" x2="113" y2="100%" stroke="white" strokeWidth="0.5" />
            <line x1="226" y1="0" x2="226" y2="100%" stroke="white" strokeWidth="0.5" />
          </svg>
        </div>
        <div className="px-4 py-2 flex items-center gap-3 text-[10px] text-text-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> Critical</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> High</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Medium</span>
        </div>
      </div>

      {/* Card 2 — Gemini Insight */}
      <div
        className="absolute top-[220px] left-0 w-[280px] rounded-card bg-card shadow-elevated border border-border overflow-hidden z-10 animate-fade-in"
        style={{ animationDelay: "0.4s", animationFillMode: "both" }}
      >
        <div className="border-l-[3px] border-l-destructive p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-text-secondary">Gemini Insight</span>
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Critical</Badge>
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug mb-2">
            Hebbal North — 3 converging signals
          </p>
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-pill bg-destructive/10 text-destructive font-medium">Absenteeism +34%</span>
            <span className="text-[10px] px-2 py-0.5 rounded-pill bg-warning/10 text-warning font-medium">Whisper ↑58%</span>
          </div>
        </div>
      </div>

      {/* Card 3 — Volunteer Match */}
      <div
        className="absolute bottom-4 right-8 w-[260px] rounded-card bg-card shadow-elevated border border-border p-4 z-10 animate-fade-in"
        style={{ animationDelay: "0.5s", animationFillMode: "both" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Priya R.</p>
            <p className="text-xs text-text-secondary">2.1 km · Kannada, Hindi</p>
          </div>
          <span className="ml-auto text-sm font-bold font-mono text-success">97%</span>
        </div>
        <div className="flex gap-1.5 mb-3">
          <span className="text-[10px] px-2 py-0.5 rounded-pill bg-primary-light text-primary font-medium">Food dist.</span>
          <span className="text-[10px] px-2 py-0.5 rounded-pill bg-success/10 text-success font-medium">Mental health</span>
        </div>
        <button className="w-full text-center text-xs font-semibold text-primary-foreground gradient-primary rounded-button py-2 hover:opacity-90 transition-opacity flex items-center justify-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Dispatch Now
        </button>
      </div>
    </div>
  );
}
