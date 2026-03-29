import { useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { StatMetricCard } from "@/components/coordinator/StatMetricCard";
import { VolunteerAvatarCard } from "@/components/coordinator/VolunteerAvatarCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { X, Grid3X3, List, AlertTriangle, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

const volunteers = [
  { 
    name: "Priya Ramanathan", initials: "PR", org: "Hope Foundation", matchPercent: 97, distance: "2.1 km", skills: ["Food dist.", "Kannada", "Mental health"], burnout: "low" as const, missions: 12, successRate: 89, color: "bg-primary",
    aiBreakdown: {
      dimensions: { skillMatch: 95, proximity: 98, languageMatch: 100, pastSuccess: 89, emotionalCapacity: 82, zoneFamiliarity: 91, availability: 88, burnoutRisk: 96 },
      reasoning: "Priya has completed 8 food missions in this exact zone with 89% success rate and speaks Kannada."
    },
    decisionLog: [
      { date: "Mar 14", missionType: "Food Distribution", score: 94, outcome: "Mission successful", status: "success" },
      { date: "Mar 8", missionType: "Education Outreach", score: 87, outcome: "Completed", status: "success" },
      { date: "Feb 22", missionType: "Mental Health", score: 71, outcome: "Partial", status: "warning" }
    ]
  },
  { 
    name: "Arjun Menon", initials: "AM", org: "Care India", matchPercent: 91, distance: "3.4 km", skills: ["Health", "Hindi", "First aid"], burnout: "low" as const, missions: 8, successRate: 92, color: "bg-success",
    aiBreakdown: {
      dimensions: { skillMatch: 92, proximity: 85, languageMatch: 100, pastSuccess: 92, emotionalCapacity: 88, zoneFamiliarity: 75, availability: 100, burnoutRisk: 92 },
      reasoning: "High specialization in health and first aid combined with perfect language match for this mission."
    },
    decisionLog: [
      { date: "Mar 10", missionType: "Health Camp", score: 89, outcome: "Completed", status: "success" },
      { date: "Feb 25", missionType: "First Aid Training", score: 92, outcome: "Awarded", status: "success" }
    ]
  },
  { 
    name: "Deepa Sharma", initials: "DS", org: "Seva Trust", matchPercent: 85, distance: "4.2 km", skills: ["Education", "English"], burnout: "medium" as const, missions: 15, successRate: 87, color: "bg-warning",
    aiBreakdown: {
      dimensions: { skillMatch: 88, proximity: 72, languageMatch: 95, pastSuccess: 87, emotionalCapacity: 80, zoneFamiliarity: 60, availability: 90, burnoutRisk: 75 },
      reasoning: "Experienced in education but limited familiarity with this specific zone."
    },
    decisionLog: [
      { date: "Mar 5", missionType: "Classroom Support", score: 85, outcome: "Completed", status: "success" }
    ]
  },
  { 
    name: "Karthik B.", initials: "KB", org: "Aid Alliance", matchPercent: 78, distance: "5.1 km", skills: ["Shelter", "Telugu"], burnout: "low" as const, missions: 6, successRate: 83, color: "bg-primary-glow",
    aiBreakdown: {
      dimensions: { skillMatch: 82, proximity: 65, languageMatch: 100, pastSuccess: 83, emotionalCapacity: 75, zoneFamiliarity: 50, availability: 100, burnoutRisk: 90 },
      reasoning: "Strong language skills but less experience in high-pressure shelter missions."
    },
    decisionLog: []
  },
  { 
    name: "Meera J.", initials: "MJ", org: "Hope Foundation", matchPercent: 94, distance: "1.8 km", skills: ["Food dist.", "Counseling"], burnout: "high" as const, missions: 22, successRate: 91, color: "bg-destructive",
    aiBreakdown: {
      dimensions: { skillMatch: 96, proximity: 100, languageMatch: 90, pastSuccess: 91, emotionalCapacity: 95, zoneFamiliarity: 98, availability: 70, burnoutRisk: 40 },
      reasoning: "Top choice for proximity and skills, however burnout risk is critically high."
    },
    decisionLog: [
      { date: "Mar 12", missionType: "Grief Counseling", score: 96, outcome: "Heroic success", status: "success" }
    ]
  },
  { 
    name: "Rahul P.", initials: "RP", org: "Care India", matchPercent: 82, distance: "6.0 km", skills: ["Health", "Kannada"], burnout: "low" as const, missions: 4, successRate: 100, color: "bg-success",
    aiBreakdown: {
      dimensions: { skillMatch: 80, proximity: 55, languageMatch: 100, pastSuccess: 100, emotionalCapacity: 85, zoneFamiliarity: 40, availability: 100, burnoutRisk: 95 },
      reasoning: "Promising new volunteer with perfect success rate and Kannada fluency."
    },
    decisionLog: []
  },
];

export default function Volunteers() {
  const [selectedVolunteer, setSelectedVolunteer] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [matchMin, setMatchMin] = useState([0]);
  const [distMax, setDistMax] = useState([10]);
  const [profileTab, setProfileTab] = useState("overview");

  const selected = volunteers.find(v => v.name === selectedVolunteer);

  return (
    <div className="flex flex-col h-full">
      <DashboardTopBar breadcrumb="Volunteers" />
      <div className="flex flex-1 overflow-hidden">
        {/* Filter sidebar */}
        <div className="hidden lg:block w-[220px] shrink-0 border-r bg-card p-4 overflow-y-auto space-y-5">
          <Input placeholder="Search by name..." className="rounded-button text-sm" />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Availability</p>
            {["Available Now", "This Week", "Anytime"].map(a => (
              <button key={a} className="block w-full text-left rounded-lg px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors">{a}</button>
            ))}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Skills</p>
            <div className="flex flex-wrap gap-1">
              {["Food", "Health", "Education", "Counseling", "First aid"].map(s => (
                <button key={s} className="rounded-pill border px-2 py-0.5 text-[11px] text-foreground hover:bg-primary-light hover:border-primary/30 transition-all">{s}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Distance (km)</p>
            <Slider value={distMax} onValueChange={setDistMax} max={20} />
            <span className="text-[11px] text-muted-foreground font-data">{distMax[0]} km</span>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Min Match Score</p>
            <Slider value={matchMin} onValueChange={setMatchMin} max={100} />
            <span className="text-[11px] text-muted-foreground font-data">{matchMin[0]}%</span>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Language</p>
            <div className="flex flex-wrap gap-1">
              {["Kannada", "Hindi", "English", "Telugu", "Tamil"].map(l => (
                <button key={l} className="rounded-pill border px-2 py-0.5 text-[11px] text-foreground hover:bg-primary-light hover:border-primary/30 transition-all">{l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-foreground">Volunteers</h1>
              <p className="text-sm text-muted-foreground">47 active · 18 available now</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex border rounded-lg overflow-hidden">
                <button onClick={() => setView("grid")} className={cn("p-2", view === "grid" ? "bg-primary text-white" : "text-muted-foreground")}><Grid3X3 className="h-4 w-4" /></button>
                <button onClick={() => setView("list")} className={cn("p-2", view === "list" ? "bg-primary text-white" : "text-muted-foreground")}><List className="h-4 w-4" /></button>
              </div>
              <Button variant="gradient" size="sm">Add Volunteer</Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatMetricCard label="Total Volunteers" value="47" accent="indigo" />
            <StatMetricCard label="Available Now" value="18" accent="green" />
            <StatMetricCard label="On Mission" value="12" accent="amber" />
            <StatMetricCard label="Burnout Risk" value="3" accent="red" delta="Needs attention" deltaDirection="up" />
          </div>

          {/* Grid */}
          <div className={cn(view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6" : "space-y-4")}>
            {volunteers.map(v => (
              view === "grid" ? (
                <VolunteerAvatarCard key={v.name} {...v} onViewProfile={() => setSelectedVolunteer(v.name)} onDispatch={() => {}} className="h-full flex flex-col" />
              ) : (
                <VolunteerAvatarCard key={v.name} {...v} compact onDispatch={() => {}} onViewProfile={() => setSelectedVolunteer(v.name)} />
              )
            ))}
          </div>
        </div>

        {/* Profile slide-over */}
        {selected && (
          <div className="w-[420px] shrink-0 border-l bg-card overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white", selected.color)}>{selected.initials}</div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{selected.name}</h3>
                    <p className="text-sm text-muted-foreground">{selected.org}</p>
                    <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-success font-medium"><span className="h-2 w-2 rounded-full bg-success" />Available</span>
                  </div>
                </div>
                <button onClick={() => setSelectedVolunteer(null)} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>

              <div className="flex gap-1 border-b mb-4 overflow-x-auto">
                {["overview", "history", "skills", "dna", "log"].map(t => (
                  <button key={t} onClick={() => setProfileTab(t)} className={cn("px-3 py-2 text-xs font-medium capitalize border-b-2 transition-colors whitespace-nowrap", profileTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                    {t === "dna" ? "DNA Profile" : t === "history" ? "Mission History" : t === "log" ? "AI Decision Log" : t}
                  </button>
                ))}
              </div>

              {profileTab === "overview" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Match Score</span><span className="font-semibold text-success font-data">{selected.matchPercent}%</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Distance</span><span className="font-data">{selected.distance}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Missions</span><span className="font-data">{selected.missions}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Success Rate</span><span className="font-data">{selected.successRate}%</span></div>
                  <div><p className="text-xs text-muted-foreground mb-1">Skills</p><div className="flex flex-wrap gap-1">{selected.skills.map(s => <span key={s} className="rounded-pill bg-primary-light px-2 py-0.5 text-[11px] font-medium text-primary">{s}</span>)}</div></div>
                </div>
              )}
              {profileTab === "dna" && (
                <div className="flex justify-center py-8">
                  <svg viewBox="0 0 200 200" className="h-48 w-48">
                    {/* Radar chart placeholder */}
                    {[0, 1, 2, 3, 4, 5].map(i => {
                      const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                      const labels = ["Skill", "Proximity", "Emotional", "Language", "Success", "Availability"];
                      return (
                        <g key={i}>
                          <line x1="100" y1="100" x2={100 + 80 * Math.cos(angle)} y2={100 + 80 * Math.sin(angle)} stroke="hsl(var(--border))" strokeWidth="0.5" />
                          <text x={100 + 90 * Math.cos(angle)} y={100 + 90 * Math.sin(angle)} textAnchor="middle" fontSize="7" fill="hsl(var(--text-muted))">{labels[i]}</text>
                        </g>
                      );
                    })}
                    {[20, 40, 60, 80].map(r => (
                      <polygon key={r} points={[0, 1, 2, 3, 4, 5].map(i => { const a = (Math.PI * 2 * i) / 6 - Math.PI / 2; return `${100 + r * Math.cos(a)},${100 + r * Math.sin(a)}`; }).join(" ")} fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />
                    ))}
                    <polygon points={[90, 70, 60, 80, 75, 85].map((v, i) => { const a = (Math.PI * 2 * i) / 6 - Math.PI / 2; const r = (v / 100) * 80; return `${100 + r * Math.cos(a)},${100 + r * Math.sin(a)}`; }).join(" ")} fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                  </svg>
                </div>
              )}
              {profileTab === "history" && (
                <div className="space-y-3">
                  {[{ zone: "Hebbal North", type: "Food Distribution", outcome: "completed", date: "Mar 15" }, { zone: "Yelahanka", type: "Health Camp", outcome: "completed", date: "Mar 12" }].map((m, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                      <div className="flex-1"><p className="font-medium text-foreground">{m.zone}</p><p className="text-xs text-muted-foreground">{m.type}</p></div>
                      <span className="rounded-pill bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success capitalize">{m.outcome}</span>
                      <span className="text-xs text-muted-foreground">{m.date}</span>
                    </div>
                  ))}
                </div>
              )}
              {profileTab === "skills" && (
                <div className="flex flex-wrap gap-2">
                  {selected.skills.map(s => <span key={s} className="rounded-pill bg-primary-light px-3 py-1.5 text-xs font-medium text-primary">{s}</span>)}
                </div>
              )}
              {profileTab === "log" && (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[13px] font-medium text-muted-foreground">Score trend</p>
                      <div className="flex items-center gap-1 text-success text-xs font-bold">
                        <TrendingUp className="w-3 h-3" />
                        +12% improvm.
                      </div>
                    </div>
                    <div className="h-20 w-full relative">
                      <svg viewBox="0 0 100 40" className="h-full w-full overflow-visible">
                        <path 
                          d="M 0 35 Q 25 32, 50 15 T 100 5" 
                          fill="none" 
                          stroke="hsl(var(--success))" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                        />
                        <path 
                          d="M 0 35 Q 25 32, 50 15 T 100 5 V 40 H 0 Z" 
                          fill="url(#gradient-log)" 
                          opacity="0.1" 
                        />
                        <defs>
                          <linearGradient id="gradient-log" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--success))" />
                            <stop offset="100%" stopColor="transparent" />
                          </linearGradient>
                        </defs>
                        <circle cx="100" cy="5" r="3" fill="hsl(var(--success))" />
                      </svg>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[13px] font-medium text-muted-foreground">How Gemini has scored this volunteer over time</p>
                    <div className="space-y-3">
                      {(selected as any).decisionLog?.map((log: any, i: number) => (
                        <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-100 p-4 transition-all hover:border-primary/20">
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 uppercase">{log.date}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-foreground truncate">{log.missionType}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-bold text-primary">{log.score}% match</span>
                              <span className="text-[10px] text-muted-foreground opacity-50">•</span>
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                log.status === "success" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                              )}>{log.outcome}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(selected as any).decisionLog?.length === 0 && (
                        <div className="text-center py-6 border-2 border-dashed rounded-xl">
                          <p className="text-sm text-muted-foreground">No past scoring events recorded yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Button variant="gradient" className="w-full mt-6" size="lg">Dispatch to Mission →</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
