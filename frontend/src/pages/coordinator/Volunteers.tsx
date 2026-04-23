import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { StatMetricCard } from "@/components/coordinator/StatMetricCard";
import { VolunteerAvatarCard } from "@/components/coordinator/VolunteerAvatarCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { X, Grid3X3, List, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCoordinatorVolunteers, type CoordinatorVolunteerItem } from "@/lib/coordinator-api";

export default function Volunteers() {
  const [selectedVolunteer, setSelectedVolunteer] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"available_now" | "this_week" | "anytime">("anytime");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [matchMin, setMatchMin] = useState([0]);
  const [distMax, setDistMax] = useState([10]);
  const [profileTab, setProfileTab] = useState("overview");

  const volunteersQuery = useQuery({
    queryKey: [
      "coordinator-volunteers",
      search,
      availabilityFilter,
      selectedSkills,
      selectedLanguages,
      matchMin[0],
      distMax[0],
    ],
    queryFn: () =>
      getCoordinatorVolunteers({
        search,
        availability: availabilityFilter,
        skills: selectedSkills,
        languages: selectedLanguages,
        minMatch: matchMin[0],
        maxDistanceKm: distMax[0],
        sortBy: "match",
      }),
    refetchInterval: 15000,
  });

  const volunteers = volunteersQuery.data?.volunteers ?? [];
  const selected = useMemo(
    () => volunteers.find((volunteer) => volunteer.id === selectedVolunteer),
    [volunteers, selectedVolunteer],
  );

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((item) => item !== skill) : [...prev, skill],
    );
  };

  const toggleLanguage = (language: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(language) ? prev.filter((item) => item !== language) : [...prev, language],
    );
  };

  const selectedVolunteerForPanel: CoordinatorVolunteerItem | undefined = selected;

  return (
    <div className="flex flex-col h-full">
      <DashboardTopBar breadcrumb="Volunteers" />
      <div className="flex flex-1 overflow-hidden">
        {/* Filter sidebar */}
        <div className="hidden lg:block w-[220px] shrink-0 border-r bg-card p-4 overflow-y-auto space-y-5">
          <Input
            placeholder="Search by name..."
            className="rounded-button text-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Availability</p>
            {[
              { key: "available_now", label: "Available Now" },
              { key: "this_week", label: "This Week" },
              { key: "anytime", label: "Anytime" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setAvailabilityFilter(item.key as "available_now" | "this_week" | "anytime")}
                className={cn(
                  "block w-full text-left rounded-lg px-3 py-1.5 text-xs transition-colors",
                  availabilityFilter === item.key ? "bg-primary-light text-primary font-semibold" : "text-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Skills</p>
            <div className="flex flex-wrap gap-1">
              {(volunteersQuery.data?.filters.skills ?? []).map((skill) => (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={cn(
                    "rounded-pill border px-2 py-0.5 text-[11px] transition-all",
                    selectedSkills.includes(skill)
                      ? "bg-primary-light border-primary/40 text-primary"
                      : "text-foreground hover:bg-primary-light hover:border-primary/30",
                  )}
                >
                  {skill}
                </button>
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
              {(volunteersQuery.data?.filters.languages ?? []).map((language) => (
                <button
                  key={language}
                  onClick={() => toggleLanguage(language)}
                  className={cn(
                    "rounded-pill border px-2 py-0.5 text-[11px] transition-all",
                    selectedLanguages.includes(language)
                      ? "bg-primary-light border-primary/40 text-primary"
                      : "text-foreground hover:bg-primary-light hover:border-primary/30",
                  )}
                >
                  {language}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-6 gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">Volunteers</h1>
              <p className="text-sm text-muted-foreground">
                {(volunteersQuery.data?.summary.totalVolunteers ?? 0)} active · {(volunteersQuery.data?.summary.availableNow ?? 0)} available now
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex border rounded-lg overflow-hidden">
                <button onClick={() => setView("grid")} className={cn("p-2", view === "grid" ? "bg-primary text-white" : "text-muted-foreground")}><Grid3X3 className="h-4 w-4" /></button>
                <button onClick={() => setView("list")} className={cn("p-2", view === "list" ? "bg-primary text-white" : "text-muted-foreground")}><List className="h-4 w-4" /></button>
              </div>
              <Button variant="gradient" size="sm" className="hidden sm:flex">Add Volunteer</Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 md:mb-6">
            <StatMetricCard label="Total Volunteers" value={String(volunteersQuery.data?.summary.totalVolunteers ?? 0)} accent="indigo" />
            <StatMetricCard label="Available Now" value={String(volunteersQuery.data?.summary.availableNow ?? 0)} accent="green" />
            <StatMetricCard label="On Mission" value={String(volunteersQuery.data?.summary.onMission ?? 0)} accent="amber" />
            <StatMetricCard
              label="Burnout Risk"
              value={String(volunteersQuery.data?.summary.burnoutRisk ?? 0)}
              accent="red"
              delta="Needs attention"
              deltaDirection="up"
            />
          </div>

          {/* Grid */}
          <div className={cn(view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6" : "space-y-4")}>
            {volunteers.map(v => (
              view === "grid" ? (
                <VolunteerAvatarCard key={v.id} {...v} onViewProfile={() => setSelectedVolunteer(v.id)} className="h-full flex flex-col" />
              ) : (
                <VolunteerAvatarCard key={v.id} {...v} compact onViewProfile={() => setSelectedVolunteer(v.id)} />
              )
            ))}
          </div>
          {volunteersQuery.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading volunteers...</p> : null}
          {!volunteersQuery.isLoading && volunteers.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No volunteers match current filters.</p> : null}
          {volunteersQuery.isError ? <p className="mt-4 text-sm text-destructive">{(volunteersQuery.error as Error).message}</p> : null}
        </div>

        {/* Profile slide-over */}
        {selectedVolunteerForPanel && (
          <div className="fixed inset-0 lg:relative lg:w-[420px] lg:shrink-0 lg:border-l bg-card overflow-y-auto z-50 lg:z-auto">
            <div className="p-4 md:p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white", selectedVolunteerForPanel.color)}>{selectedVolunteerForPanel.initials}</div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{selectedVolunteerForPanel.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedVolunteerForPanel.org}</p>
                    <span className={cn("mt-1 inline-flex items-center gap-1.5 text-xs font-medium", selectedVolunteerForPanel.availableNow ? "text-success" : "text-warning")}>
                      <span className={cn("h-2 w-2 rounded-full", selectedVolunteerForPanel.availableNow ? "bg-success" : "bg-warning")} />
                      {selectedVolunteerForPanel.availableNow ? "Available" : "Limited"}
                    </span>
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
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Match Score</span><span className="font-semibold text-success font-data">{selectedVolunteerForPanel.matchPercent}%</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Distance</span><span className="font-data">{selectedVolunteerForPanel.distance}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Missions</span><span className="font-data">{selectedVolunteerForPanel.missions}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Success Rate</span><span className="font-data">{selectedVolunteerForPanel.successRate}%</span></div>
                  <div><p className="text-xs text-muted-foreground mb-1">Skills</p><div className="flex flex-wrap gap-1">{selectedVolunteerForPanel.skills.map(s => <span key={s} className="rounded-pill bg-primary-light px-2 py-0.5 text-[11px] font-medium text-primary">{s}</span>)}</div></div>
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
                    <polygon points={[
                      selectedVolunteerForPanel.dnaProfile.skill,
                      selectedVolunteerForPanel.dnaProfile.proximity,
                      selectedVolunteerForPanel.dnaProfile.emotional,
                      selectedVolunteerForPanel.dnaProfile.language,
                      selectedVolunteerForPanel.dnaProfile.success,
                      selectedVolunteerForPanel.dnaProfile.availability,
                    ].map((v, i) => { const a = (Math.PI * 2 * i) / 6 - Math.PI / 2; const r = (v / 100) * 80; return `${100 + r * Math.cos(a)},${100 + r * Math.sin(a)}`; }).join(" ")} fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" strokeWidth="1.5" />
                  </svg>
                </div>
              )}
              {profileTab === "history" && (
                <div className="space-y-3">
                  {selectedVolunteerForPanel.missionHistory.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                      <div className="flex-1"><p className="font-medium text-foreground">{m.zone}</p><p className="text-xs text-muted-foreground">{m.type}</p></div>
                      <span className="rounded-pill bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success capitalize">{m.outcome}</span>
                      <span className="text-xs text-muted-foreground">{m.date}</span>
                    </div>
                  ))}
                  {selectedVolunteerForPanel.missionHistory.length === 0 ? <p className="text-sm text-muted-foreground">No missions found for this volunteer.</p> : null}
                </div>
              )}
              {profileTab === "skills" && (
                <div className="flex flex-wrap gap-2">
                  {selectedVolunteerForPanel.skills.map(s => <span key={s} className="rounded-pill bg-primary-light px-3 py-1.5 text-xs font-medium text-primary">{s}</span>)}
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
                      {selectedVolunteerForPanel.decisionLog?.map((log, i) => (
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
                      {selectedVolunteerForPanel.decisionLog?.length === 0 && (
                        <div className="text-center py-6 border-2 border-dashed rounded-xl">
                          <p className="text-sm text-muted-foreground">No past scoring events recorded yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
