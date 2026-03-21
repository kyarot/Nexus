import React, { useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  MapPin, 
  Mic, 
  FileText, 
  Navigation, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  X,
  Plus,
  ArrowRight,
  ChevronDown,
  Layout
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetClose
} from "@/components/ui/sheet";

const VolunteerMissions = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [subTab, setSubTab] = useState("upcoming");
  const [selectedMission, setSelectedMission] = useState<any>(null);
  const [activeDetailTab, setActiveDetailTab] = useState("overview");
  const [expandedMissionId, setExpandedMissionId] = useState<number | null>(null);

  const stats = [
    { label: "Total Missions", value: "28", color: "border-[#4F46E5]" },
    { label: "Success Rate", value: "89%", color: "border-[#10B981]" },
    { label: "Total Hours", value: "64h", color: "border-[#F59E0B]" },
    { label: "Impact Points", value: "340", color: "border-[#7C3AED]" },
  ];

  const upcomingMissions: any[] = []; // Empty state demo

  const completedMissions = [
    {
      id: 1,
      name: "Community Center Maintenance",
      zone: "Zone 4",
      date: "March 14, 2026",
      duration: "1h 20min",
      type: "Education",
      typeColor: "bg-[#EFF6FF] text-[#1E40AF]",
      status: "Successful",
      statusColor: "bg-[#9AF7C9] text-[#1B4D3E]",
      impact: "+12",
      outcome: "success"
    },
    {
      id: 2,
      name: "Emergency Response — Flood Relief",
      zone: "Sector 7",
      date: "March 10, 2026",
      duration: "3h 45min",
      type: "Logistics",
      typeColor: "bg-[#FDF2E9] text-[#93522E]",
      status: "Successful",
      statusColor: "bg-[#9AF7C9] text-[#1B4D3E]",
      impact: "+25",
      outcome: "success"
    }
  ];

  const declinedMissions = [
    {
      id: 3,
      name: "Night Patrol - Sector 7",
      zone: "Sector 7",
      date: "March 05, 2026",
      reason: "Unavailable",
      type: "Security",
      typeColor: "bg-[#F3F4F6] text-[#374151]",
      outcome: "incomplete"
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7FF] font-['Plus_Jakarta_Sans']">
      <DashboardTopBar breadcrumb="My Missions" />
      
      <div className="flex-1 p-8 space-y-8 max-w-[1400px]">
        {/* PAGE HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-[32px] font-bold text-[#1A1A3D]">My Missions</h1>
            <p className="text-[#64748B] font-medium text-base">Track your active and past community missions</p>
          </div>
          
          <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-full border border-slate-200">
            {["All", "Active", "Completed", "Declined"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase())}
                className={cn(
                  "px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all",
                  activeTab === tab.toLowerCase() 
                    ? "bg-[#4F46E5] text-white shadow-md" 
                    : "text-[#64748B] hover:text-[#4F46E5] bg-transparent"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* ACTIVE MISSION CARD */}
        {(activeTab === "all" || activeTab === "active") && (
          <div className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-[2rem] p-8 text-white shadow-[0_20px_50px_rgba(79,70,229,0.2)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white opacity-[0.03] rounded-full -mr-40 -mt-40 transition-transform group-hover:scale-110 duration-700" />
            
            <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8">
              <div className="flex-1 space-y-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">ACTIVE MISSION</span>
                </div>
                
                <h2 className="text-[28px] font-bold leading-tight">Hebbal North — Food Distribution</h2>
                
                <div className="flex flex-wrap gap-3">
                  {["Zone 4", "2.1 km away", "Est. 45 min"].map((chip, i) => (
                    <div key={i} className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-xl text-xs font-bold border border-white/10">
                      {chip}
                    </div>
                  ))}
                </div>

                <div className="max-w-md space-y-3">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-bold opacity-80">In Progress</span>
                    <span className="text-xs font-black uppercase tracking-widest">65% Complete</span>
                  </div>
                  <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white w-[65%] rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                  </div>
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
                <p className="text-sm opacity-60 font-medium italic">
                  Started 23 min ago · Dispatched by Sarah K.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STATS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <div key={i} className={cn(
              "bg-white rounded-[1.25rem] p-6 shadow-sm border-l-4 border-slate-100",
              s.color
            )}>
              <span className="text-[11px] font-black text-[#64748B] uppercase tracking-widest mb-2 block">{s.label}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-bold text-[#1A1A3D]">{s.value}</span>
              </div>
              <div className="mt-2 text-[10px] font-bold text-[#10B981] flex items-center gap-1">
                <Plus className="w-2.5 h-2.5" /> 8% from last month
              </div>
            </div>
          ))}
        </div>

        {/* TABS SECTION */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 min-h-[500px]">
          <div className="flex items-center gap-8 mb-8 border-b border-slate-100">
            {[
              { id: "upcoming", label: "Upcoming", count: 0 },
              { id: "completed", label: "Completed", count: 28 },
              { id: "declined", label: "Declined", count: 4 }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={cn(
                  "pb-4 px-2 text-sm font-bold relative transition-colors",
                  subTab === tab.id ? "text-[#4F46E5]" : "text-slate-400 hover:text-slate-600"
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
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <div className="w-24 h-24 bg-[#F8F7FF] rounded-full flex items-center justify-center">
                  <Clock className="w-10 h-10 text-[#C7D2FE]" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-[#1A1A3D]">No upcoming missions</h3>
                  <p className="text-slate-400 font-medium">You haven't accepted any new missions yet.</p>
                </div>
                <Button className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold px-8 py-6 rounded-2xl flex gap-2">
                  Browse available missions <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {subTab === "completed" && (
              <div className="space-y-4">
                {completedMissions.map((mission) => (
                  <div key={mission.id} className="group">
                    <div 
                      onClick={() => setExpandedMissionId(expandedMissionId === mission.id ? null : mission.id)}
                      className="bg-white rounded-[1.25rem] border border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer hover:border-[#4F46E5]/30 hover:shadow-md transition-all relative overflow-hidden"
                    >
                      <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1.5",
                        mission.outcome === "success" ? "bg-[#10B981]" : "bg-[#F43F5E]"
                      )} />
                      
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                          <h4 className="text-[17px] font-bold text-[#1A1A3D]">{mission.name}</h4>
                          <Badge variant="outline" className="border-slate-200 text-slate-500 font-bold bg-slate-50">{mission.zone}</Badge>
                        </div>
                        
                        <div className="flex items-center gap-6 text-[13px] text-slate-400 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" /> {mission.date}
                          </div>
                          <span>·</span>
                          <div>Duration: {mission.duration}</div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Badge className={cn("border-none px-3 py-1 rounded-full text-[11px] font-bold", mission.typeColor)}>
                            {mission.type}
                          </Badge>
                          <Badge className={cn("border-none px-3 py-1 rounded-full text-[11px] font-bold", mission.statusColor)}>
                            {mission.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-12">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">IMPACT</p>
                          <span className="text-[18px] font-black text-[#10B981]">{mission.impact} pts</span>
                        </div>
                        <div 
                          className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-[#4F46E5] group-hover:bg-indigo-50 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMission(mission);
                          }}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    {expandedMissionId === mission.id && (
                      <div className="mt-2 ml-4 p-8 bg-[#FBFBFF] rounded-[1.25rem] border border-indigo-50 space-y-8 animate-in slide-in-from-top-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">FIELD NOTES</p>
                            <div className="p-4 bg-white rounded-xl border border-slate-100 text-xs font-medium text-slate-600 leading-relaxed italic">
                              "Successfully delivered 45 meal kits to the primary school. The coordination with sector 4 was smooth. Minimal traffic delay."
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">RECIPIENTS</p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-bold text-[#1A1A3D]">12</span>
                              <span className="text-xs font-bold text-slate-400">Families Helped</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">NEED SCORE</p>
                            <div className="flex items-center gap-3">
                              <span className="text-red-400 font-bold">8.2</span>
                              <ArrowRight className="w-4 h-4 text-slate-300" />
                              <span className="text-green-500 font-bold">4.1</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">COORDINATOR FEEDBACK</p>
                            <div className="flex items-start gap-2">
                              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-[#4F46E5]">S</div>
                              <p className="text-[11px] font-medium text-slate-500">"Excellent time management and log updates. Keep it up, Priya!"</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button className="text-[12px] font-bold text-[#4F46E5] hover:underline flex gap-1 items-center">
                            View Full Report <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {subTab === "declined" && (
              <div className="space-y-4">
                {declinedMissions.map((mission) => (
                  <div key={mission.id} className="bg-white rounded-[1.25rem] border border-slate-100 p-6 flex items-center justify-between opacity-70 grayscale-[0.5]">
                    <div className="space-y-3">
                       <h4 className="text-[17px] font-bold text-slate-500">{mission.name}</h4>
                       <div className="flex items-center gap-4">
                         <Badge className="bg-slate-100 text-slate-400 border-none font-bold uppercase tracking-widest text-[10px]">{mission.reason}</Badge>
                         <span className="text-xs text-slate-400 font-medium">{mission.date}</span>
                       </div>
                    </div>
                    <Badge variant="outline" className="border-slate-100 text-slate-300">Declined Mission</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MISSION DETAIL SLIDE-OVER */}
      <Sheet open={!!selectedMission} onOpenChange={(open) => {
        if (!open) {
          setSelectedMission(null);
          setActiveDetailTab("overview");
        }
      }}>
        <SheetContent className="sm:max-w-[400px] p-0 flex flex-col bg-white border-l border-slate-100 font-['Plus_Jakarta_Sans']">
          {selectedMission && (
            <div className="flex flex-col h-full">
              {/* Header with Background Map */}
              <div className="h-[180px] bg-[#E0E7FF] relative overflow-hidden shrink-0">
                <div className="absolute inset-0 opacity-40 bg-[url('https://www.google.com/maps/vt/pb=!1m5!1m4!1i12!2i2365!2i1575!4i256!2m3!1e0!2sm!3i625206676!3m17!2sen!3sUS!5e18!12m4!1e68!2m2!1sset!2sRoadmap!12m3!1e37!2m1!1ssmartmaps!12m4!1e26!2m2!1s1i1!2s1!4e0!5m4!1e0!8m2!1i1100!2i1100!6m6!1e12!2i2!26b1!39b1!44e1!50e0!23i1301813')] bg-cover" />
                <div className="absolute top-4 right-4 z-20">
                  <SheetClose className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-md shadow-sm flex items-center justify-center text-[#1A1A3D] hover:bg-white transition-all border-none focus-visible:ring-0">
                    <X className="w-4 h-4" />
                  </SheetClose>
                </div>
                <div className="absolute bottom-4 left-6">
                  <Badge className={cn("border-none px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm", selectedMission.statusColor)}>
                    {selectedMission.status}
                  </Badge>
                </div>
              </div>

              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                <div>
                  <h2 className="text-[22px] font-bold text-[#1A1A3D] leading-tight mb-4">{selectedMission.name}</h2>
                  
                  {/* Internal Tabs */}
                  <div className="flex border-b border-slate-100 mb-6">
                    {["Overview", "Empathy Brief", "Field Notes", "Outcome"].map((t) => (
                      <button 
                        key={t} 
                        onClick={() => setActiveDetailTab(t.toLowerCase().replace(" ", ""))}
                        className={cn(
                          "flex-1 pb-3 text-[10px] font-black uppercase tracking-widest transition-all relative",
                          activeDetailTab === t.toLowerCase().replace(" ", "") ? "text-[#4F46E5]" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        {t}
                        {activeDetailTab === t.toLowerCase().replace(" ", "") && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4F46E5] rounded-t-full" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {activeDetailTab === "overview" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dispatched By</p>
                          <p className="text-[13px] font-bold text-[#1A1A3D]">Sarah Kapur</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Type</p>
                          <p className="text-[13px] font-bold text-[#4F46E5]">{selectedMission.type}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Distance</p>
                          <p className="text-[13px] font-bold text-[#1A1A3D]">4.2 km</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Duration</p>
                          <p className="text-[13px] font-bold text-[#1A1A3D]">{selectedMission.duration}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ZONE COVERAGE</p>
                        <div className="h-[120px] bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden relative">
                           <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/light-v10/static/77.5946,12.9716,12/400x120@2x?access_token=pk.xxx')] bg-cover opacity-60" />
                           <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-8 h-8 bg-[#4F46E5]/20 rounded-full flex items-center justify-center">
                                 <div className="w-2 h-2 bg-[#4F46E5] rounded-full" />
                              </div>
                           </div>
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
                          "Recipients in this area have shown increased anxiety due to the recent delays. Approach with calm, reassuring tone. Prioritize listening over immediate action."
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
                               <h4 className="text-[13px] font-bold text-[#1A1A3D]">Final Handover</h4>
                               <span className="text-[10px] text-slate-400 font-bold">15:30 PM</span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-medium text-slate-600 italic">
                               "Completed the last distribution set. All families accounted for. Handed over remaining logs to the local lead."
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-4 group">
                          <div className="flex flex-col items-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#4F46E5] mt-1.5" />
                            <div className="w-px flex-1 bg-slate-100 my-2" />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-baseline mb-2">
                               <h4 className="text-[13px] font-bold text-[#1A1A3D]">Mid-Mission Check</h4>
                               <span className="text-[10px] text-slate-400 font-bold">14:45 PM</span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-medium text-slate-600 italic">
                               "20 kits distributed. Atmosphere is positive. No issues with supply chain."
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
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-4">Score Transition</p>
                        <div className="flex items-center justify-between mb-6">
                           <div className="text-center">
                              <span className="text-2xl font-black block">8.2</span>
                              <span className="text-[10px] font-bold opacity-40 uppercase">Initial</span>
                           </div>
                           <ArrowRight className="w-6 h-6 opacity-20" />
                           <div className="text-center">
                              <span className="text-2xl font-black text-[#10B981] block">4.1</span>
                              <span className="text-[10px] font-bold opacity-40 uppercase">Final</span>
                           </div>
                        </div>
                        <div className="space-y-1">
                           <div className="flex justify-between text-[11px] font-bold mb-1">
                              <span>Impact Target</span>
                              <span>92%</span>
                           </div>
                           <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-[#10B981] w-[92%] rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                           </div>
                        </div>
                      </div>

                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">COORDINATOR RATING</p>
                        <div className="flex gap-1.5">
                           {[1, 2, 3, 4, 5].map(star => (
                              <div key={star} className={cn("w-3 h-3 rounded-full", star <= 5 ? "bg-[#F59E0B]" : "bg-slate-200")} />
                           ))}
                        </div>
                        <p className="text-xs font-medium text-slate-500 italic leading-relaxed">
                           "Excellent responsiveness to the empathy brief. Priya handled the initial tension with great maturity."
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

export default VolunteerMissions;