import React, { useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Bell, 
  Plus, 
  MapPin, 
  Users, 
  CheckCircle2, 
  Clock, 
  X, 
  ArrowRight, 
  ChevronRight, 
  Eye, 
  MessageSquare, 
  Repeat, 
  MoreHorizontal,
  Sparkles,
  Map as MapIcon,
  Filter,
  AlertCircle,
  TrendingDown,
  Navigation,
  Mic,
  Star,
  FileText,
  Send,
  AlertTriangle,
  Box,
  Utensils,
  Activity,
  Truck,
  Wind,
  Shield,
  ChevronUp,
  ChevronDown,
  GitMerge
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetClose
} from "@/components/ui/sheet";

const CoordinatorMissions = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [showCreateMission, setShowCreateMission] = useState(false);
  const [creationStep, setCreationStep] = useState(1);
  const [selectedVolunteerForMission, setSelectedVolunteerForMission] = useState<any>(null);
  const [selectedMission, setSelectedMission] = useState<any>(null);
  const [isScoringExpanded, setIsScoringExpanded] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("Overview");

  const stats = [
    { label: "Active Missions", value: "12", delta: "3 dispatched today", color: "border-[#4F46E5]", icon: "bg-[#10B981]" },
    { label: "Pending Dispatch", value: "08", delta: "Needs assignment", color: "border-[#F59E0B]" },
    { label: "Completed Week", value: "24", delta: "92% Success rate", color: "border-[#10B981]" },
    { label: "On Ground", value: "18", delta: "Across 6 zones", color: "border-[#7C3AED]" },
  ];

  const activeMissions = [
    {
      id: "M-047",
      title: "Hebbal North — Food Distribution",
      status: "In Progress",
      zone: "Zone 4 · Hebbal",
      type: "Food Distribution",
      priority: "Critical",
      volunteer: { name: "Ravi K.", match: "97%", dist: "2.1 km away", initial: "RK" },
      progress: 65,
      statusText: "Volunteer en route",
      dispatched: "10:23 AM",
      est: "11:45 AM",
      borderColor: "border-[#10B981]",
      mergedFrom: { reports: 8, ngos: 4 },
      newUpdates: 3
    },
    {
      id: "M-051",
      title: "Yelahanka Central — First Aid Support",
      status: "Awaiting Dispatch",
      zone: "Zone 2 · Yelahanka",
      type: "Health Support",
      priority: "High",
      pending: true,
      borderColor: "border-[#F59E0B]",
      mergedFrom: null
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7FF] font-['Plus_Jakarta_Sans']">
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <DashboardTopBar breadcrumb="Operations / Missions" />
          
          <div className="p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-1">
                <h1 className="text-[32px] font-bold text-[#1A1A3D]">Missions</h1>
                <p className="text-[#64748B] font-medium text-base">Create, monitor, and close all field missions across your zones</p>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input placeholder="Search missions..." className="pl-10 h-11 bg-white border-slate-200 rounded-xl" />
                </div>
                <div className="relative w-11 h-11 bg-white rounded-xl border border-slate-200 flex items-center justify-center cursor-pointer">
                  <Bell className="w-5 h-5 text-slate-600" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">3</span>
                </div>
                <Button 
                  onClick={() => setShowCreateMission(true)}
                  className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] hover:opacity-90 text-white font-bold h-11 px-6 rounded-xl flex gap-2"
                >
                  <Plus className="w-4 h-4" /> Create Mission
                </Button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-3">
              {["All (47)", "Active (12)", "Pending (8)", "Completed (24)", "Failed (3)"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab.split(' ')[0].toLowerCase())}
                  className={cn(
                    "px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all border",
                    activeTab === tab.split(' ')[0].toLowerCase() 
                      ? "bg-[#4F46E5] text-white border-[#4F46E5] shadow-md" 
                      : "bg-transparent text-[#64748B] border-slate-200 hover:border-slate-300"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((s, i) => (
                <div key={i} className={cn(
                  "bg-white rounded-[1.25rem] p-6 shadow-[0_4px_24px_rgba(79,70,229,0.04)] border-l-[3px] border-slate-100 flex flex-col justify-between h-32",
                  s.color
                )}>
                  <div className="flex items-center gap-2">
                    {s.icon && <div className={cn("w-2 h-2 rounded-full animate-pulse", s.icon)} />}
                    <span className="text-[11px] font-black text-[#64748B] uppercase tracking-widest">{s.label}</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-[28px] font-bold text-[#1A1A3D]">{s.value}</span>
                    <span className="text-[10px] font-bold text-[#64748B] opacity-60 uppercase">{s.delta}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Content Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Active Missions List */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                   <h3 className="text-lg font-bold text-[#1A1A3D]">Recent Activity <span className="text-slate-300 ml-2 font-medium text-sm">• Updated 2m ago</span></h3>
                </div>

                {activeMissions.map((mission) => (
                  <div key={mission.id} className={cn(
                    "bg-white rounded-[1.25rem] border-l-[3px] border border-slate-100 shadow-[0_4px_24px_rgba(79,70,229,0.06)] p-6 space-y-6 transition-all hover:shadow-lg",
                    mission.borderColor
                  )}>
                    {/* Top Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="bg-slate-50 text-slate-500 border-none font-mono text-[11px] px-2 py-0.5">{mission.id}</Badge>
                        <h4 className="text-lg font-bold text-[#1A1A3D]">{mission.title}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                         <Badge className={cn("rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-wider", 
                           mission.pending ? "bg-[#FFF7ED] text-[#9A3412]" : "bg-[#F0FDF4] text-[#166534]")}>
                           <div className={cn("w-1.5 h-1.5 rounded-full mr-1.5 inline-block", mission.pending ? "bg-amber-500" : "bg-green-500 animate-pulse")} />
                           {mission.status}
                         </Badge>
                         <Badge className="bg-[#FEF2F2] text-[#991B1B] border-none font-bold text-[10px] uppercase tracking-wider">{mission.priority}</Badge>
                      </div>
                    </div>

                    {/* Meta Row */}
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-indigo-50 text-[#4F46E5] border-none font-bold text-[11px] px-3 py-1 rounded-full">
                        {mission.zone}
                      </Badge>
                      <Badge className="bg-[#FFF7ED] text-[#9A3412] border-none font-bold text-[11px] px-3 py-1 rounded-full">
                        {mission.type}
                      </Badge>
                    </div>

                    {/* MERGED REPORTS INDICATOR */}
                    {mission.mergedFrom && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 bg-[#EEF2FF] text-[#3730A3] px-3 py-1.5 rounded-full w-fit">
                          <GitMerge className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-bold">Merged from {mission.mergedFrom.reports} reports · {mission.mergedFrom.ngos} NGOs</span>
                        </div>
                        {mission.newUpdates > 0 && (
                          <div className="flex items-center justify-between bg-[#FFF7ED] text-[#92400E] px-3 py-1.5 rounded-full border border-amber-100">
                            <span className="text-[11px] font-bold">{mission.newUpdates} new reports added while mission is active</span>
                            <button className="text-[11px] font-black underline hover:opacity-80">View updates →</button>
                          </div>
                        )}
                      </div>
                    )}

                    {mission.pending ? (
                      <div className="space-y-4 pt-2">
                        <div className="p-4 bg-[#FFFBEB] rounded-xl border border-[#FEF3C7] flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <AlertCircle className="w-5 h-5 text-amber-500" />
                              <span className="text-sm font-bold text-[#92400E]">No volunteer assigned yet</span>
                           </div>
                           <div className="flex items-center gap-2 bg-white/60 px-3 py-1.5 rounded-lg text-[10px] font-black text-[#4F46E5] uppercase tracking-widest border border-indigo-100">
                             <Sparkles className="w-3 h-3" /> Best match: Priya R. — 97%
                           </div>
                        </div>
                        <div className="flex gap-4">
                          <Button className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white font-bold rounded-xl px-6">Auto-Assign Best Match →</Button>
                          <Button variant="ghost" className="text-slate-500 font-bold hover:bg-slate-50">Manually Select Volunteer</Button>
                          <div className="flex-1" />
                          <Button variant="ghost" className="text-slate-400 font-bold">Edit Details</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Volunteer Info */}
                        <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-[#4F46E5] font-black text-xs border-2 border-white shadow-sm overflow-hidden">
                               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mission.volunteer.name}`} alt="av" />
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ASSIGNED VOLUNTEER</p>
                               <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-[#1A1A3D]">{mission.volunteer.name} <span className="text-[#10B981] ml-1">97% Match</span></span>
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                               </div>
                               <span className="text-[11px] font-medium text-slate-400">{mission.volunteer.dist} · On Route</span>
                            </div>
                          </div>
                          
                          <div className="flex-1 max-w-xs mx-12">
                             <div className="flex justify-between items-end mb-2">
                                <span className="text-[10px] font-black text-[#4F46E5] uppercase tracking-widest">DISPATCH PROGRESS</span>
                                <span className="text-[10px] font-black text-[#4F46E5] uppercase tracking-widest">VOLUNTEER EN ROUTE</span>
                             </div>
                             <div className="h-2 w-full bg-indigo-100 rounded-full overflow-hidden">
                                <div className="h-full bg-[#4F46E5] rounded-full" style={{ width: `${mission.progress}%` }} />
                             </div>
                          </div>

                          <div className="flex gap-2">
                             <Button variant="ghost" className="h-10 w-10 p-0 rounded-xl hover:bg-white hover:shadow-sm text-slate-400 hover:text-[#4F46E5]"><MessageSquare className="w-4 h-4" /></Button>
                             <Button variant="ghost" className="h-10 w-10 p-0 rounded-xl hover:bg-white hover:shadow-sm text-slate-400 hover:text-[#4F46E5]"><Repeat className="w-4 h-4" /></Button>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                          <div className="flex items-center gap-4 font-medium text-[13px] text-slate-400">
                             <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Dispatched: {mission.dispatched}</span>
                             <span className="flex items-center gap-1.5"><Navigation className="w-3.5 h-3.5" /> Est. Completion: {mission.est}</span>
                          </div>
                          <div className="flex gap-4">
                            <Button 
                              onClick={() => setSelectedMission(mission)}
                              variant="ghost" 
                              className="text-[#4F46E5] font-bold flex gap-2 hover:bg-indigo-50"
                            >
                              <Eye className="w-4 h-4" /> View Live
                            </Button>
                            <Button variant="outline" className="border-red-100 text-red-500 hover:bg-red-50 font-bold px-6">Close Mission</Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Footer simple list */}
                <div className="pt-8 space-y-4">
                   <div className="flex items-center justify-between p-4 bg-white/50 rounded-xl border border-slate-100 text-xs font-bold text-slate-400 group cursor-pointer hover:bg-white hover:shadow-sm transition-all">
                      <div className="flex items-center gap-4">
                         <CheckCircle2 className="w-4 h-4 text-green-500" />
                         <span className="text-[#1A1A3D]">Jalahalli West — Sanitation Kit</span>
                         <span>ZONE 3</span>
                         <span>VOL: ARUN M.</span>
                      </div>
                      <div className="flex items-center gap-6">
                         <Badge className="bg-[#DCFCE7] text-[#166534] border-none uppercase text-[10px] tracking-widest font-black">SUCCESSFUL</Badge>
                         <span className="opacity-60">Oct 24, 14:20</span>
                         <ChevronRight className="w-4 h-4 opacity-40 group-hover:translate-x-1 transition-transform" />
                      </div>
                   </div>
                </div>
              </div>

              {/* Right Stats Panel */}
              <div className="space-y-8">
                {/* Live Mission Map */}
                <div className="bg-white rounded-[2rem] p-6 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100">
                   <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest">LIVE MISSION MAP</h3>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                   </div>
                   <div className="aspect-square bg-[#E0E7FF] rounded-2xl relative overflow-hidden group mb-4">
                      <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/light-v10/static/77.5946,12.9716,12/400x400@2x?access_token=pk.xxx')] bg-cover opacity-60" />
                      <div className="absolute inset-0 flex items-center justify-center">
                         {/* Pins */}
                         <div className="absolute top-1/4 left-1/3 w-3 h-3 bg-[#4F46E5] rounded-full border-2 border-white shadow-lg animate-bounce" />
                         <div className="absolute bottom-1/3 right-1/4 w-3 h-3 bg-amber-500 rounded-full border-2 border-white shadow-lg" />
                         <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                         </div>
                      </div>
                      <button className="absolute bottom-3 right-3 w-8 h-8 bg-white/90 backdrop-blur rounded-lg shadow-sm flex items-center justify-center text-slate-400 hover:text-[#4F46E5]">
                        <Plus className="w-4 h-4" />
                      </button>
                   </div>
                   <button className="text-xs font-bold text-[#4F46E5] hover:underline flex items-center gap-1 w-full justify-center">
                      View full map <ChevronRight className="w-3 h-3" />
                   </button>
                </div>

                {/* Status Breakdown */}
                <div className="bg-white rounded-[2rem] p-6 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100">
                   <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest mb-8">STATUS BREAKDOWN</h3>
                   <div className="flex items-center justify-between mb-8">
                      <div className="relative w-24 h-24">
                         <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F1F5F9" strokeWidth="12" />
                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#4F46E5" strokeWidth="12" strokeDasharray="251.2" strokeDashoffset="125.6" strokeLinecap="round" />
                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F59E0B" strokeWidth="12" strokeDasharray="251.2" strokeDashoffset="200.6" strokeLinecap="round" />
                         </svg>
                         <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-[20px] font-black text-[#1A1A3D] leading-none">47</span>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">TOTAL</span>
                         </div>
                      </div>
                      <div className="space-y-3">
                         {[
                           { label: "Active", val: 12, color: "bg-[#4F46E5]" },
                           { label: "Pending", val: "08", color: "bg-amber-500" },
                           { label: "Done", val: 24, color: "bg-[#10B981]" },
                           { label: "Failed", val: "03", color: "bg-red-500" },
                         ].map(l => (
                           <div key={l.label} className="flex items-center gap-4">
                              <div className="flex items-center gap-2 min-w-[70px]">
                                 <div className={cn("w-2 h-2 rounded-full", l.color)} />
                                 <span className="text-[11px] font-bold text-slate-500">{l.label}</span>
                              </div>
                              <span className="text-xs font-black text-[#1A1A3D]">{l.val}</span>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>

                {/* Zone Density */}
                <div className="bg-white rounded-[2rem] p-6 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100">
                   <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest mb-6">ZONE DENSITY</h3>
                   <div className="space-y-5">
                      {[
                        { name: "Hebbal", val: 8, pct: 100 },
                        { name: "Yelahanka", val: 4, pct: 50 },
                        { name: "Jalahalli", val: 3, pct: 35 },
                        { name: "Thanisandra", val: 2, pct: 25 },
                      ].map(z => (
                        <div key={z.name} className="space-y-1.5">
                           <div className="flex justify-between text-[11px] font-bold">
                              <span className="text-slate-600 font-black">{z.name}</span>
                              <span className="text-[#1A1A3D]">{z.val}</span>
                           </div>
                           <div className="h-1.5 w-full bg-slate-50 rounded-full">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${z.pct}%` }} />
                           </div>
                        </div>
                      ))}
                   </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-3">
                   <Button className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold py-6 rounded-2xl flex justify-between items-center group">
                      <div className="flex items-center gap-3">
                         <Repeat className="w-4 h-4" /> Auto-assign all pending
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                   </Button>
                   <Button variant="ghost" className="w-full bg-white border border-slate-100 text-slate-500 font-bold py-6 rounded-2xl flex justify-between items-center group hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                         <FileText className="w-4 h-4" /> Export Weekly Report
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-40 group-hover:translate-x-1 transition-all" />
                   </Button>
                   <Button variant="ghost" className="w-full bg-[#1E1B4B] text-white font-bold py-6 rounded-2xl flex justify-between items-center group hover:bg-[#1A1A3D]">
                      <div className="flex items-center gap-3">
                         <Send className="w-4 h-4" /> Send Field Broadcast
                      </div>
                      <Send className="w-4 h-4 opacity-40 -translate-y-1 translate-x-1 scale-75" />
                   </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MISSION DETAIL SLIDE-OVER */}
        <Sheet open={!!selectedMission} onOpenChange={() => setSelectedMission(null)}>
          <SheetContent className="sm:max-w-xl p-0 flex flex-col bg-white border-l border-slate-100 font-['Plus_Jakarta_Sans']">
            {selectedMission && (
              <div className="flex flex-col h-full overflow-hidden">
                <SheetHeader className="p-8 border-b border-slate-50 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400 font-mono tracking-tighter">{selectedMission.id}</span>
                        <Badge className={cn("rounded-full px-2 py-0.5 font-bold text-[9px] uppercase tracking-wider", 
                          selectedMission.pending ? "bg-[#FFF7ED] text-[#9A3412]" : "bg-[#F0FDF4] text-[#166534]")}>
                          {selectedMission.status}
                        </Badge>
                      </div>
                      <SheetTitle className="text-2xl font-bold text-[#1A1A3D]">{selectedMission.title}</SheetTitle>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="ghost" className="w-10 h-10 p-0 rounded-xl hover:bg-slate-50"><MoreHorizontal className="w-5 h-5" /></Button>
                       <SheetClose className="w-10 h-10 p-0 rounded-xl bg-slate-100/50 flex items-center justify-center text-slate-400 hover:text-slate-600 focus:outline-none">
                          <X className="w-5 h-5" />
                       </SheetClose>
                    </div>
                  </div>
                </SheetHeader>

                <div className="flex px-8 border-b border-slate-50 overflow-x-auto scrollbar-none">
                  {["Overview", "Source Reports", "Live Updates", "Volunteer", "Outcome", "History"].map((tab) => (
                    <button 
                      key={tab} 
                      onClick={() => setDetailTab(tab)}
                      className={cn(
                        "py-4 px-4 text-[10px] font-black uppercase tracking-widest relative transition-all whitespace-nowrap",
                        detailTab === tab ? "text-[#4F46E5]" : "text-slate-400"
                      )}
                    >
                      {tab}
                      {detailTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4F46E5] rounded-t-full" />}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto">
                   <div className="p-8 space-y-8 pb-24">
                      {detailTab === "Overview" && (
                        <>
                          {/* Map Section */}
                          <div className="h-[240px] bg-[#E0E7FF] rounded-3xl relative overflow-hidden shadow-inner border border-slate-100">
                            <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/light-v10/static/77.5946,12.9716,14/600x240@2x?access_token=pk.xxx')] bg-cover opacity-60" />
                            <div className="absolute inset-0 flex items-center justify-center">
                               <div className="w-10 h-10 bg-[#4F46E5]/20 rounded-full flex items-center justify-center">
                                  <div className="w-4 h-4 bg-[#4F46E5] rounded-full border-2 border-white shadow-lg animate-ping absolute" />
                                  <div className="w-3 h-3 bg-[#4F46E5] rounded-full border-2 border-white shadow-lg relative" />
                               </div>
                            </div>
                            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white shadow-sm">
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">CURRENT LOCATION</p>
                               <p className="text-[13px] font-bold text-[#1A1A3D]">450m from target · Hebbal Main</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-6">
                               <div className="space-y-4">
                                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">MISSION DETAILS</h4>
                                  <div className="space-y-4">
                                     <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Need Type</p>
                                        <Badge className="bg-[#FFF7ED] text-[#9A3412] border-none font-bold text-[11px]">Food Distribution</Badge>
                                     </div>
                                     <div className="grid grid-cols-2 gap-4">
                                        <div>
                                           <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Dispatched</p>
                                           <p className="text-sm font-bold text-[#1A1A3D]">10:23 AM</p>
                                        </div>
                                        <div>
                                           <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Est. Finish</p>
                                           <p className="text-sm font-bold text-[#1A1A3D]">11:45 AM</p>
                                        </div>
                                     </div>
                                  </div>
                               </div>
                            </div>

                            <div className="space-y-6">
                               <div className="space-y-4">
                                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">ASSIGNED VOLUNTEER</h4>
                                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                                     <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-[#4F46E5] font-black text-xs border-2 border-white shadow-sm overflow-hidden">
                                         <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ravi" alt="av" />
                                     </div>
                                     <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-bold text-[#1A1A3D] truncate">Ravi K.</p>
                                        <p className="text-[11px] font-medium text-slate-400">97% Match · 4.8★</p>
                                     </div>
                                     <Button variant="outline" className="h-8 w-8 p-0 rounded-lg border-slate-200 text-[#4F46E5] hover:bg-white"><MessageSquare className="w-3.5 h-3.5" /></Button>
                                  </div>
                               </div>
                            </div>
                          </div>

                          {/* Timeline Preview */}
                          <div className="space-y-6">
                             <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">RECENT LOGS</h4>
                             <div className="space-y-6">
                                <div className="flex gap-4 group">
                                   <div className="flex flex-col items-center">
                                      <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] mt-1.5 ring-4 ring-green-50 animate-pulse" />
                                      <div className="w-px flex-1 bg-slate-100 my-2" />
                                   </div>
                                   <div className="flex-1">
                                      <div className="flex justify-between items-baseline mb-2">
                                         <h4 className="text-sm font-black text-[#1A1A3D]">Status: On Ground</h4>
                                         <span className="text-[10px] text-slate-400 font-bold uppercase">10:45 AM</span>
                                      </div>
                                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[13px] font-medium text-slate-600 italic">
                                         "Arrived at the location. The families are gathered near the community center. Starting distribution kits now."
                                      </div>
                                   </div>
                                </div>
                             </div>
                          </div>
                        </>
                      )}

                      {detailTab === "Source Reports" && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                          <div className="flex items-center justify-between">
                            <p className="text-[13px] text-slate-500 font-medium">All reports that contributed to this mission</p>
                            <Badge className="bg-[#EEF2FF] text-[#3730A3] border-none font-bold text-[11px] px-3 py-1 rounded-full">
                              8 reports · 4 NGOs
                            </Badge>
                          </div>

                          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                            {[
                               { id: "R-0234", category: "bg-red-400", worker: "Anjali S.", ngo: "CareNet", need: "Food insecurity · Critical · 24 families", time: "2 hours ago", type: "Digital", cond: 94 },
                               { id: "R-0238", category: "bg-[#4F46E5]", worker: "Ravi K.", ngo: "Nexus Local", need: "Food shortage · High · 12 families", time: "3 hours ago", type: "Voice", cond: 91 },
                               { id: "R-0241", category: "bg-amber-400", worker: "Suresh P.", ngo: "Helping Hands", need: "Water scarcity · Medium · 40 families", time: "4 hours ago", type: "Paper scan", cond: 78 },
                               { id: "R-0245", category: "bg-red-400", worker: "Meera J.", ngo: "CareNet", need: "Food emergency · Critical · 8 families", time: "5 hours ago", type: "Digital", cond: 96 }
                            ].map((report) => (
                              <div key={report.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                                <div className="flex flex-col items-center gap-2">
                                  <div className={cn("w-2 h-2 rounded-full", report.category)} />
                                  <span className="text-[10px] font-mono font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{report.id}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-bold text-[#1A1A3D]">{report.worker}</span>
                                    <span className="text-[11px] font-medium text-slate-400">{report.ngo}</span>
                                  </div>
                                  <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">{report.need}</p>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{report.time}</p>
                                </div>
                                <div className="text-right space-y-2">
                                  <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[9px] font-black uppercase tracking-widest">{report.type}</Badge>
                                  <div className={cn("text-[11px] font-bold", report.cond > 80 ? "text-emerald-500" : "text-amber-500")}>
                                    {report.cond}%
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-4 pt-6 border-t border-slate-50">
                             <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">How this mission grew</p>
                             <div className="space-y-4">
                                {[
                                  { time: "10:23am", event: "Mission M-047 created from 3 reports" },
                                  { time: "11:45am", event: "2 new reports merged in by Ravi Kumar (field worker)" },
                                  { time: "12:30pm", event: "3 more reports added from CareNet NGO" }
                                ].map((log, i) => (
                                  <div key={i} className="flex gap-3 text-xs">
                                    <span className="font-bold text-[#4F46E5] w-14 shrink-0">{log.time}</span>
                                    <span className="text-slate-600 font-medium">{log.event}</span>
                                  </div>
                                ))}
                             </div>
                          </div>
                        </div>
                      )}
                   </div>
                </div>

                <div className="p-8 border-t border-slate-50 bg-white absolute bottom-0 left-0 right-0 flex gap-4">
                   <Button variant="outline" className="flex-1 border-slate-200 text-[#1A1A3D] font-bold py-7 rounded-2xl">Flag for Review</Button>
                   <Button className="flex-1 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:opacity-90 text-white font-bold py-7 rounded-2xl shadow-lg">Close Mission & Finalize</Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>

      {/* CREATE MISSION SLIDE-OVER */}
      <Sheet open={showCreateMission} onOpenChange={setShowCreateMission}>
        <SheetContent className="sm:max-w-lg p-0 flex flex-col bg-white border-l border-slate-100 font-['Plus_Jakarta_Sans']">
            <div className="p-8 border-b border-slate-50">
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-2xl font-bold text-[#1A1A3D]">
                   {creationStep === 1 ? "Create New Mission" : 
                    creationStep === 2 ? "Volunteer Assignment" : 
                    "Review and Dispatch"}
                 </h2>
                 <SheetClose className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 focus:outline-none ring-0">
                    <X className="w-4 h-4" />
                 </SheetClose>
              </div>
              <div className="flex gap-2">
                 {[1, 2, 3].map(step => (
                   <div key={step} className={cn("flex-1 h-1.5 rounded-full transition-all", step <= creationStep ? "bg-[#4F46E5]" : "bg-slate-100")} />
                 ))}
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">STEP {creationStep} OF 3 — {
                creationStep === 1 ? "MISSION DETAILS" : 
                creationStep === 2 ? "VOLUNTEER ASSIGNMENT" : 
                "FINAL REVIEW"
              }</p>
           </div>

           <div className="p-0 flex-1 overflow-y-auto space-y-0">
              {creationStep === 1 && (
                <div className="p-8 space-y-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">MISSION TITLE</label>
                       <Input placeholder="Enter mission title..." className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-bold placeholder:font-normal" />
                       <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-indigo-50/50 rounded-lg text-xs text-[#4F46E5] font-bold cursor-pointer hover:bg-indigo-50 transition-colors">
                          <Sparkles className="w-3.5 h-3.5" /> Suggestion: Hebbal North Urgent Relief
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">NEED TYPE</label>
                          <select className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 text-sm font-bold appearance-none">
                             <option>Food Distribution</option>
                             <option>Medical Support</option>
                          </select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ZONE</label>
                          <select className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 text-sm font-bold appearance-none">
                             <option>Zone 4 · Hebbal</option>
                             <option>Zone 2 · Yelahanka</option>
                          </select>
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">PRIORITY</label>
                       <div className="grid grid-cols-3 gap-3">
                          {[
                            { id: "low", label: "Low", color: "bg-blue-50 text-blue-600 border-blue-100" },
                            { id: "high", label: "High", color: "bg-amber-50 text-amber-600 border-amber-100" },
                            { id: "critical", label: "Critical", color: "bg-red-50 text-red-600 border-red-100" },
                          ].map(p => (
                            <div key={p.id} className={cn("p-4 rounded-xl border-2 text-center cursor-pointer font-black text-xs uppercase tracking-widest transition-all", p.id === "critical" ? "border-red-500 bg-red-50 text-red-600" : "border-slate-100 text-slate-400")}>
                              {p.label}
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">DESCRIPTION</label>
                       <textarea 
                         className="w-full h-32 bg-slate-50/50 border border-slate-100 rounded-2xl p-4 text-sm font-medium resize-none placeholder:text-slate-300"
                         placeholder="Add field context for the volunteer..."
                       />
                    </div>
                  </div>
                </div>
              )}

              {creationStep === 2 && (
                <div className="p-8 space-y-6">
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-[#4F46E5]" />
                    <p className="text-sm font-bold text-[#3730A3]">Gemini identified 3 volunteers with optimal proximity and success probability.</p>
                  </div>
                  
                  <div className="space-y-4">
                    {[
                      { name: "Priya Ramanathan", initials: "PR", match: 97, dist: "2.1km", success: 89, skill: 95 },
                      { name: "Arjun Menon", initials: "AM", match: 91, dist: "3.4km", success: 92, skill: 92 },
                      { name: "Meera J.", initials: "MJ", match: 94, dist: "1.8km", success: 91, skill: 96 },
                    ].map((v) => (
                      <div key={v.name} className={cn(
                        "rounded-[1.5rem] border p-5 transition-all cursor-pointer",
                        selectedVolunteerForMission?.name === v.name ? "border-[#4F46E5] bg-indigo-50/30 ring-1 ring-[#4F46E5]" : "border-slate-100 bg-white hover:border-indigo-200"
                      )} onClick={() => setSelectedVolunteerForMission(v)}>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[#4F46E5] border-2 border-white shadow-sm overflow-hidden shrink-0">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${v.name}`} alt="av" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-1">
                              <p className="text-base font-bold text-[#1A1A3D]">{v.name}</p>
                              <span className="text-sm font-black text-[#4F46E5]">{v.match}% match</span>
                            </div>
                            <div className="h-1.5 w-full bg-indigo-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#4F46E5] rounded-full" style={{ width: `${v.match}%` }} />
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-4">
                           <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg">
                              <Activity className="w-3 h-3 text-slate-400" />
                              <span className="text-[11px] font-bold text-slate-600">{v.skill}%</span>
                           </div>
                           <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span className="text-[11px] font-bold text-slate-600">{v.dist}</span>
                           </div>
                           <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg">
                              <CheckCircle2 className="w-3 h-3 text-slate-400" />
                              <span className="text-[11px] font-bold text-slate-600">{v.success}% success</span>
                           </div>
                           <div className="flex-1" />
                           <button 
                             onClick={(e) => { e.stopPropagation(); setIsScoringExpanded(isScoringExpanded === v.name ? null : v.name); }}
                             className="text-xs font-bold text-[#4F46E5] hover:underline"
                           >
                              Full breakdown →
                           </button>
                        </div>

                        {isScoringExpanded === v.name && (
                          <div className="mt-4 bg-[#EEF2FF] border border-indigo-100 rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                             <div className="flex items-center gap-2 text-[#3730A3]">
                                <Sparkles className="h-3.5 w-3.5 fill-[#3730A3]/20" />
                                <span className="text-[11px] font-bold uppercase tracking-wider">Gemini scoring breakdown</span>
                             </div>
                             <div className="grid grid-cols-2 gap-3">
                                {[
                                  { label: "Skill Match", val: v.skill },
                                  { label: "Proximity", val: 98 },
                                  { label: "Language", val: 100 },
                                  { label: "Past Success", val: v.success },
                                ].map(d => (
                                  <div key={d.label} className="space-y-1">
                                     <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                        <span>{d.label}</span>
                                        <span className="text-[#4F46E5]">{d.val}%</span>
                                     </div>
                                     <div className="h-1 w-full bg-indigo-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-[#4F46E5] rounded-full" style={{ width: `${d.val}%` }} />
                                     </div>
                                  </div>
                                ))}
                             </div>
                             <p className="text-[11px] leading-relaxed text-slate-500 italic border-t border-indigo-100/50 pt-2">
                                "Optimized selection based on previous success in Hebbal zone missions."
                             </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {creationStep === 3 && (
                <div className="space-y-0">
                  {/* Warning Banner */}
                  <div className="bg-amber-50 border-y border-amber-100 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                       <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                       <div className="space-y-1">
                          <p className="text-sm font-bold text-[#92400E]">Active mission exists for this zone + need type.</p>
                          <p className="text-xs text-[#92400E]/70 font-medium">M-047 is already running in Hebbal for Food Distribution (active 2h ago)</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-4 pl-8">
                       <Button 
                         variant="outline" 
                         className="h-9 px-4 rounded-lg bg-white border-amber-200 text-[#92400E] font-bold text-[11px] hover:bg-amber-100/50 transition-colors"
                         onClick={() => {
                            setShowCreateMission(false);
                            setSelectedMission(activeMissions[0]);
                            toast.success("Report added to existing mission M-047");
                         }}
                       >
                         Add report to M-047 instead →
                       </Button>
                       <button className="text-[11px] font-bold text-red-500 hover:underline">Create separate mission anyway</button>
                    </div>
                  </div>

                  <div className="p-8 space-y-8">
                    {/* Mission Overview Summary Card */}
                    <div className="bg-[#4F46E5] rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
                       <div className="flex items-center gap-3 mb-4 opacity-70">
                          <Shield className="w-5 h-5" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Deployment Review</span>
                       </div>
                       <h3 className="text-xl font-bold mb-1">Hebbal North Urgent Relief</h3>
                       <p className="text-indigo-100/70 text-sm font-medium">Food Distribution · Zone 4 · Eastern Flats</p>
                       <div className="mt-6 flex items-center gap-3 pt-6 border-t border-white/10">
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs ring-2 ring-white/20 overflow-hidden">
                             <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedVolunteerForMission?.name || "Ravi"}`} alt="av" />
                          </div>
                          <div>
                             <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">ASSIGNED VOLUNTEER</p>
                             <p className="text-sm font-bold text-white">{selectedVolunteerForMission?.name || "No volunteer selected"}</p>
                          </div>
                       </div>
                    </div>

                    {/* RESOURCES SECTION */}
                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <Box className="w-4 h-4 text-slate-400" />
                             <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Resources available for this mission</h4>
                          </div>
                          <button className="text-[10px] font-black text-[#4F46E5] uppercase tracking-widest flex items-center gap-1 hover:opacity-80 transition-opacity">
                             + Add resource
                          </button>
                       </div>
                       
                       <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                          {[
                            { name: "Food packets", qty: "24 available", dist: "1.2km", status: "success" },
                            { name: "First aid kit", qty: "3 kits", dist: "2.4km", status: "warning" },
                            { name: "NGO vehicle", qty: "1 available", dist: "call", status: "success" },
                            { name: "Blankets", qty: "8 available", dist: "0.8km", status: "success" },
                          ].map(res => (
                            <div key={res.name} className="flex items-center gap-3 bg-white border border-slate-100 rounded-full px-4 py-2.5 whitespace-nowrap shadow-sm">
                               <div className={cn("w-2 h-2 rounded-full", res.status === "success" ? "bg-[#10B981]" : "bg-amber-500")} />
                               <div className="flex flex-col">
                                  <span className="text-[11px] font-bold text-[#1A1A3D] leading-none mb-0.5">{res.name}</span>
                                  <div className="flex items-center gap-1 opacity-60">
                                     <span className="text-[9px] font-bold text-slate-400">{res.qty}</span>
                                     <span className="text-[9px] font-bold text-slate-400">•</span>
                                     <span className="text-[9px] font-bold text-slate-400">{res.dist}</span>
                                  </div>
                               </div>
                            </div>
                          ))}
                       </div>

                       <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[#4F46E5] border border-slate-100">
                                <FileText className="w-4 h-4" />
                             </div>
                             <span className="text-sm font-bold text-slate-600">Pre-assign resources to volunteer</span>
                          </div>
                          <Switch className="data-[state=checked]:bg-[#4F46E5]" />
                       </div>
                    </div>

                    {/* Gemini brief preview */}
                    <div className="space-y-4">
                       <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Intelligence Brief Preview</h4>
                       <div className="p-6 bg-slate-50 rounded-[2rem] border-l-4 border-[#4F46E5] relative">
                          <Sparkles className="absolute top-4 right-4 w-5 h-5 text-[#4F46E5]/20" />
                          <p className="text-[15px] leading-relaxed text-slate-600 italic font-medium">
                            "Target zone has limited vehicle access. Direct {selectedVolunteerForMission?.name?.split(' ')[0] || "John"} to park at the Sector 4 entrance. Recipient is elderly and expects a discreet delivery."
                          </p>
                          <div className="mt-4 flex items-center gap-2 text-[#4F46E5] text-[10px] font-black uppercase tracking-widest">
                             <Sparkles className="w-3.5 h-3.5" /> Generated by Gemini Hub
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-5 bg-white rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Outcome Projections</p>
                          <p className="text-2xl font-black text-center text-[#10B981]">92%</p>
                          <p className="text-[10px] font-bold text-center text-slate-400 uppercase">Success Prob.</p>
                       </div>
                       <div className="p-5 bg-white rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Risk Assessment</p>
                          <p className="text-2xl font-black text-center text-[#10B981]">Low</p>
                          <p className="text-[10px] font-bold text-center text-slate-400 uppercase">Risk Level</p>
                       </div>
                    </div>
                  </div>
                </div>
              )}
           </div>

           <div className="p-8 border-t border-slate-50 flex gap-4 bg-white/80 backdrop-blur-md">
              {creationStep > 1 && (
                <Button 
                  onClick={() => setCreationStep(creationStep - 1)} 
                  variant="outline" 
                  className="w-1/3 border-slate-200 text-slate-500 font-bold py-7 rounded-2xl"
                >
                  Back
                </Button>
              )}
              <Button 
                onClick={() => {
                  if (creationStep < 3) setCreationStep(creationStep + 1);
                  else {
                    setShowCreateMission(false);
                    setCreationStep(1);
                    toast.success("Mission dispatched successfully!");
                  }
                }} 
                className={cn(
                  "flex-1 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:opacity-90 text-white font-bold py-7 rounded-2xl shadow-lg flex items-center justify-center gap-3",
                  creationStep === 3 && "from-blue-600 to-indigo-700"
                )}
              >
                {creationStep === 3 ? "Dispatch Mission Now" : "Next Step →" }
                {creationStep === 3 && <Send className="w-5 h-5" />}
              </Button>
           </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CoordinatorMissions;