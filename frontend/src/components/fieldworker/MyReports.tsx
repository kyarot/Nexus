import React, { useState } from "react";
import { 
  Search, 
  Filter, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Eye, 
  Edit3, 
  Database, 
  AlertTriangle,
  Loader2,
  Calendar,
  Grid,
  List as ListIcon,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const StatusPill = ({ label, active, onClick, count }: { label: string, active: boolean, onClick: () => void, count?: number }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-2",
      active 
        ? "bg-[#5A57FF] text-white border-[#5A57FF] shadow-lg shadow-indigo-500/20" 
        : "bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:text-slate-600"
    )}
  >
    {label}
    {count !== undefined && (
      <span className={cn(
        "px-2 py-0.5 rounded-full text-[10px]",
        active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"
      )}>{count}</span>
    )}
  </button>
);

export const MyReports = ({ onNewReport }: { onNewReport: () => void }) => {
  const [filter, setFilter] = useState("All");

  const reports = [
    { id: "R-9042", zone: "Sector 7-G", type: "Sanitation", families: 12, severity: "Critical", date: "Today, 09:45", status: "Synced" },
    { id: "R-9039", zone: "East Perimeter", type: "Food Security", families: 4, severity: "High", date: "Yesterday, 18:20", status: "Queued" },
    { id: "R-9037", zone: "Zone B-Central", type: "Medical Aid", families: 1, severity: "Medium", date: "Oct 24, 11:30", status: "Processing" },
    { id: "R-9035", zone: "Hebbal North", type: "Housing", families: 22, severity: "Low", date: "Oct 22, 14:15", status: "Synced" }
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Offline Queue Indicator */}
      <div className="bg-amber-50 border border-amber-100 p-5 rounded-[2.5rem] flex items-center justify-between shadow-sm">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
               <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
               <p className="text-sm font-bold text-amber-900">3 reports waiting to sync</p>
               <p className="text-xs text-amber-700/70 font-medium">Automatic upload will resume when connection is stable</p>
            </div>
         </div>
         <Button variant="ghost" className="text-amber-600 border border-amber-200 bg-white hover:bg-amber-50 font-bold text-xs uppercase tracking-widest px-6 h-12 rounded-2xl">
            Force Sync Now
         </Button>
      </div>

      {/* Header & Main Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
         <div>
            <h1 className="text-4xl font-bold text-[#1A1A3D] tracking-tight">Intelligence History</h1>
            <p className="text-slate-500 font-medium mt-1 italic">Manage and track your field submissions</p>
         </div>
         <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
               <Input placeholder="Search Report ID or Zone..." className="pl-12 h-14 rounded-2xl border-slate-100 bg-white shadow-sm focus:ring-[#5A57FF]" />
            </div>
            <Button onClick={onNewReport} className="h-14 px-8 rounded-2xl bg-gradient-to-r from-[#5A57FF] to-purple-600 font-bold shadow-xl shadow-indigo-100 flex gap-2">
               New Report <Grid className="w-4 h-4" />
            </Button>
         </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-4">
         <StatusPill label="All Reports" active={filter === "All"} onClick={() => setFilter("All")} />
         <StatusPill label="Synced" active={filter === "Synced"} onClick={() => setFilter("Synced")} count={12} />
         <StatusPill label="Queued" active={filter === "Queued"} onClick={() => setFilter("Queued")} count={3} />
         <StatusPill label="Processing" active={filter === "Processing"} onClick={() => setFilter("Processing")} count={1} />
         
         <div className="h-10 w-px bg-slate-200 mx-2 hidden lg:block" />
         
         <div className="flex gap-4">
            <Select>
               <SelectTrigger className="h-12 w-[160px] rounded-2xl bg-white border-slate-100 shadow-sm font-bold text-xs">
                  <SelectValue placeholder="All Zones" />
               </SelectTrigger>
               <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  <SelectItem value="hebbal">Hebbal North</SelectItem>
                  <SelectItem value="sector7">Sector 7-G</SelectItem>
               </SelectContent>
            </Select>
            <div className="relative">
               <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
               <button className="h-12 px-10 pl-12 rounded-2xl bg-white border-slate-100 shadow-sm font-bold text-xs text-slate-500 flex items-center gap-2">
                  Last 7 Days <ChevronDown className="w-3 h-3" />
               </button>
            </div>
         </div>
      </div>

      {/* Reports Table Card */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-indigo-500/5 overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-slate-50/50">
                     <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-10">Report ID</th>
                     <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Zone / Location</th>
                     <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Need Type</th>
                     <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Families</th>
                     <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Severity</th>
                     <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Submitted</th>
                     <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                     <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-10">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {reports.map((report) => (
                     <tr key={report.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                        <td className="p-8 pl-10 font-mono text-xs font-bold text-slate-400">{report.id}</td>
                        <td className="p-8">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-[#5A57FF]">
                                 <MapPin className="w-4 h-4" />
                              </div>
                              <span className="font-bold text-[#1A1A3D] text-sm">{report.zone}</span>
                           </div>
                        </td>
                        <td className="p-8">
                           <Badge className="bg-[#F3F2FF] text-[#5A57FF] border-none px-4 py-1.5 rounded-xl font-bold text-xs">{report.type}</Badge>
                        </td>
                        <td className="p-8 text-center">
                           <span className="font-black text-[#1A1A3D] text-sm">{report.families}</span>
                        </td>
                        <td className="p-8">
                           <div className="flex items-center gap-2">
                              <div className={cn(
                                 "w-2 h-2 rounded-full",
                                 report.severity === "Critical" ? "bg-red-500 animate-pulse" :
                                 report.severity === "High" ? "bg-amber-500" :
                                 report.severity === "Medium" ? "bg-blue-500" : "bg-emerald-500"
                              )} />
                              <span className={cn(
                                 "text-xs font-black uppercase tracking-widest",
                                 report.severity === "Critical" ? "text-red-500" :
                                 report.severity === "High" ? "text-amber-600" :
                                 report.severity === "Medium" ? "text-blue-600" : "text-emerald-600"
                              )}>{report.severity}</span>
                           </div>
                        </td>
                        <td className="p-8">
                           <div className="flex flex-col">
                              <span className="text-sm font-bold text-[#1A1A3D]">{report.date.split(', ')[0]}</span>
                              <span className="text-[10px] font-medium text-slate-400">{report.date.split(', ')[1]}</span>
                           </div>
                        </td>
                        <td className="p-8">
                           {report.status === "Synced" ? (
                              <Badge className="bg-emerald-50 text-emerald-600 border-none px-4 py-1.5 rounded-full font-black text-[9px] tracking-widest uppercase flex w-fit gap-2">
                                 Synced <CheckCircle2 className="w-3 h-3" />
                              </Badge>
                           ) : report.status === "Queued" ? (
                              <Badge className="bg-amber-50 text-amber-500 border-none px-4 py-1.5 rounded-full font-black text-[9px] tracking-widest uppercase flex w-fit gap-2">
                                 Queued <Clock className="w-3 h-3" />
                              </Badge>
                           ) : (
                              <Badge className="bg-indigo-50 text-[#5A57FF] border-none px-4 py-1.5 rounded-full font-black text-[9px] tracking-widest uppercase flex w-fit gap-2 animate-pulse">
                                 Processing <Loader2 className="w-3 h-3 animate-spin" />
                              </Badge>
                           )}
                        </td>
                        <td className="p-8 pr-10 text-right">
                           <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-[#5A57FF] hover:border-indigo-100 transition-all">
                                 <Eye className="w-4 h-4" />
                              </button>
                              <button className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-[#5A57FF] hover:border-indigo-100 transition-all">
                                 <Edit3 className="w-4 h-4" />
                              </button>
                           </div>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
         
         <div className="p-6 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Showing 4 of 128 reports</p>
            <div className="flex gap-2">
               <Button variant="outline" className="h-10 px-6 rounded-xl border-slate-200 font-bold text-xs" disabled>Previous</Button>
               <Button variant="outline" className="h-10 px-6 rounded-xl border-slate-200 font-bold text-xs hover:bg-[#F3F2FF] hover:text-[#5A57FF] hover:border-indigo-100">Next</Button>
            </div>
         </div>
      </div>

    </div>
  );
};