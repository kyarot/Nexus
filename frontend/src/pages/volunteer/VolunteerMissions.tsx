import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  getVolunteerMissions,
  type CoordinatorMission,
} from "@/lib/coordinator-api";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Mic,
  Navigation,
  Plus,
  X,
} from "lucide-react";

const ACTIVE_STATUSES: CoordinatorMission["status"][] = ["dispatched", "en_route", "on_ground"];
const DECLINED_STATUSES: CoordinatorMission["status"][] = ["failed", "cancelled"];

const statusLabel = (status: CoordinatorMission["status"]) => {
  switch (status) {
    case "dispatched":
      return "In Progress";
    case "en_route":
      return "On Route";
    case "on_ground":
      return "On Ground";
    case "completed":
      return "Successful";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Awaiting Dispatch";
  }
};

const statusColor = (status: CoordinatorMission["status"]) => {
  switch (status) {
    case "completed":
      return "bg-[#9AF7C9] text-[#1B4D3E]";
    case "failed":
    case "cancelled":
      return "bg-[#FEE2E2] text-[#991B1B]";
    case "dispatched":
    case "en_route":
    case "on_ground":
      return "bg-[#E0E7FF] text-[#3730A3]";
    default:
      return "bg-[#FEF3C7] text-[#92400E]";
  }
};

