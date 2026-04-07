import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  getVolunteerDashboard,
  updateVolunteerProfile,
  type VolunteerDashboardImpactItem,
} from "@/lib/coordinator-api";
import {
  Activity,
  ArrowRight,
  Award,
  Clock,
  Droplets,
  HeartPulse,
  Languages,
  Leaf,
  Loader2,
  MapPin,
  Navigation,
  Target,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";

const needTypeIcon = (needType: string) => {
  const normalized = needType.toLowerCase();
  if (normalized.includes("food")) return { icon: Utensils, bg: "bg-[#FDF2E9]", textColor: "text-[#93522E]" };
  if (normalized.includes("water") || normalized.includes("health")) return { icon: Droplets, bg: "bg-[#EFF6FF]", textColor: "text-[#3B82F6]" };
  if (normalized.includes("education")) return { icon: Leaf, bg: "bg-[#ECFDF5]", textColor: "text-[#10B981]" };
  return { icon: Activity, bg: "bg-[#EEF2FF]", textColor: "text-[#4F46E5]" };
};

const badgePresentation = (badge: string) => {
  const normalized = badge.toLowerCase();
  if (normalized.includes("food")) {
    return { label: "Food Expert", icon: Utensils, iconClass: "text-amber-500", bgClass: "bg-amber-50" };
  }
  if (normalized.includes("kannada") || normalized.includes("language")) {
    return { label: "Language Specialist", icon: Languages, iconClass: "text-emerald-500", bgClass: "bg-emerald-50" };
  }
  return { label: badge, icon: Award, iconClass: "text-indigo-500", bgClass: "bg-indigo-50" };
};

const statusClass = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === "success" || normalized === "completed") return "bg-[#10B981] text-white";
  if (normalized === "closed") return "bg-slate-200 text-slate-600";
  return "bg-indigo-100 text-indigo-700";
};

