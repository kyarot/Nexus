import React, { useState, useEffect } from "react";
import { 
  Bell, 
  MapPin, 
  Cloud, 
  Wifi, 
  WifiOff, 
  Navigation, 
  Plus,
  Sun,
  ChevronRight,
  Database,
  CheckCircle2,
  Loader2,
  Smartphone,
  Sparkles,
  Mic,
  Zap,
  User,
  Camera
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScanSurvey } from "@/components/fieldworker/ScanSurvey";
import { VoiceReport } from "@/components/fieldworker/VoiceReport";
import { MyReports } from "@/components/fieldworker/MyReports";
import { ActiveMission } from "@/components/fieldworker/ActiveMission";
import { FieldWorkerProfile } from "@/components/fieldworker/FieldWorkerProfile";
import { GlobalSidebar } from "@/components/nexus/GlobalSidebar";
import { useSidebarStore } from "@/hooks/use-sidebar-store";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";

const FieldWorker = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes("scan")) return "Scan";
    if (path.includes("voice")) return "Voice";
    if (path.includes("reports")) return "Reports";
    if (path.includes("active")) return "Active";
    if (path.includes("profile")) return "Profile";
    return "Dashboard";
  };
  
  const activeTab = getActiveTab();
  const setActiveTab = (tab: string) => {
    if (tab === "Dashboard") navigate("/fieldworker");
    else if (tab === "Scan") navigate("/fieldworker/scan");
    else if (tab === "Voice") navigate("/fieldworker/voice");
    else if (tab === "Reports") navigate("/fieldworker/reports");
    else if (tab === "Active") navigate("/fieldworker/active");
    else if (tab === "Profile") navigate("/fieldworker/profile");
  };

  const { isOpen } = useSidebarStore();
  const [online, setOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(3);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  const reports = [
    { id: "LOG-ZA21", type: "Home Survey", zone: "Zone A", status: "Synced", color: "success", time: "2m ago" },
    { id: "LOG-BC44", type: "Health Audit", zone: "Zone C", status: "Queued", color: "warning", time: "15m ago" },
    { id: "LOG-FF89", type: "Quick Log", zone: "Zone A", status: "Processing", color: "default", time: "Just now" },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex h-screen bg-[#F8F9FE] font-['Plus_Jakarta_Sans'] overflow-hidden text-[#1A1A3D]">
      
      <GlobalSidebar 
        role="fieldworker" 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />

      {/* MAIN CONTENT */}
      <motion.main 
        initial={false}
        animate={{ marginLeft: isOpen ? 64 : 0 }}
        transition={{ type: "tween", duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="flex-1 flex flex-col overflow-hidden pb-20 lg:pb-0"
      >
        
        <header className="h-16 bg-white border-b border-slate-100 px-8 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
             <div className="w-1 h-6 bg-[#5A57FF] rounded-full" />
             <h2 className="font-bold text-[#1A1A3D]">
                {activeTab === "Scan" ? "Scan Survey" : 
                 activeTab === "Voice" ? "Voice Feed" : 
                 activeTab === "Reports" ? "Intelligence History" :
                 activeTab === "Active" ? "Active Mission" :
                 activeTab === "Profile" ? "My Profile" :
                 "Field Dashboard"}
             </h2>
          </div>

          <div className="flex items-center gap-4">
             <div className="hidden sm:flex items-center gap-2 bg-[#F3F2FF] text-[#5A57FF] px-4 py-1.5 rounded-full border border-indigo-100 shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-[#5A57FF] animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-widest italic">Hebbal Zone · Station 04</span>
             </div>
             <button className="relative w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-[#5A57FF] transition-all">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white" />
             </button>
             <Button className="h-10 px-6 bg-[#5A57FF] hover:bg-[#4845E0] text-white font-bold text-xs rounded-2xl shadow-lg shadow-indigo-100 flex gap-2">
               <Plus className="w-4 h-4" /> Quick Log
             </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-[#F8F9FE]">
          <div className="max-w-[1400px] mx-auto p-4 lg:p-10">
            {activeTab === "Scan" ? (
              <ScanSurvey onGoToDashboard={() => setActiveTab("Dashboard")} />
            ) : activeTab === "Voice" ? (
              <VoiceReport onGoToDashboard={() => setActiveTab("Dashboard")} />
            ) : activeTab === "Reports" ? (
              <MyReports onNewReport={() => setActiveTab("Scan")} />
            ) : activeTab === "Active" ? (
              <ActiveMission />
            ) : activeTab === "Profile" ? (
              <FieldWorkerProfile />
            ) : (
              <div className="flex flex-col lg:flex-row gap-10">
                <div className="flex-1 space-y-10">
                  
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                     <div>
                        <h1 className="text-[2.5rem] font-bold text-[#1A1A3D] tracking-tight leading-tight">Good morning, Ravi</h1>
                        <p className="text-lg text-slate-500 mt-1 font-medium">1 active mission · 3 pending syncs in Bengaluru South</p>
                     </div>
                     <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center gap-4">
                        <div className="text-right">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Local Time</p>
                           <p className="text-lg font-bold text-[#1A1A3D]">{currentTime}</p>
                        </div>
                        <div className="w-px h-8 bg-slate-100" />
                        <div className="flex items-center gap-2">
                           <Sun className="w-5 h-5 text-amber-500" />
                           <span className="text-sm font-bold text-[#10B981]">28°C</span>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div 
                      onClick={() => setActiveTab("Scan")}
                      className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 hover:border-[#5A57FF]/30 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group cursor-pointer relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Sparkles className="w-6 h-6 text-[#5A57FF]" />
                      </div>
                      <div className="w-16 h-16 rounded-3xl bg-[#F3F2FF] flex items-center justify-center text-[#5A57FF] mb-8 group-hover:scale-110 transition-transform shadow-sm">
                        <Camera className="w-8 h-8" />
                      </div>
                      <div className="space-y-3 mb-8">
                        <h4 className="text-2xl font-bold text-[#1A1A3D]">Scan Survey</h4>
                        <p className="text-sm text-slate-500 leading-relaxed font-medium">Digitize handwritten census forms instantly using AI OCR. Supports Kannada & Hindi.</p>
                      </div>
                      <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                         <span className="text-[11px] font-black text-[#5A57FF] uppercase tracking-[0.2em]">Start Scanning</span>
                         <div className="w-8 h-8 rounded-full bg-[#5A57FF] flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform">
                            <ChevronRight className="w-4 h-4" />
                         </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 hover:border-amber-200 hover:shadow-xl hover:shadow-amber-50 transition-all group cursor-pointer relative overflow-hidden">
                  <div className="w-16 h-16 rounded-3xl bg-amber-50 flex items-center justify-center text-amber-500 mb-8 group-hover:scale-110 transition-transform shadow-sm">
                    <Mic className="w-8 h-8" />
                  </div>
                  <div className="space-y-3 mb-8">
                    <h4 className="text-2xl font-bold text-[#1A1A3D]">Voice Memo</h4>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">Record field insights in any tone. Nexus auto-transcribes and categorizes impact data.</p>
                  </div>
                   <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                     <span className="text-[11px] font-black text-amber-500 uppercase tracking-[0.2em]">Record Now</span>
                     <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform">
                        <ChevronRight className="w-4 h-4" />
                     </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-10">
                   <div>
                      <h3 className="text-2xl font-bold text-[#1A1A3D]">Operations Log</h3>
                      <p className="text-sm text-slate-400 font-medium mt-1">Your recent field submissions and status</p>
                   </div>
                   <button className="text-[11px] font-black uppercase tracking-widest text-[#5A57FF] px-6 py-2 rounded-xl bg-[#F3F2FF] hover:bg-[#E0E7FF] transition-colors">History</button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-none">
                        <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Log ID</th>
                        <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Type</th>
                        <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Status</th>
                        <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {reports.map((report) => (
                        <tr key={report.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                          <td className="py-6 font-bold text-[#5A57FF] group-hover:underline text-sm">{report.id}</td>
                          <td className="py-6">
                             <div className="space-y-0.5">
                                <p className="font-bold text-[#1A1A3D] text-sm">{report.type}</p>
                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{report.zone}</p>
                             </div>
                          </td>
                          <td className="py-6">
                            <div className="flex justify-center">
                               <Badge className={cn(
                                "border-none text-[8px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full",
                                report.color === "success" ? "bg-emerald-100 text-[#10B981]" :
                                report.color === "warning" ? "bg-amber-50 text-amber-500" :
                                "bg-indigo-50 text-[#5A57FF] animate-pulse"
                              )}>
                                {report.status}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-6 text-[11px] font-bold text-slate-400 text-right uppercase tracking-wider">{report.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <aside className="w-full lg:w-[340px] space-y-8">
               
               <div className="bg-gradient-to-br from-[#4F46E5] to-[#3730A3] rounded-[2.5rem] p-8 text-white shadow-xl overflow-hidden relative group">
                  <div className="relative z-10 space-y-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Session Contribution</p>
                    <div>
                       <h3 className="text-5xl font-black">12.8</h3>
                       <p className="text-[11px] font-bold mt-2 text-[#10B981] flex items-center gap-1">
                          +0.4 points since login
                       </p>
                    </div>
                    <div className="pt-6 border-t border-white/10 flex justify-between">
                       <div className="text-center px-4 border-r border-white/10 flex-1">
                          <p className="text-[9px] font-black opacity-40 uppercase">Logs</p>
                          <p className="text-xl font-black">04</p>
                       </div>
                       <div className="text-center px-4 flex-1">
                          <p className="text-[9px] font-black opacity-40 uppercase">Sync</p>
                          <p className="text-xl font-black">88%</p>
                       </div>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:scale-150 transition-transform duration-1000" />
               </div>

               <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-6 relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                     <div className="space-y-1">
                        <Badge className="bg-[#10B981] text-white border-none font-black text-[9px] tracking-widest uppercase px-3 py-1">Active Now</Badge>
                        <h4 className="text-xl font-bold text-[#1A1A3D]">Sector 7 Audit</h4>
                     </div>
                     <MapPin className="w-5 h-5 text-slate-300 group-hover:text-[#5A57FF] transition-colors" />
                  </div>

                  <div className="h-44 bg-[#F8FAFF] rounded-[2rem] relative overflow-hidden border border-slate-100">
                     <div className="absolute inset-0 bg-slate-50 opacity-50" />
                     <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative">
                           <div className="absolute -inset-6 bg-[#10B981]/10 rounded-full animate-ping" />
                           <div className="w-5 h-5 rounded-full bg-[#10B981] shadow-[0_0_20px_rgba(16,185,129,0.5)] border-4 border-white" />
                        </div>
                     </div>
                     <div className="absolute bottom-4 left-4 right-4 bg-white/80 backdrop-blur-sm p-3 rounded-2xl border border-white/50 shadow-sm flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#1A1A3D]">Location accuracy ± 2m</span>
                        <div className="flex gap-1">
                           <div className="w-1 h-1 bg-[#10B981] rounded-full" />
                           <div className="w-1 h-1 bg-[#10B981] rounded-full" />
                           <div className="w-1 h-1 bg-[#10B981] rounded-full" />
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <Button className="bg-[#F3F2FF] hover:bg-[#E0E7FF] text-[#5A57FF] font-bold text-[10px] uppercase tracking-widest h-12 rounded-[1.2rem] flex items-center gap-2 border-none">
                        <Navigation className="w-3.5 h-3.5" /> Navigate
                     </Button>
                     <Button className="bg-[#1A1A3D] hover:bg-[#2A2665] text-white font-bold text-[10px] uppercase tracking-widest h-12 rounded-[1.2rem] flex items-center gap-2 border-none">
                         Resume
                     </Button>
                  </div>
               </div>

               <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Device Health</p>
                  
                  <div className="space-y-6">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-11 h-11 rounded-2xl bg-[#F0FDF4] flex items-center justify-center text-[#10B981]">
                             <Wifi className="w-5 h-5" />
                           </div>
                           <div className="space-y-0.5">
                              <p className="text-sm font-bold text-[#1A1A3D]">Signal Boosted</p>
                              <p className="text-[10px] font-medium text-slate-400">LTE-A 104Mb/s</p>
                           </div>
                        </div>
                         <div className="flex gap-0.5">
                            <div className="w-1 h-3 bg-[#10B981] rounded-full" />
                            <div className="w-1 h-4 bg-[#10B981] rounded-full" />
                            <div className="w-1 h-5 bg-[#10B981] rounded-full" />
                         </div>
                     </div>

                     <div className="space-y-3 pt-6 border-t border-slate-50">
                        <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                           <span>Local Storage</span>
                           <span className="text-[#1A1A3D]">14% utilized</span>
                        </div>
                        <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                           <div className="h-full bg-[#5A57FF] rounded-full" style={{ width: '14%' }} />
                        </div>
                     </div>
                  </div>
               </div>

            </aside>
              </div>
            )}
          </div>
        </div>
      </motion.main>
    </div>
  );
};

export default FieldWorker;