const needTypeColor = (needType: string) => {
  const normalized = needType.toLowerCase();
  if (normalized.includes("food")) return "bg-[#EFF6FF] text-[#1E40AF]";
  if (normalized.includes("education")) return "bg-[#F5F3FF] text-[#6D28D9]";
  if (normalized.includes("health")) return "bg-[#ECFDF5] text-[#047857]";
  if (normalized.includes("security") || normalized.includes("safety")) return "bg-[#FEF2F2] text-[#B91C1C]";
  if (normalized.includes("shelter")) return "bg-[#FFF7ED] text-[#9A3412]";
  return "bg-slate-100 text-slate-600";
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "Recently";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Recently";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

const progressForStatus = (status: CoordinatorMission["status"]) => {
  switch (status) {
    case "dispatched":
      return 35;
    case "en_route":
      return 55;
    case "on_ground":
      return 75;
    case "completed":
      return 100;
    case "failed":
    case "cancelled":
      return 0;
    default:
      return 12;
  }
};

const VolunteerMissions = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [subTab, setSubTab] = useState("upcoming");
  const [selectedMission, setSelectedMission] = useState<CoordinatorMission | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState("overview");

  const missionsQuery = useQuery({
    queryKey: ["volunteer-missions"],
    queryFn: () => getVolunteerMissions(),
  });

  const missions = missionsQuery.data?.missions ?? [];

  const activeMissions = useMemo(
    () => missions.filter((mission) => ACTIVE_STATUSES.includes(mission.status)),
    [missions],
  );

  const upcomingMissions = useMemo(
    () => missions.filter((mission) => mission.status === "pending"),
    [missions],
  );

  const completedMissions = useMemo(
    () => missions.filter((mission) => mission.status === "completed"),
    [missions],
  );

  const declinedMissions = useMemo(
    () => missions.filter((mission) => DECLINED_STATUSES.includes(mission.status)),
    [missions],
  );

  const heroMission = activeMissions[0] ?? upcomingMissions[0] ?? missions[0] ?? null;

  const totalHours = useMemo(
    () => missions.reduce((sum, mission) => sum + (mission.estimatedDurationMinutes || 0) / 60, 0),
    [missions],
  );

  const successRate = missions.length ? Math.round((completedMissions.length / missions.length) * 100) : 0;

  const impactPoints = useMemo(
    () => completedMissions.reduce((sum, mission) => sum + Math.max(mission.familiesHelped || 0, 1) * 4, 0),
    [completedMissions],
  );

  const stats = [
    { label: "Total Missions", value: String(missions.length), color: "border-[#4F46E5]" },
    { label: "Success Rate", value: `${successRate}%`, color: "border-[#10B981]" },
    { label: "Total Hours", value: `${totalHours.toFixed(1)}h`, color: "border-[#F59E0B]" },
    { label: "Impact Points", value: String(impactPoints), color: "border-[#7C3AED]" },
  ];

  const missionGroups = [
    { id: "upcoming", label: "Upcoming", count: upcomingMissions.length },
    { id: "completed", label: "Completed", count: completedMissions.length },
    { id: "declined", label: "Declined", count: declinedMissions.length },
  ];

  const activeMission = heroMission && ACTIVE_STATUSES.includes(heroMission.status) ? heroMission : null;
  const heroMissionProgress = heroMission ? progressForStatus(heroMission.status) : 0;

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7FF] font-['Plus_Jakarta_Sans']">
      <DashboardTopBar breadcrumb="My Missions" />

      <div className="flex-1 p-8 space-y-8 max-w-[1400px]">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-[32px] font-bold text-[#1A1A3D]">My Missions</h1>
            <p className="text-[#64748B] font-medium text-base">Track your active and past community missions</p>
          </div>

          <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-full border border-slate-200">
            {[
              { label: "All", value: "all" },
              { label: "Active", value: "active" },
              { label: "Completed", value: "completed" },
              { label: "Declined", value: "declined" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all",
                  activeTab === tab.value
                    ? "bg-[#4F46E5] text-white shadow-md"
                    : "text-[#64748B] hover:text-[#4F46E5] bg-transparent",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {(activeTab === "all" || activeTab === "active") && (
          <div className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-[2rem] p-8 text-white shadow-[0_20px_50px_rgba(79,70,229,0.2)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white opacity-[0.03] rounded-full -mr-40 -mt-40 transition-transform group-hover:scale-110 duration-700" />

            {heroMission ? (
              <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8">
                <div className="flex-1 space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                      {activeMission ? "ACTIVE MISSION" : "UPCOMING MISSION"}
                    </span>
                  </div>

                  <h2 className="text-[28px] font-bold leading-tight">{heroMission.title}</h2>

                  <div className="flex flex-wrap gap-3">
                    {[
                      heroMission.zoneName || heroMission.ward || "Assigned zone",
                      heroMission.location?.address || "Field deployment",
                      `${heroMission.estimatedDurationMinutes || 45} min`,
                    ].map((chip, index) => (
                      <div
                        key={index}
                        className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-xl text-xs font-bold border border-white/10"
                      >
                        {chip}
                      </div>
                    ))}
                  </div>

                  <div className="max-w-md space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-bold opacity-80">{statusLabel(heroMission.status)}</span>
                      <span className="text-xs font-black uppercase tracking-widest">{heroMissionProgress}% Complete</span>
                    </div>
                    <Progress value={heroMissionProgress} className="h-2 bg-white/20 [&>div]:bg-white" />
                  </div>

                  <div className="flex flex-wrap gap-4 pt-4">
                    <Button className="bg-white text-[#4F46E5] hover:bg-slate-50 font-bold px-6 py-6 rounded-2xl flex gap-2">
                      <Navigation className="w-4 h-4" /> Navigate
                    </Button>
                    <Button variant="outline" className="border-white/40 hover:bg-white/10 text-white font-bold px-6 py-6 rounded-2xl flex gap-2 bg-white/5">
                      <Mic className="w-4 h-4" /> Log Update
                    </Button>
                    <Button variant="outline" className="border-white/40 hover:bg-white/10 text-white font-bold px-6 py-6 rounded-2xl flex gap-2 bg-white/5">
                      <FileText className="w-4 h-4" /> View Brief
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col justify-end items-end shrink-0">
                  <p className="text-sm opacity-60 font-medium italic text-right max-w-[260px]">
                    {heroMission.status === "completed"
                      ? `Completed on ${formatDate(heroMission.completedAt || heroMission.updatedAt || heroMission.createdAt)}`
                      : `Created ${formatDate(heroMission.createdAt)} by ${heroMission.creatorName || "the coordinator"}`}
                  </p>
                  <p className="text-sm opacity-60 font-medium italic text-right mt-2 max-w-[260px]">
                    {heroMission.assignedToName ? `Assigned to ${heroMission.assignedToName}` : "Awaiting volunteer confirmation"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative z-10 py-10 text-center space-y-3">
                <h2 className="text-[28px] font-bold leading-tight">No volunteer missions yet</h2>
                <p className="text-white/70 max-w-xl mx-auto">
                  Once a coordinator creates a mission for volunteers, it will appear here automatically.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={cn(
                "bg-white rounded-[1.25rem] p-6 shadow-sm border-l-4 border-slate-100",
                stat.color,
              )}
            >
              <span className="text-[11px] font-black text-[#64748B] uppercase tracking-widest mb-2 block">{stat.label}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-bold text-[#1A1A3D]">{stat.value}</span>
              </div>
              <div className="mt-2 text-[10px] font-bold text-[#10B981] flex items-center gap-1">
                <Plus className="w-2.5 h-2.5" /> Live from backend
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 min-h-[500px]">
          <div className="flex items-center gap-8 mb-8 border-b border-slate-100">
            {missionGroups.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={cn(
                  "pb-4 px-2 text-sm font-bold relative transition-colors",
                  subTab === tab.id ? "text-[#4F46E5]" : "text-slate-400 hover:text-slate-600",
                )}
              >
                {tab.label}
                {tab.id === "upcoming" && (
                  <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px]">{tab.count}</span>
                )}
                {subTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#4F46E5] rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {subTab === "upcoming" && (
              <div className="space-y-4">
                {upcomingMissions.length ? (
                  upcomingMissions.map((mission) => (
                    <MissionRow key={mission.id} mission={mission} onOpen={() => setSelectedMission(mission)} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                    <div className="w-24 h-24 bg-[#F8F7FF] rounded-full flex items-center justify-center">
                      <Clock className="w-10 h-10 text-[#C7D2FE]" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-[#1A1A3D]">No upcoming missions</h3>
                      <p className="text-slate-400 font-medium">You haven't been assigned any new volunteer missions yet.</p>
                    </div>
                    <Button className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold px-8 py-6 rounded-2xl flex gap-2">
                      Browse available missions <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {subTab === "completed" && (
              <div className="space-y-4">
                {completedMissions.length ? (
                  completedMissions.map((mission) => (
                    <CompletedMissionCard key={mission.id} mission={mission} onOpen={() => setSelectedMission(mission)} />
                  ))
                ) : (
                  <EmptyMissionState title="No completed missions" description="Finished missions will appear here after you close them out." />
                )}
              </div>
            )}

            {subTab === "declined" && (
              <div className="space-y-4">
                {declinedMissions.length ? (
                  declinedMissions.map((mission) => (
                    <DeclinedMissionCard key={mission.id} mission={mission} onOpen={() => setSelectedMission(mission)} />
                  ))
                ) : (
                  <EmptyMissionState title="No declined missions" description="Cancelled or failed missions will show up here." />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Sheet
        open={!!selectedMission}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMission(null);
            setActiveDetailTab("overview");
          }
        }}
      >
        <SheetContent className="sm:max-w-[400px] p-0 flex flex-col bg-white border-l border-slate-100 font-['Plus_Jakarta_Sans']">
          {selectedMission && (
            <div className="flex flex-col h-full">
              <div className="h-[180px] bg-[#E0E7FF] relative overflow-hidden shrink-0">
                <div className="absolute inset-0 opacity-40 bg-[url('https://www.google.com/maps/vt/pb=!1m5!1m4!1i12!2i2365!2i1575!4i256!2m3!1e0!2sm!3i625206676!3m17!2sen!3sUS!5e18!12m4!1e68!2m2!1sset!2sRoadmap!12m3!1e37!2m1!1ssmartmaps!12m4!1e26!2m2!1s1i1!2s1!4e0!5m4!1e0!8m2!1i1100!2i1100!6m6!1e12!2i2!26b1!39b1!44e1!50e0!23i1301813')] bg-cover" />
                <div className="absolute top-4 right-4 z-20">
                  <SheetClose className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-md shadow-sm flex items-center justify-center text-[#1A1A3D] hover:bg-white transition-all border-none focus-visible:ring-0">
                    <X className="w-4 h-4" />
                  </SheetClose>
                </div>
                <div className="absolute bottom-4 left-6 space-y-2">
                  <Badge className={cn("border-none px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm", statusColor(selectedMission.status))}>
                    {statusLabel(selectedMission.status)}
                  </Badge>
                  <Badge className="border-none px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm bg-white/90 text-[#1A1A3D] ml-2">
                    {selectedMission.targetAudience}
                  </Badge>
                </div>
              </div>

              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                <SheetHeader className="space-y-3">
                  <SheetTitle className="text-[22px] font-bold text-[#1A1A3D] leading-tight">{selectedMission.title}</SheetTitle>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500 font-medium">
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {selectedMission.zoneName || selectedMission.zoneId}</span>
                    <span>·</span>
                    <span>{selectedMission.needType}</span>
                    <span>·</span>
                    <span>{selectedMission.estimatedDurationMinutes} min</span>
                  </div>
                </SheetHeader>

                <div className="flex border-b border-slate-100 mb-6">
                  {["Overview", "Empathy Brief", "Field Notes", "Outcome"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveDetailTab(tab.toLowerCase().replace(" ", ""))}
                      className={cn(
                        "flex-1 pb-3 text-[10px] font-black uppercase tracking-widest transition-all relative",
                        activeDetailTab === tab.toLowerCase().replace(" ", "") ? "text-[#4F46E5]" : "text-slate-400 hover:text-slate-600",
                      )}
                    >
                      {tab}
                      {activeDetailTab === tab.toLowerCase().replace(" ", "") && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4F46E5] rounded-t-full" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {activeDetailTab === "overview" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <InfoTile label="Dispatched By" value={selectedMission.creatorName || "Coordinator"} />
                        <InfoTile label="Type" value={selectedMission.needType} highlight />
                        <InfoTile label="Location" value={selectedMission.location?.address || selectedMission.zoneName || "Assigned zone"} />
                        <InfoTile label="Duration" value={`${selectedMission.estimatedDurationMinutes} min`} />
                      </div>

                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MISSION BRIEF</p>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-medium text-slate-600 leading-relaxed italic">
                          {selectedMission.description || selectedMission.notes || "No mission brief available yet."}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeDetailTab === "empathybrief" && (
                    <div className="space-y-6">
                      <div className="p-6 bg-[#F5F3FF] rounded-[1.5rem] border border-indigo-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <FileText className="w-12 h-12 text-[#4F46E5]" />
                        </div>
                        <h4 className="text-sm font-bold text-[#1A1A3D] mb-3">Contextual Sentiment</h4>
                        <p className="text-sm text-slate-600 leading-relaxed italic mb-6">
                          {selectedMission.instructions || "Approach with calm communication and keep the coordination channel updated."}
                        </p>
                        <Button className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold py-6 rounded-xl flex gap-2">
                          Re-read Full Brief <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {activeDetailTab === "fieldnotes" && (
                    <div className="space-y-6">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">TIMELINE OF UPDATES</p>
                      <div className="space-y-6">
                        <div className="flex gap-4 group">
                          <div className="flex flex-col items-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#4F46E5] mt-1.5 ring-4 ring-indigo-50" />
                            <div className="w-px flex-1 bg-slate-100 my-2" />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-baseline mb-2">
                              <h4 className="text-[13px] font-bold text-[#1A1A3D]">Latest Update</h4>
                              <span className="text-[10px] text-slate-400 font-bold">{formatDate(selectedMission.updatedAt || selectedMission.createdAt)}</span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-medium text-slate-600 italic">
                              {selectedMission.statusText || selectedMission.notes || "No field notes have been logged yet."}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeDetailTab === "outcome" && (
                    <div className="space-y-6">
                      <div className="bg-[#1E1B4B] rounded-[2rem] p-6 text-white relative overflow-hidden">
                        <div className="absolute -bottom-4 -right-4 opacity-10">
                          <CheckCircle2 className="w-24 h-24" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-4">Impact Summary</p>
                        <div className="flex items-center justify-between mb-6">
                          <div className="text-center">
                            <span className="text-2xl font-black block">{selectedMission.progress || 0}</span>
                            <span className="text-[10px] font-bold opacity-40 uppercase">Progress</span>
                          </div>
                          <ArrowRight className="w-6 h-6 opacity-20" />
                          <div className="text-center">
                            <span className="text-2xl font-black text-[#10B981] block">{selectedMission.familiesHelped || 0}</span>
                            <span className="text-[10px] font-bold opacity-40 uppercase">Families helped</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold mb-1">
                            <span>Impact Target</span>
                            <span>{selectedMission.status === "completed" ? "100%" : `${selectedMission.progress || 0}%`}</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-[#10B981] w-[92%] rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                          </div>
                        </div>
                      </div>

                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">COORDINATOR FEEDBACK</p>
                        <div className="flex gap-1.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <div key={star} className={cn("w-3 h-3 rounded-full", star <= 5 ? "bg-[#F59E0B]" : "bg-slate-200")} />
                          ))}
                        </div>
                        <p className="text-xs font-medium text-slate-500 italic leading-relaxed">
                          {selectedMission.assignedToName
                            ? `${selectedMission.assignedToName} is matched to this volunteer mission and can now see it in the volunteer feed.`
                            : "This mission is available in the volunteer feed and will surface once assigned or accepted."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-slate-50 shrink-0">
                <Button
                  onClick={() => setSelectedMission(null)}
                  className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold py-7 rounded-2xl shadow-lg transition-all active:scale-[0.98]"
                >
                  Close Mission Detail
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const MissionRow = ({ mission, onOpen }: { mission: CoordinatorMission; onOpen: () => void }) => {
  return (
    <div className="group">
      <div
        onClick={onOpen}
        className="bg-white rounded-[1.25rem] border border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer hover:border-[#4F46E5]/30 hover:shadow-md transition-all relative overflow-hidden"
      >
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#4F46E5]" />

        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h4 className="text-[17px] font-bold text-[#1A1A3D]">{mission.title}</h4>
            <Badge variant="outline" className="border-slate-200 text-slate-500 font-bold bg-slate-50">
              {mission.zoneName || mission.zoneId}
            </Badge>
            <Badge className={cn("border-none px-3 py-1 rounded-full text-[11px] font-bold", needTypeColor(mission.needType))}>
              {mission.needType}
            </Badge>
          </div>

          <div className="flex items-center gap-6 text-[13px] text-slate-400 font-medium">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> {formatDate(mission.createdAt)}
            </div>
            <span>·</span>
            <div>{statusLabel(mission.status)}</div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Badge className={cn("border-none px-3 py-1 rounded-full text-[11px] font-bold", statusColor(mission.status))}>
              {statusLabel(mission.status)}
            </Badge>
            <Badge className="border-none px-3 py-1 rounded-full text-[11px] font-bold bg-[#F8F7FF] text-[#4F46E5]">
              {mission.targetAudience === "volunteer" ? "Volunteer Mission" : "Field Worker Mission"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-12">
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Progress</p>
            <span className="text-[18px] font-black text-[#10B981]">{mission.progress || 0}%</span>
          </div>
          <div
            className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-[#4F46E5] group-hover:bg-indigo-50 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
};

const CompletedMissionCard = ({ mission, onOpen }: { mission: CoordinatorMission; onOpen: () => void }) => {
  return (
    <div className="group">
      <div
        onClick={onOpen}
        className="bg-white rounded-[1.25rem] border border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer hover:border-[#4F46E5]/30 hover:shadow-md transition-all relative overflow-hidden"
      >
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#10B981]" />

        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h4 className="text-[17px] font-bold text-[#1A1A3D]">{mission.title}</h4>
            <Badge variant="outline" className="border-slate-200 text-slate-500 font-bold bg-slate-50">
              {mission.zoneName || mission.zoneId}
            </Badge>
          </div>

          <div className="flex items-center gap-6 text-[13px] text-slate-400 font-medium">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> {formatDate(mission.completedAt || mission.updatedAt || mission.createdAt)}
            </div>
            <span>·</span>
            <div>Duration: {mission.estimatedDurationMinutes} min</div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Badge className={cn("border-none px-3 py-1 rounded-full text-[11px] font-bold", needTypeColor(mission.needType))}>
              {mission.needType}
            </Badge>
            <Badge className="border-none px-3 py-1 rounded-full text-[11px] font-bold bg-[#9AF7C9] text-[#1B4D3E]">
              Successful
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-12">
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Families Helped</p>
            <span className="text-[18px] font-black text-[#10B981]">{mission.familiesHelped || 0}</span>
          </div>
          <div
            className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-[#4F46E5] group-hover:bg-indigo-50 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
};

const DeclinedMissionCard = ({ mission, onOpen }: { mission: CoordinatorMission; onOpen: () => void }) => {
  return (
    <div className="bg-white rounded-[1.25rem] border border-slate-100 p-6 flex items-center justify-between opacity-70 grayscale-[0.5]">
      <div className="space-y-3">
        <h4 className="text-[17px] font-bold text-slate-500">{mission.title}</h4>
        <div className="flex items-center gap-4 flex-wrap">
          <Badge className="bg-slate-100 text-slate-400 border-none font-bold uppercase tracking-widest text-[10px]">
            {mission.status === "failed" ? "Failed" : "Cancelled"}
          </Badge>
          <span className="text-xs text-slate-400 font-medium">{formatDate(mission.updatedAt || mission.createdAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="border-slate-100 text-slate-300">
          Declined Mission
        </Badge>
        <div
          className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 hover:text-[#4F46E5] hover:bg-indigo-50 transition-all cursor-pointer"
          onClick={onOpen}
        >
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

const EmptyMissionState = ({ title, description }: { title: string; description: string }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
    <div className="w-24 h-24 bg-[#F8F7FF] rounded-full flex items-center justify-center">
      <Clock className="w-10 h-10 text-[#C7D2FE]" />
    </div>
    <div className="space-y-2">
      <h3 className="text-xl font-bold text-[#1A1A3D]">{title}</h3>
      <p className="text-slate-400 font-medium">{description}</p>
    </div>
  </div>
);

const InfoTile = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className={cn("text-[13px] font-bold", highlight ? "text-[#4F46E5]" : "text-[#1A1A3D]")}>{value}</p>
  </div>
);

export default VolunteerMissions;