import React, { useState } from "react";
import { 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Navigation, 
  AlertTriangle,
  Mic,
  FileText,
  User,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  Navigation2,
  Phone,
  ArrowRight,
  Sparkles,
  Search,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

const UpdateRow = ({ time, status, text, type }: { time: string, status: string, text: string, type: "system" | "field" }) => (
  <div className="flex gap-4 relative pb-8 group last:pb-0">
    <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-100 group-last:bg-transparent" />
    <div className={cn(
      "w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10",
      type === "system" ? "bg-indigo-50 border border-indigo-100 text-[#5A57FF]" : "bg-emerald-50 border border-emerald-100 text-emerald-500"
    )}>
       {type === "system" ? <div className="w-1.5 h-1.5 rounded-full bg-current" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
    </div>
    <div className="space-y-1 pt-0.5">
       <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{time}</span>
          <Badge className={cn(
            "text-[8px] font-black tracking-widest uppercase border-none px-2 h-4 shadow-none",
            type === "system" ? "bg-indigo-50 text-[#5A57FF]/70" : "bg-emerald-50 text-emerald-600/70"
          )}>{status}</Badge>
       </div>
       <p className="text-xs font-bold text-[#1A1A3D] leading-relaxed">{text}</p>
    </div>
  </div>
);

export const ActiveMission = () => {
  const [status, setStatus] = useState<"Arrival" | "Distribution" | "Assessment" | "Done">("Arrival");
  const [missionDone, setMissionDone] = useState(false);

  return (
    <div className="flex flex-col lg:flex-row gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* LEFT COLUMN - MISSION DETAILS */}
      <div className="lg:w-[60%] space-y-8">
        
        {/* Mission Header Card */}
        <div className="bg-gradient-to-br from-[#5A57FF] to-purple-600 rounded-[2.5rem] p-10 text-white shadow-xl shadow-indigo-500/10 relative overflow-hidden group">
           <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full backdrop-blur-md">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    <span className="text-[9px] font-black uppercase tracking-widest leading-none">ACTIVE SESSION · NF-8821</span>
                 </div>
                 <Badge className="bg-emerald-500/20 text-emerald-400 border-none font-black text-[9px] tracking-widest uppercase px-4 py-1">Mission Live</Badge>
              </div>
              
              <div className="space-y-3">
                 <h1 className="text-4xl font-bold tracking-tight">Emergency Supply Re-routing</h1>
                 <p className="text-[#E0E7FF] font-medium max-w-lg leading-relaxed italic opacity-80">
                    Coordinate the distribution of essential medical supplies to the temporary shelter in District 4.
                 </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                 <div className="w-10 h-10 rounded-xl bg-white/20 p-1 backdrop-blur-sm">
                    <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=80&h=80&q=80" className="w-full h-full rounded-lg object-cover" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#E0E7FF]">Dispatched by</p>
                    <p className="text-sm font-bold">Sarah Coordinator · 10:23 AM</p>
                 </div>
              </div>
           </div>
           
           <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl opacity-50 group-hover:scale-150 transition-transform duration-1000" />
        </div>

        {/* Mission Info Grid */}
        <div className="grid grid-cols-2 gap-6">
           <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-[#5A57FF]">
                    <MapPin className="w-4 h-4" />
                 </div>
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zone Location</p>
                    <p className="text-sm font-bold text-[#1A1A3D]">Zone 4 · Hebbal North</p>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                    <FileText className="w-4 h-4" />
                 </div>
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Need Type</p>
                    <p className="text-sm font-bold text-[#1A1A3D]">Medical Supplies</p>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                    <AlertTriangle className="w-4 h-4" />
                 </div>
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority</p>
                    <p className="text-sm font-bold text-[#1A1A3D]">Critical Response</p>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                    <Clock className="w-4 h-4" />
                 </div>
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Duration</p>
                    <p className="text-sm font-bold text-[#1A1A3D]">45 Minutes</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Empathy Brief Card */}
        <div className="bg-[#F3F2FF] border border-indigo-100 rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden">
           <div className="flex items-center gap-3 text-[#5A57FF] relative z-10">
              <Sparkles className="w-6 h-6" />
              <h3 className="text-xl font-bold uppercase tracking-widest">Your Mission Brief</h3>
           </div>
           
           <div className="space-y-6 relative z-10">
              <p className="text-lg text-slate-600 leading-relaxed font-medium italic">
                 "The community in District 4 has been without medical access for 12 hours. The shelter manager, Maria, is expecting these supplies to stabilize three elderly residents. Prioritize the Insulin cold-packs."
              </p>
              
              <div className="flex flex-wrap gap-4">
                 <Badge className="bg-white text-indigo-600 border-none px-4 py-1.5 rounded-xl font-bold text-xs ring-1 ring-indigo-100">Language: Kannada</Badge>
                 <Badge className="bg-white text-indigo-600 border-none px-4 py-1.5 rounded-xl font-bold text-xs ring-1 ring-indigo-100 italic">Tone: Reassuring</Badge>
              </div>

              <button className="text-[11px] font-black text-[#5A57FF] uppercase tracking-widest flex items-center gap-2 group">
                 Read full Empathy Engine brief <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
           </div>
           <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-[#5A57FF]/5 rounded-full blur-2xl" />
        </div>

        {/* Navigation Card */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-indigo-500/5 p-8 flex flex-col md:flex-row gap-8 items-center">
           <div className="w-full md:w-1/3 h-44 rounded-3xl overflow-hidden relative group shrink-0">
              <img src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=400" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-indigo-500/10 group-hover:bg-indigo-500/0 transition-colors" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                 <Navigation2 className="w-8 h-8 text-[#5A57FF] fill-current" />
              </div>
           </div>
           
           <div className="flex-1 space-y-6">
              <div className="space-y-1">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Destination Address</p>
                 <p className="text-lg font-bold text-[#1A1A3D]">Grand Central Junction, Sector 7G, Hebbal</p>
              </div>
              <div className="flex items-center gap-8">
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-[#10B981] uppercase tracking-widest">Distance</p>
                    <p className="text-xl font-black text-[#1A1A3D]">2.1 KM</p>
                 </div>
                 <div className="w-px h-10 bg-slate-100" />
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">ETA</p>
                    <p className="text-xl font-black text-[#1A1A3D]">8 MINS</p>
                 </div>
              </div>
              <Button className="w-full h-14 bg-[#5A57FF] hover:bg-[#4845E0] rounded-2xl font-bold flex gap-2 shadow-lg shadow-indigo-100">
                 <Navigation className="w-4 h-4" /> Open in Google Maps
              </Button>
           </div>
        </div>

        {/* Field Update Section */}
        <div className="bg-white rounded-[2rem] p-10 border border-slate-100 shadow-sm space-y-8">
           <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-[#1A1A3D]">Log a Field Update</h3>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                 <button className="px-5 py-2.5 rounded-xl bg-white text-[#5A57FF] font-bold text-xs flex items-center gap-2 shadow-sm"><Mic className="w-3.5 h-3.5" /> Voice</button>
                 <button className="px-5 py-2.5 rounded-xl text-slate-400 font-bold text-xs flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Text</button>
              </div>
           </div>

           <Textarea 
             placeholder="What's happening on ground..." 
             className="min-h-[140px] rounded-3xl bg-slate-50 border-transparent text-slate-600 font-medium p-8 focus:bg-white focus:ring-2 focus:ring-[#5A57FF]/10"
           />

           <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Quick Status</p>
              <div className="flex flex-wrap gap-4">
                 {["Arrived", "In Progress", "Issue Found", "Done"].map((s) => (
                    <button 
                      key={s}
                      onClick={() => setStatus(s as any)}
                      className={cn(
                        "px-6 py-3 rounded-2xl text-xs font-bold transition-all border shadow-sm",
                        status === s 
                          ? "bg-[#5A57FF] text-white border-[#5A57FF]" 
                          : "bg-white text-slate-500 border-slate-100 hover:border-indigo-100"
                      )}
                    >
                       {s}
                    </button>
                 ))}
              </div>
           </div>

           <Button className="w-full h-16 bg-gradient-to-r from-[#5A57FF] to-indigo-600 rounded-[1.5rem] font-bold text-lg shadow-xl shadow-indigo-500/10">
              Submit Intelligence Update
           </Button>
        </div>
      </div>

      {/* RIGHT COLUMN - Timeline & Close Mission */}
      <div className="lg:w-[40%] space-y-8">
        
        {/* Update Timeline Card */}
        <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm h-fit">
           <div className="flex items-center justify-between mb-10">
              <h4 className="text-xl font-bold text-[#1A1A3D]">Mission Timeline</h4>
              <Badge variant="outline" className="text-[9px] font-black tracking-widest uppercase border-slate-200 text-[#5A57FF]/60 px-3 flex items-center gap-1.5">
                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> Real-time Feed
              </Badge>
           </div>
           
           <div className="space-y-2">
              <UpdateRow time="14:32:05" status="Dispatched" text="Inventory Dispatched: Medical kits K-19 through K-24 scanned and loaded." type="system" />
              <UpdateRow time="14:40:12" status="Geofence" text="Geofence Entered: Worker entered high-priority Sector 7G." type="system" />
              <UpdateRow time="14:45:55" status="Voice Note" text="'Traffic dense at North intersection. Re-routing via 4th Ave.'" type="field" />
              <div className="flex gap-4 relative">
                 <div className="w-6 h-6 rounded-full border-2 border-slate-100 flex items-center justify-center shrink-0 z-10 bg-white">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                 </div>
                 <div className="space-y-1 pt-0.5">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Waiting...</p>
                    <p className="text-xs font-bold text-slate-300">Delivery Confirmation</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Close Mission or Done State */}
        {status === "Done" ? (
           <div className="bg-emerald-500 rounded-[2.5rem] p-10 text-white shadow-xl shadow-emerald-500/20 space-y-8 animate-in zoom-in duration-500">
              <div className="space-y-2">
                 <h4 className="text-2xl font-bold">Ready to close this mission?</h4>
                 <p className="text-emerald-50 font-medium italic opacity-80">Complete final logs and finalize session</p>
              </div>
              
              <div className="space-y-6 pt-4">
                 <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Outcome Selector</p>
                    <div className="grid grid-cols-1 gap-3">
                       {["Completed successfully", "Partially complete", "Could not complete"].map((v, i) => (
                          <div key={i} className="bg-white/10 border border-white/20 p-5 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-white/20 transition-colors">
                             <span className="text-xs font-bold">{v}</span>
                             <div className="w-5 h-5 rounded-full border-2 border-white/30" />
                          </div>
                       ))}
                    </div>
                 </div>
                 
                 <Button className="w-full h-16 bg-white text-emerald-600 hover:bg-emerald-50 rounded-2xl font-bold text-lg flex gap-2">
                    Close Mission <Check className="w-6 h-6" />
                 </Button>
              </div>
           </div>
        ) : (
           <div className="p-2">
              <Button variant="outline" className="w-full h-16 border-red-100 hover:bg-red-50 text-red-500 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex gap-3 shadow-none">
                 <AlertTriangle className="w-5 h-5" /> Report Safety Issue / Emergency
              </Button>
           </div>
        )}

      </div>
    </div>
  );
};