export default function VolunteerDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const dashboardQuery = useQuery({
    queryKey: ["volunteer-dashboard"],
    queryFn: getVolunteerDashboard,
    refetchInterval: 10000,
  });

  const updateAvailability = useMutation({
    mutationFn: (isAvailable: boolean) =>
      updateVolunteerProfile({
        availability: isAvailable ? "available" : "unavailable",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["volunteer-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["volunteer-profile"] });
    },
    onError: (error: Error) => {
      toast({ title: "Could not update availability", description: error.message, variant: "destructive" });
    },
  });

  const dashboard = dashboardQuery.data;
  const isAvailable = (dashboard?.availability || "available").toLowerCase() === "available";

  const recentImpactHistory = useMemo<VolunteerDashboardImpactItem[]>(
    () => dashboard?.recentImpactHistory ?? [],
    [dashboard?.recentImpactHistory],
  );

  const burnoutPercent = Math.max(0, Math.min(100, dashboard?.sidebar.burnoutScore || 0));
  const missionRingPercent = Math.max(0, Math.min(100, ((dashboard?.sidebar.missionsPerMonth || 0) / 20) * 100));
  const strokeDashoffset = 440 - (440 * missionRingPercent) / 100;

  if (dashboardQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FE] text-slate-600">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading volunteer dashboard...
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboard) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FE] p-8">
        <div className="bg-white rounded-3xl p-8 border border-red-100 text-center max-w-lg w-full">
          <h2 className="text-lg font-bold text-red-600 mb-2">Unable to load dashboard</h2>
          <p className="text-slate-500 text-sm mb-6">{(dashboardQuery.error as Error)?.message || "Please try again."}</p>
          <Button onClick={() => dashboardQuery.refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F8F9FE]">
      <DashboardTopBar breadcrumb="Volunteer Dashboard" />
      
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Hero Greeting Card */}
          <div className="bg-gradient-to-br from-[#4F46E5] to-[#3730A3] rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 flex justify-between items-center">
              <div>
                <h1 className="text-[2rem] font-bold tracking-tight">{dashboard.hero.greeting}</h1>
                <p className="text-base opacity-80 mt-1 font-medium max-w-md">
                  {dashboard.hero.subtitle}
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">Availability</span>
                <Switch 
                  checked={isAvailable} 
                  onCheckedChange={(next) => updateAvailability.mutate(next)}
                  disabled={updateAvailability.isPending}
                  className="data-[state=checked]:bg-[#10B981] h-7 w-12"
                />
              </div>
            </div>
            {/* Abstract background shapes */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* New Mission Priority Card */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-400" />
              <div className="flex items-center justify-between mb-4">
                <Badge className="bg-orange-50 text-orange-600 border-none font-black text-[9px] tracking-widest px-3 py-1 rounded-full">
                  {dashboard.priorityMission ? "NEW MISSION PRIORITY" : "NO PRIORITY MISSION"}
                </Badge>
                <span className="text-[10px] font-bold text-slate-400">{dashboard.priorityMission?.relativeTime || "-"}</span>
              </div>

              <h2 className="text-xl font-bold text-[#1A1A3D] mb-4">{dashboard.priorityMission?.title || "No mission available right now"}</h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-slate-500 font-bold text-xs">
                  <MapPin className="w-4 h-4 text-slate-300" />
                  {dashboard.priorityMission?.zoneName || "Zone not assigned"}
                </div>
                <div className="flex items-center gap-3 text-slate-500 font-bold text-xs">
                  <Navigation className="w-4 h-4 text-slate-300" />
                  {dashboard.priorityMission?.distanceLabel || "Distance unavailable"}
                </div>
                <div className="flex items-center gap-3 text-slate-500 font-bold text-xs">
                  <Clock className="w-4 h-4 text-slate-300" />
                  {dashboard.priorityMission?.durationLabel || "Duration unavailable"}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-[#5A57FF] hover:bg-[#4845E0] text-white font-bold py-5 rounded-xl shadow-lg shadow-indigo-50"
                  onClick={() => navigate("/volunteer/missions")}
                >
                  View Details
                </Button>
                <Button
                  variant="secondary"
                  className="bg-slate-50 text-slate-400 font-bold py-5 px-8 rounded-xl border-none hover:bg-slate-100 italic"
                  onClick={() => navigate("/volunteer/missions")}
                >
                  Open Missions
                </Button>
              </div>
            </div>

            {/* Mission in Progress Card */}
            <div className="bg-[#1A1A3D] rounded-[2rem] p-6 shadow-sm flex flex-col justify-between text-white relative">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#10B981]">Mission in Progress</span>
              </div>

              <div>
                <h2 className="text-xl font-bold mb-1">{dashboard.activeMission?.title || "No active mission"}</h2>
                <p className="text-slate-400 text-sm font-medium">{dashboard.activeMission?.locationAddress || "Awaiting next assignment"}</p>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-[#3730A3] text-white border-none text-[9px] uppercase tracking-widest">
                    {dashboard.activeMission?.status || "idle"}
                  </Badge>
                </div>
                <Button
                  className="bg-white text-[#1A1A3D] hover:bg-slate-100 font-bold px-6 py-4 rounded-xl flex gap-1.5 text-xs"
                  onClick={() => navigate("/volunteer/missions")}
                >
                  <Navigation className="w-3.5 h-3.5" /> Navigate
                </Button>
              </div>
            </div>
          </div>

          {/* Recent Impact History */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#1A1A3D]">Recent Impact History</h2>
              <Button variant="ghost" className="text-[#5A57FF] font-black text-[10px] uppercase tracking-widest flex gap-2">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="space-y-3">
              {recentImpactHistory.length === 0 ? (
                <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-slate-100 text-sm text-slate-500">
                  No completed missions yet. Your impact history will appear here after your first completed assignment.
                </div>
              ) : recentImpactHistory.map((h, i) => {
                const visual = needTypeIcon(h.needType);
                return (
                <div key={h.id} className="bg-white rounded-[1.5rem] p-4 shadow-sm border border-slate-50 relative group">
                  <div className="flex items-start gap-4">
                    <div className={cn("p-3 rounded-xl", visual.bg)}>
                      <visual.icon className={cn("w-5 h-5", visual.textColor)} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <h3 className="text-base font-bold text-[#1A1A3D]">{h.title}</h3>
                        <Badge className={cn("border-none font-black text-[8px] tracking-widest px-2", statusClass(h.status))}>
                          {h.status}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium text-slate-400 mb-2">{h.locationLabel}</p>
                      {h.quote && (
                        <div className="bg-[#F8F9FE] rounded-xl p-3 border border-slate-50 italic text-slate-500 font-medium text-xs leading-relaxed relative">
                          "{h.quote}"
                          <div className="absolute -left-px top-3 w-1 h-1/2 bg-[#5A57FF]/10 rounded-full" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Stats & DNA */}
        <div className="flex w-[350px] shrink-0 border-l border-slate-100 bg-[#FBFBFF] flex-col p-8 min-h-0 overflow-y-auto overflow-x-hidden">
          
          {/* Circular Metric */}
          <div className="text-center mb-10">
            <p className="text-[10px] font-black uppercase symbols tracking-[0.25em] text-slate-400 mb-6">Impact Summary</p>
            <div className="relative w-40 h-40 mx-auto">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="80" cy="80" r="70" stroke="#EEF0FF" strokeWidth="8" fill="transparent" />
                <circle 
                  cx="80" cy="80" r="70" stroke="#3730A3" strokeWidth="10" fill="transparent" 
                  strokeDasharray="440" strokeDashoffset="110"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="drop-shadow-[0_0_8px_rgba(55,48,163,0.2)]"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-[#1A1A3D]">{dashboard.sidebar.missionsPerMonth}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#3730A3] mt-0.5">Missions/Mo</span>
              </div>
            </div>
            <p className="mt-6 text-xs font-bold text-[#1A1A3D] flex items-center justify-center gap-2">
              <Target className="w-3.5 h-3.5 text-[#5A57FF]" /> {dashboard.sidebar.percentileText}
            </p>
          </div>

          {/* DNA Radar Chart */}
          <div className="mb-10">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-8">Impact DNA</p>
            <div className="relative w-full aspect-square flex items-center justify-center scale-100">
              {/* Background Hexagon Rings */}
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-[0.03]">
                <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="none" stroke="#1A1A3D" strokeWidth="1.5" />
              </svg>
              
              {/* Radar Data Shape */}
              <svg viewBox="0 0 100 100" className="w-[80%] h-[80%]">
                <polygon
                  points={
                    `${50},${100 - (dashboard.sidebar.dnaProfile.skill || 50) * 0.85} ` +
                    `${40 + (dashboard.sidebar.dnaProfile.proximity || 50) * 0.9},${35 + (100 - (dashboard.sidebar.dnaProfile.proximity || 50)) * 0.45} ` +
                    `${30 + (dashboard.sidebar.dnaProfile.emotional || 50) * 0.75},${45 + (dashboard.sidebar.dnaProfile.emotional || 50) * 0.5} ` +
                    `${50},${15 + (dashboard.sidebar.dnaProfile.lang || 50) * 0.75} ` +
                    `${15 + (dashboard.sidebar.dnaProfile.success || 50) * 0.35},${45 + (dashboard.sidebar.dnaProfile.success || 50) * 0.4} ` +
                    `${15 + (dashboard.sidebar.dnaProfile.avail || 50) * 0.2},${35 + (100 - (dashboard.sidebar.dnaProfile.avail || 50)) * 0.45}`
                  }
                  fill="rgba(90, 87, 255, 0.25)" 
                  stroke="#5A57FF" 
                  strokeWidth="2.5" 
                  strokeLinejoin="round"
                />
                <circle cx="50" cy="15" r="2" fill="#5A57FF" />
                <circle cx="88" cy="38" r="2" fill="#5A57FF" />
                <circle cx="82" cy="78" r="2" fill="#5A57FF" />
                <circle cx="50" cy="92" r="2" fill="#5A57FF" />
                <circle cx="18" cy="78" r="2" fill="#5A57FF" />
                <circle cx="12" cy="38" r="2" fill="#5A57FF" />
              </svg>

              {/* Labels */}
              <div className="absolute top-[-5px] text-[8px] font-black tracking-tighter text-slate-400">SKILL</div>
              <div className="absolute right-[-15px] top-[30%] text-[8px] font-black tracking-tighter text-slate-400">PROXIMITY</div>
              <div className="absolute right-[-15px] bottom-[25%] text-[8px] font-black tracking-tighter text-slate-400">EMOTIONAL</div>
              <div className="absolute bottom-[-5px] text-[8px] font-black tracking-tighter text-slate-400 uppercase">LANG</div>
              <div className="absolute left-[-15px] bottom-[25%] text-[8px] font-black tracking-tighter text-slate-400">SUCCESS</div>
              <div className="absolute left-[-15px] top-[30%] text-[8px] font-black tracking-tighter text-slate-400">AVAIL</div>
            </div>
          </div>

          {/* Verified Badges Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              <p>Verified Badges</p>
              <Award className="w-3.5 h-3.5 text-slate-300" />
            </div>
            <div className="space-y-3">
              {dashboard.sidebar.badges.length === 0 ? (
                <div className="bg-white border text-xs border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm text-slate-500 font-medium">
                  No verified badges yet.
                </div>
              ) : (
                dashboard.sidebar.badges.slice(0, 4).map((badge) => {
                  const visual = badgePresentation(badge);
                  return (
                    <div key={badge} className="bg-white border text-xs border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                      <div className={cn("p-2 rounded-lg", visual.bgClass)}>
                        <visual.icon className={cn("w-4 h-4", visual.iconClass)} />
                      </div>
                      <span className="font-bold text-[#1A1A3D]">{visual.label}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Burnout Risk Section */}
          <div className="mt-auto pt-6 border-t border-slate-100/50">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-3.5 h-3.5 text-slate-300" />
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Burnout Risk</p>
              </div>
              <span className={cn(
                "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                dashboard.sidebar.burnoutRisk === "high" || dashboard.sidebar.burnoutRisk === "critical"
                  ? "text-red-600 bg-red-50"
                  : dashboard.sidebar.burnoutRisk === "medium" || dashboard.sidebar.burnoutRisk === "moderate"
                    ? "text-amber-600 bg-amber-50"
                    : "text-[#10B981] bg-emerald-50"
              )}>{dashboard.sidebar.burnoutRisk.toUpperCase()}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full mb-4 overflow-hidden">
              <div className={cn(
                "h-full rounded-full",
                burnoutPercent >= 70 ? "bg-red-500" : burnoutPercent >= 40 ? "bg-amber-500" : "bg-[#10B981]"
              )} style={{ width: `${burnoutPercent}%` }} />
            </div>
            <div className="bg-[#5A57FF]/5 rounded-xl p-3 border border-[#5A57FF]/10">
              <p className="text-[9px] italic text-[#5A57FF] leading-relaxed font-bold">
                "{dashboard.sidebar.burnoutInsight}"
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
