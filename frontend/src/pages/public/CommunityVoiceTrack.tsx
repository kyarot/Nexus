import React, { useState } from "react";
import { 
  Search, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  ArrowLeft,
  Shield,
  Activity,
  AlertTriangle,
  Send,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const StatusStep = ({ status, time, event, description, active, completed }: { status: string, time: string, event: string, description: string, active?: boolean, completed?: boolean }) => (
  <div className="flex gap-4 group">
    <div className="flex flex-col items-center">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500",
        completed ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20" :
        active ? "bg-white border-[#4F46E5] text-[#4F46E5] ring-4 ring-indigo-50 animate-pulse" :
        "bg-white border-slate-200 text-slate-300"
      )}>
        {completed ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
      </div>
      <div className={cn("w-0.5 flex-1 my-2 transition-colors duration-500", completed ? "bg-emerald-500" : "bg-slate-100")} />
    </div>
    <div className="flex-1 pb-10">
      <div className="flex justify-between items-baseline mb-1">
        <h4 className={cn("text-base font-bold", active || completed ? "text-[#1A1A3D]" : "text-slate-400")}>{event}</h4>
        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{time}</span>
      </div>
      <p className="text-sm text-slate-500 font-medium leading-relaxed">{description}</p>
      {active && (
        <Badge className="mt-3 bg-indigo-50 text-[#4F46E5] border-none font-bold text-[10px] uppercase tracking-widest py-1 px-3">
          Latest Update
        </Badge>
      )}
    </div>
  </div>
);

export const CommunityVoiceTrack = () => {
  const [refId, setRefId] = useState("");
  const [showStatus, setShowStatus] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (refId.trim()) setShowStatus(true);
  };

  return (
    <div className="min-h-screen bg-[#F8F7FF] flex flex-col font-['Plus_Jakarta_Sans'] p-6">
      <header className="max-w-4xl mx-auto w-full pt-10 pb-16 space-y-8">
        <button 
          onClick={() => window.location.href = "/community-voice"}
          className="flex items-center gap-2 text-slate-400 hover:text-[#4F46E5] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[11px] font-black uppercase tracking-widest">Back to Reporting</span>
        </button>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-[#1A1A3D]">Track Your Request</h1>
          <p className="text-slate-500 font-medium text-lg">Enter your reference code to see real-time updates on your assistance request.</p>
        </div>

        <form onSubmit={handleSearch} className="relative group">
           <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
              <Search className="w-6 h-6 text-slate-300 group-focus-within:text-[#4F46E5] transition-colors" />
           </div>
           <Input 
             value={refId}
             onChange={(e) => setRefId(e.target.value)}
             placeholder="Enter Reference Number (e.g. #NCH-2847)"
             className="h-20 pl-16 pr-40 bg-white border-slate-100 rounded-[2rem] text-2xl font-mono font-black placeholder:font-sans placeholder:font-medium placeholder:text-slate-300 shadow-2xl shadow-indigo-500/5 focus:ring-4 focus:ring-indigo-100 transition-all border-2 focus:border-[#4F46E5]"
           />
           <Button 
             type="submit"
             disabled={!refId}
             className="absolute right-3 top-3 bottom-3 px-8 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-black rounded-2xl shadow-lg ring-offset-0 focus:ring-0 uppercase tracking-widest disabled:opacity-50 disabled:bg-slate-300"
           >
             Check Status
           </Button>
        </form>
      </header>

      <main className="max-w-4xl mx-auto w-full flex-1 pb-20">
        {showStatus ? (
          <div className="grid md:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Status Summary Card */}
            <div className="md:col-span-1 space-y-6">
               <Card className="p-8 rounded-[2.5rem] bg-[#1E1B4B] text-white border-0 shadow-2xl shadow-indigo-900/20 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                     <Shield className="w-24 h-24" />
                  </div>
                  <div className="relative space-y-6">
                    <Badge className="bg-emerald-500 text-white border-none font-bold text-[10px] uppercase tracking-widest px-3 py-1">
                       Active Response
                    </Badge>
                    <div>
                       <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest leading-none mb-2">REFERENCE CODE</p>
                       <p className="text-3xl font-mono font-black">{refId.startsWith('#') ? refId : `#${refId}`}</p>
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest leading-none mb-2">RESPONSE TEAM</p>
                       <p className="text-lg font-bold">Hebbal North NGO Unit</p>
                    </div>
                  </div>
               </Card>

               <div className="p-6 bg-white rounded-3xl border border-slate-100 space-y-4">
                  <div className="flex items-center gap-3">
                     <Activity className="w-4 h-4 text-emerald-500" />
                     <p className="text-xs font-black text-slate-400 uppercase tracking-widest">REAL-TIME STATUS</p>
                  </div>
                  <div className="space-y-4">
                     <div className="flex justify-between items-center text-sm font-bold text-[#1A1A3D]">
                        <span className="text-slate-500">Urgency</span>
                        <span className="text-amber-500">High Priority</span>
                     </div>
                     <div className="flex justify-between items-center text-sm font-bold text-[#1A1A3D]">
                        <span className="text-slate-500">Problem</span>
                        <span>Food Distribution</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Timeline Area */}
            <div className="md:col-span-2">
               <Card className="p-10 rounded-[2.5rem] bg-white border-slate-100 shadow-xl shadow-indigo-500/5">
                  <div className="mb-10 flex items-center justify-between">
                     <h2 className="text-2xl font-bold text-[#1A1A3D]">Response Timeline</h2>
                     <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest group cursor-help">
                        Updates in real-time <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
                     </div>
                  </div>
                  
                  <div className="relative">
                    <StatusStep 
                       event="Team Dispatched"
                       time="10:45 AM"
                       status="Dispatched"
                       description="A volunteer team from CareNet (NGO) has been dispatched to your area with food supplies."
                       active={true}
                    />
                    <StatusStep 
                       event="Merged into Mission M-047"
                       time="09:20 AM"
                       status="Grouped"
                       description="Similar reports were found in your area. Your request has been grouped for a larger distribution mission."
                       completed={true}
                    />
                    <StatusStep 
                       event="Verified by NGO Coordinator"
                       time="08:55 AM"
                       status="Verified"
                       description="Regional coordinator Sarah has verified the need and flagged it for immediate action."
                       completed={true}
                    />
                    <StatusStep 
                       event="Report Logged"
                       time="08:42 AM"
                       status="Logged"
                       description="Your report was successfully received and categorized by the NEXUS Empathy Engine."
                       completed={true}
                    />
                  </div>
                  
                  <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
                       If situation worsens or you need to add details, you can submit a new report using the same phone number for automatic linking.
                    </p>
                  </div>
               </Card>
            </div>
          </div>
        ) : (
          <div className="min-h-[400px] flex flex-col items-center justify-center text-center space-y-6">
             <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-slate-200 border border-slate-100 shadow-sm animate-in fade-in zoom-in duration-500">
                <Send className="w-8 h-8" />
             </div>
             <p className="text-slate-400 font-medium max-w-xs uppercase tracking-widest text-[11px]">Enter a reference number above to view the live timeline of activity</p>
          </div>
        )}
      </main>

      <footer className="p-8 text-center border-t border-slate-50 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
         &copy; 2026 NEXUS PROTOCOL &middot; PUBLIC ASSISTANCE PORTAL
      </footer>
    </div>
  );
};
