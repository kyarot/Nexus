import React, { useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  Sparkles, 
  ArrowDownRight, 
  ChevronRight, 
  ExternalLink, 
  FileText, 
  Download, 
  Share2, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MoreHorizontal,
  Info,
  TrendingDown,
  LayoutDashboard,
  Users,
  Map,
  Filter,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TrustFabric = () => {
  const [period, setPeriod] = useState("This Month");

  const metrics = [
    { label: "Missions Verified", value: "312", delta: "Across 9 zones", border: "border-[#4F46E5]" },
    { label: "Avg Need Reduction", value: "-34%", delta: "Per mission", border: "border-[#10B981]" },
    { label: "Families Impacted", value: "2,847", delta: "Verified count", border: "border-[#F59E0B]" },
    { label: "NGO Trust Score", value: "87/100", delta: "Verified", border: "border-[#7C3AED]", isBadge: true },
  ];

  const ledgerData = [
    { id: "M-047", title: "Hebbal Food Dist.", zone: "Zone 4", type: "Food", before: 74, after: 51, change: "-23", pct: "-31%", volunteer: "Priya R.", date: "Mar 14", status: "Verified" },
    { id: "M-112", title: "Malleshwaram Health", zone: "Zone 1", type: "Health", before: 82, after: 44, change: "-38", pct: "-46%", volunteer: "Arjun K.", date: "Mar 12", status: "Verified" },
    { id: "M-089", title: "Koramangala Literacy", zone: "Zone 8", type: "Education", before: 45, after: 38, change: "-7", pct: "-15%", volunteer: "Sarah L.", date: "Mar 10", status: "Verified" },
  ];

  const integrityBreakdown = [
    { label: "Mission Success Rate", value: 89 },
    { label: "Real Need Reduction", value: 78 },
    { label: "Volunteer Retention", value: 67 },
    { label: "Report Accuracy", value: 94 },
    { label: "Community Feedback", value: 85 },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7FF] font-['Plus_Jakarta_Sans']">
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-y-auto">
          <DashboardTopBar breadcrumb="Reports / Trust Fabric" />
          
          <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="space-y-4 max-w-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-[#4F46E5] shadow-sm">
                    <Shield className="w-7 h-7" />
                  </div>
                  <h1 className="text-[32px] font-bold text-[#1A1A3D]">Trust Fabric</h1>
                </div>
                <p className="text-[#64748B] text-lg leading-relaxed">
                  Cryptographically verified impact ledger — every score is calculated from real community need data, not self-reported ratings.
                </p>
                <div className="inline-flex items-center gap-3 px-4 py-3 bg-indigo-50/80 backdrop-blur-sm rounded-2xl border border-indigo-100 text-[#4F46E5] text-sm font-medium">
                  <Sparkles className="w-4 h-4" />
                  Unlike star ratings, Trust Fabric scores cannot be faked. They are calculated automatically from before and after need scores.
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="bg-white p-1 rounded-xl border border-slate-200 flex gap-1">
                  {["This Month", "3M", "6M", "All"].map((p) => (
                    <button 
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                        period === p ? "bg-[#4F46E5] text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <Button className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] hover:opacity-90 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95">
                  Generate Donor Report <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>

            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {metrics.map((m, i) => (
                <div key={i} className={cn(
                  "bg-white rounded-[1.25rem] p-6 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border-l-[4px] flex flex-col justify-between h-36 transition-transform hover:-translate-y-1",
                  m.border
                )}>
                  <span className="text-[11px] font-black text-[#64748B] uppercase tracking-widest">{m.label}</span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-bold text-[#1A1A3D]">{m.value}</span>
                      {m.isBadge && (
                        <Badge className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white border-none uppercase text-[9px] font-black tracking-widest px-2 shadow-sm">
                          Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-[#64748B] opacity-60 uppercase">{m.delta}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Trust Score Hero Card */}
              <div className="lg:col-span-2 bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-indigo-50/50">
                <div className="flex flex-col md:flex-row gap-12">
                  <div className="md:w-1/3 flex flex-col justify-center items-center text-center border-r border-slate-100 pr-12">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">YOUR NGO TRUST SCORE</p>
                    <div className="relative mb-6">
                       <svg className="w-40 h-40 -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="44" fill="transparent" stroke="#F1F5F9" strokeWidth="10" />
                          <circle cx="50" cy="50" r="44" fill="transparent" stroke="#4F46E5" strokeWidth="10" strokeDasharray="276.46" strokeDashoffset="35.94" strokeLinecap="round" />
                       </svg>
                       <div className="absolute inset-0 flex flex-col items-center justify-center -mt-2">
                          <div className="flex items-baseline">
                             <span className="text-[54px] font-black text-[#1A1A3D] leading-none">87</span>
                             <span className="text-xl font-bold text-slate-300 ml-1">/100</span>
                          </div>
                       </div>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 font-black uppercase text-[10px] tracking-widest px-4 py-1.5 mb-2 rounded-full border-none shadow-sm">
                      Gold Tier NGO
                    </Badge>
                    <p className="text-[11px] font-bold text-slate-500 mb-4 opacity-70">Top 15% of all NGOs on Nexus</p>
                    <div className="flex items-center gap-1.5 text-[#10B981] font-black text-xs bg-green-50 px-3 py-1 rounded-full">
                       <ArrowDownRight className="w-3.5 h-3.5 rotate-180" /> ↑ +6 points this month
                    </div>
                  </div>

                  <div className="flex-1 space-y-6">
                    <div className="flex items-center justify-between mb-2">
                       <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest">Integrity Breakdown</h3>
                       <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                          <Clock className="w-3.5 h-3.5" /> Last verified: Today 9:41 AM
                       </div>
                    </div>
                    <div className="space-y-5">
                      {integrityBreakdown.map((item) => (
                        <div key={item.label} className="space-y-2">
                          <div className="flex justify-between text-[11px] font-black uppercase tracking-wider">
                            <span className="text-slate-500">{item.label}</span>
                            <span className="text-[#1A1A3D]">{item.value}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.3)]" style={{ width: `${item.value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trust Fabric Ledger Status: Synchronized & Verified</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Verification Stats / Pipeline */}
              <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 h-full flex flex-col">
                 <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest mb-8 flex items-center gap-2">
                    Verification Stats <Sparkles className="w-4 h-4 text-indigo-400" />
                 </h3>
                 <div className="space-y-8 flex-1">
                    <div className="relative pl-8 space-y-10">
                       <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-slate-100" />
                       
                       <div className="relative">
                          <div className="absolute -left-[30px] top-0 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center text-white border-4 border-white shadow-sm">
                             <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <div className="space-y-1">
                             <p className="text-xs font-black text-[#1A1A3D] uppercase tracking-widest">Data Ingested</p>
                             <p className="text-[11px] font-medium text-slate-400">100% of telemetry received</p>
                          </div>
                       </div>

                       <div className="relative">
                          <div className="absolute -left-[30px] top-0 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center text-white border-4 border-white shadow-sm">
                             <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <div className="space-y-1">
                             <p className="text-xs font-black text-[#1A1A3D] uppercase tracking-widest">Cross-Validation</p>
                             <p className="text-[11px] font-medium text-slate-400">Volunteer & Community matching</p>
                          </div>
                       </div>

                       <div className="relative">
                          <div className="absolute -left-[30px] top-0 w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-[#4F46E5] border-4 border-white shadow-sm ring-2 ring-indigo-50">
                             <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div className="space-y-1">
                             <p className="text-xs font-black text-[#1A1A3D] uppercase tracking-widest leading-tight">Final Ledger Entry</p>
                             <p className="text-[11px] font-medium text-slate-400">Pending final signing (8 missions)</p>
                          </div>
                       </div>
                    </div>

                    <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 space-y-3 mt-auto">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <AlertCircle className="w-4 h-4 text-amber-600" />
                             <span className="text-xs font-black text-amber-900 uppercase tracking-wider">Pending Verif.</span>
                          </div>
                          <Badge className="bg-white/80 text-amber-700 border-none font-bold text-[10px] px-2">12h 42m</Badge>
                       </div>
                       <p className="text-[11px] leading-relaxed text-amber-800/80 font-medium">
                          8 missions require final audit signature before being added to the public Trust Fabric ledger.
                       </p>
                       <Button className="w-full bg-amber-900/10 hover:bg-amber-900/20 text-amber-900 border-none font-black text-[10px] uppercase tracking-widest py-5 rounded-xl transition-all">
                          Review Pending
                       </Button>
                    </div>
                 </div>
              </div>
            </div>

            {/* Impact Ledger Table */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#1A1A3D]">Verified Mission Outcomes</h2>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-slate-300 hover:text-indigo-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="bg-[#1E1B4B] text-white border-none p-4 rounded-xl max-w-[200px] shadow-2xl">
                        <p className="text-[11px] font-bold leading-relaxed">Verification occurs 14 days post-mission to ensure need reduction is sustained.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                      Sort by:
                      <select className="bg-white border-none text-[#1A1A3D] font-black focus:ring-0 py-0 pl-1 pr-6 cursor-pointer appearance-none">
                         <option>Latest Date</option>
                         <option>Highest Impact</option>
                      </select>
                   </div>
                   <Button variant="ghost" className="h-9 px-3 text-slate-400 font-bold text-xs hover:bg-white hover:shadow-sm"><Filter className="w-4 h-4 mr-2" /> Filter</Button>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[#4F46E5] text-white text-left">
                        <th className="py-5 px-8 text-[10px] font-black uppercase tracking-widest rounded-tl-[2rem]">Mission</th>
                        <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest">Zone</th>
                        <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest">Need Type</th>
                        <th className="py-5 px-6 text-center text-[10px] font-black uppercase tracking-widest">Before</th>
                        <th className="py-5 px-6 text-center text-[10px] font-black uppercase tracking-widest">After</th>
                        <th className="py-5 px-6 text-center text-[10px] font-black uppercase tracking-widest">Change</th>
                        <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest">Volunteer</th>
                        <th className="py-5 px-8 text-[10px] font-black uppercase tracking-widest rounded-tr-[2rem]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {ledgerData.map((row, i) => (
                        <tr key={row.id} className={cn(
                          "group hover:bg-indigo-50/30 transition-all cursor-pointer",
                          i % 2 === 1 ? "bg-white" : "bg-[#F8F9FA]/50"
                        )}>
                          <td className="py-6 px-8">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-400 font-mono mb-1">{row.id}</span>
                              <span className="text-sm font-bold text-[#1A1A3D] group-hover:text-[#4F46E5] transition-colors">{row.title}</span>
                            </div>
                          </td>
                          <td className="py-6 px-6">
                            <Badge className="bg-indigo-50 text-[#4F46E5] border-none font-bold text-[10px] px-2.5 rounded-full">
                              {row.zone}
                            </Badge>
                          </td>
                          <td className="py-6 px-6">
                            <Badge className="bg-amber-50 text-amber-700 border-none font-bold text-[10px] px-2.5 rounded-full">
                              {row.type}
                            </Badge>
                          </td>
                          <td className="py-6 px-6 text-center text-sm font-black text-red-400 opacity-60 font-mono">{row.before}</td>
                          <td className="py-6 px-6 text-center text-sm font-black text-[#4F46E5] font-mono">{row.after}</td>
                          <td className="py-6 px-6 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-[15px] font-black text-[#10B981]">{row.change}</span>
                              <span className="text-[10px] font-black text-[#10B981] opacity-70">({row.pct})</span>
                            </div>
                          </td>
                          <td className="py-6 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-[#4F46E5] font-black text-[10px]">
                                {row.volunteer[0]}
                              </div>
                              <span className="text-xs font-bold text-[#1A1A3D]">{row.volunteer}</span>
                            </div>
                          </td>
                          <td className="py-6 px-8">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                              <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">{row.status} ✓</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                   <p className="text-xs font-bold text-slate-400">Showing 1-10 of 312 records</p>
                   <div className="flex gap-2">
                      <Button variant="outline" className="h-9 px-4 border-slate-200 text-slate-400 font-bold text-xs hover:bg-white" disabled>Previous</Button>
                      <Button variant="outline" className="h-9 px-4 border-slate-200 text-[#4F46E5] font-bold text-xs hover:bg-white hover:border-[#4F46E5]">Next</Button>
                   </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Zone level impact */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex justify-between items-center">
                   <h2 className="text-xl font-bold text-[#1A1A3D]">Impact by Zone</h2>
                   <button className="text-[11px] font-black text-[#4F46E5] uppercase tracking-widest hover:underline flex items-center gap-1">
                      View Map Detail <ExternalLink className="w-3.5 h-3.5" />
                   </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { name: "Zone 4 (North)", status: "High Impact", color: "bg-indigo-500", reduction: "42%", missions: 128 },
                    { name: "Zone 1 (Core)", status: "Steady", color: "bg-emerald-500", reduction: "18%", missions: 94 },
                    { name: "Zone 8 (South)", status: "Emerging", color: "bg-indigo-400", reduction: "27%", missions: 45 },
                  ].map((zone) => (
                    <div key={zone.name} className="bg-white rounded-[1.5rem] p-6 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-6 group hover:border-indigo-100 transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                           <h4 className="text-sm font-black text-[#1A1A3D]">{zone.name}</h4>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">NEED SATURATION</p>
                        </div>
                        <Badge className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none", zone.status === "High Impact" ? "bg-indigo-100 text-indigo-700" : zone.status === "Steady" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")}>
                          {zone.status}
                        </Badge>
                      </div>
                      <div className="h-12 flex items-end gap-1 px-1">
                         {[35, 65, 45, 85, 55].map((h, i) => (
                           <div key={i} className={cn("flex-1 rounded-t-sm transition-all group-hover:opacity-100", zone.color, i === 4 ? "opacity-100" : "opacity-40")} style={{ height: `${h}%` }} />
                         ))}
                      </div>
                      <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-4">
                         <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase">MISSIONS</p>
                            <p className="text-[15px] font-black text-[#1A1A3D]">{zone.missions}</p>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase">REDUCTION</p>
                            <p className="text-[15px] font-black text-[#10B981]">{zone.reduction}</p>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Impact by Need Type */}
              <div className="space-y-6">
                 <h2 className="text-xl font-bold text-[#1A1A3D]">Impact by Need Type</h2>
                 <div className="bg-white rounded-[1.5rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-8 h-[calc(100%-44px)]">
                    <div className="space-y-6">
                       {[
                         { label: "Food Security", pct: 45, val: "-38%" },
                         { label: "Healthcare", pct: 30, val: "-22%" },
                         { label: "Literacy", pct: 25, val: "-14%" },
                       ].map(n => (
                         <div key={n.label} className="space-y-3">
                            <div className="flex justify-between text-xs font-black uppercase tracking-widest">
                               <span className="text-slate-500">{n.label}</span>
                               <span className="text-indigo-600">{n.pct}%</span>
                            </div>
                            <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden p-0.5">
                               <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full shadow-inner" style={{ width: `${n.pct}%` }} />
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-[#10B981]">
                               <TrendingDown className="w-3 h-3" /> Avg Reduction: {n.val}
                            </div>
                         </div>
                       ))}
                    </div>

                    <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100 space-y-3 mt-auto">
                       <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-indigo-500" />
                          <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Gemini Insight</span>
                       </div>
                       <p className="text-[11px] leading-relaxed text-indigo-900/80 font-bold">
                          Food interventions show the highest sustainability. Focus on Zone 4 health missions to increase overall Trust Score by 4% next month.
                       </p>
                    </div>
                 </div>
              </div>
            </div>

            {/* Donor Report Generator */}
            <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.1)] border-2 border-indigo-100/50 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/20 via-white to-white relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8">
                  <FileText className="w-32 h-32 text-indigo-50 -mr-8 -mt-8 rotate-12" />
               </div>
               <div className="relative flex flex-col md:flex-row gap-12 items-center">
                  <div className="flex-1 space-y-6 text-center md:text-left">
                     <div className="space-y-3">
                        <h2 className="text-[28px] font-black text-[#1A1A3D]">Impact Transparency Report</h2>
                        <p className="text-slate-500 text-lg max-w-xl">Compile a cryptographically sealed report for donors and regulatory bodies.</p>
                     </div>
                     <div className="grid grid-cols-2 gap-x-12 gap-y-4 max-w-2xl">
                        {[
                          "Dynamic Zone Maps", "Volunteer Leaderboard", 
                          "Cost Analysis & Efficiency", "Community Sentiment Index",
                          "Raw Data Audit Logs", "External Partner Validation"
                        ].map((opt, i) => (
                           <div key={opt} className="flex items-center gap-3">
                              <div className={cn("w-5 h-5 rounded-md border flex items-center justify-center transition-all shadow-sm", i < 4 ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200")}>
                                 {i < 4 && <CheckCircle2 className="w-3.5 h-3.5" />}
                              </div>
                              <span className={cn("text-xs font-bold leading-none", i < 4 ? "text-[#1A1A3D]" : "text-slate-400")}>{opt}</span>
                           </div>
                        ))}
                     </div>
                     <div className="pt-4">
                        <Button className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-black py-7 px-10 rounded-[1.5rem] shadow-xl shadow-indigo-200 flex items-center gap-3 active:scale-[0.98] transition-all group">
                           <FileText className="w-5 h-5 group-hover:animate-pulse" />
                           Generate & Sign PDF Report
                        </Button>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-4 flex items-center gap-2 justify-center md:justify-start">
                           <Clock className="w-3.5 h-3.5" /> Last generated: March 2026 Monthly Summary
                        </p>
                     </div>
                  </div>
                  
                  <div className="w-[280px] shrink-0 space-y-4">
                     <p className="text-[11px] font-black text-center text-slate-400 uppercase tracking-widest">Preview Preview</p>
                     <div className="aspect-[3/4] bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 flex flex-col gap-4 relative overflow-hidden group cursor-zoom-in">
                        <div className="w-full h-8 bg-indigo-50 rounded-lg animate-pulse" />
                        <div className="w-2/3 h-4 bg-slate-50 rounded-md animate-pulse" />
                        <div className="flex-1 border-y border-dashed border-slate-100 flex items-center justify-center">
                           <Shield className="w-12 h-12 text-indigo-100 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="space-y-2">
                           <div className="h-2 w-full bg-slate-50 rounded-full" />
                           <div className="h-2 w-full bg-slate-50 rounded-full" />
                           <div className="h-2 w-1/2 bg-slate-50 rounded-full" />
                        </div>
                        <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors flex items-center justify-center">
                           <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-indigo-600 shadow-xl">Click to Preview</div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Right Stats Sidebar */}
        <div className="w-[320px] bg-white border-l border-slate-100 p-8 space-y-10 overflow-y-auto shrink-0 hidden xl:block font-['Plus_Jakarta_Sans']">
           <div className="space-y-6">
              <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest flex items-center justify-between">
                 Top Impact Volunteers <Filter className="w-3.5 h-3.5 text-slate-400" />
              </h3>
              <div className="space-y-4">
                 {[
                   { name: "Priya R.", missions: 42, impact: "8.9 Impact", initial: "P" },
                   { name: "Arjun K.", missions: 38, impact: "8.4 Impact", initial: "A" },
                   { name: "Sarah L.", missions: 31, impact: "7.9 Impact", initial: "S" },
                   { name: "Marcus V.", missions: 28, impact: "7.2 Impact", initial: "M" },
                 ].map((v) => (
                   <div key={v.name} className="flex items-center justify-between group cursor-pointer p-2 -m-2 rounded-2xl hover:bg-slate-50 transition-all">
                      <div className="flex items-center gap-3">
                         <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-[#4F46E5] font-black text-xs border-2 border-white shadow-sm overflow-hidden group-hover:scale-105 transition-transform">
                            {v.initial}
                         </div>
                         <div className="min-w-0">
                            <p className="text-[13px] font-bold text-[#1A1A3D] truncate">{v.name}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{v.missions} Missions</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <span className="text-[11px] font-black text-[#10B981] uppercase tracking-widest">{v.impact}</span>
                         <p className="text-[9px] font-medium text-slate-400 leading-none">Verified</p>
                      </div>
                   </div>
                 ))}
              </div>
              <button className="w-full text-center text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline pt-2">View all volunteers <ChevronRight className="w-3 h-3 inline-block -mt-0.5" /></button>
           </div>

           <div className="pt-10 border-t border-slate-50 space-y-6">
              <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest mb-6">Quick Verification Digest</h3>
              <div className="space-y-4">
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center">
                       <p className="text-[10px] font-black text-slate-400 uppercase">Verification Rate</p>
                       <span className="text-xs font-black text-indigo-600">98.4%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white rounded-full">
                       <div className="h-full bg-indigo-500 rounded-full" style={{ width: "98%" }} />
                    </div>
                 </div>
                 <div className="p-5 bg-[#1E1B4B] rounded-[1.5rem] text-white space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 mb-2">
                       <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                          <Download className="w-4 h-4 text-indigo-300" />
                       </div>
                       <p className="text-xs font-black uppercase tracking-widest">Share Impact</p>
                    </div>
                    <div className="space-y-3">
                       <Button variant="ghost" className="w-full justify-start gap-3 h-11 bg-white/5 hover:bg-white/10 text-white font-bold text-xs ring-0 border-none">
                          <Share2 className="w-4 h-4 text-indigo-400" /> WhatsApp Link
                       </Button>
                       <Button variant="ghost" className="w-full justify-start gap-3 h-11 bg-white/5 hover:bg-white/10 text-white font-bold text-xs ring-0 border-none">
                          <ExternalLink className="w-4 h-4 text-indigo-400" /> Email directly
                       </Button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default TrustFabric;