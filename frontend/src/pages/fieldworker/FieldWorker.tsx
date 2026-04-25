import React, { useRef, useState, useEffect } from "react";
import { 
  Bell, 
  MapPin, 
  Wifi, 
  WifiOff, 
  Navigation, 
  Sun,
  ChevronRight,
  Database,
  CheckCircle2,
  Loader2,
  Smartphone,
  Sparkles,
  Mic,
  Zap,
  Camera,
  Moon,
  Coffee
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScanSurvey } from "@/components/fieldworker/ScanSurvey";
import { VoiceReport } from "@/components/fieldworker/VoiceReport";
import { MyReports } from "@/components/fieldworker/MyReports";
import { ActiveMission } from "@/components/fieldworker/ActiveMission";
import { FieldWorkerProfile } from "@/components/fieldworker/FieldWorkerProfile";
import { GlobalSidebar } from "@/components/nexus/GlobalSidebar";
import { useFieldworkerLiveTranslation } from "@/hooks/use-fieldworker-live-translation";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSidebarStore } from "@/hooks/use-sidebar-store";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";

// Helper to format timestamps to "2m ago", "Just now", etc.
const formatTimeAgo = (dateString: string) => {
  if (!dateString) return "Unknown";
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
};

const FieldWorker = () => {
    const translationContainerRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();

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
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [uiLanguage, setUiLanguage] = useState(() => localStorage.getItem("nexus_fieldworker_language") || "en");

  // Auth User & Dashboard Content
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [activeMission, setActiveMission] = useState<any | null>(null);
  const [sessionStartReports, setSessionStartReports] = useState<number | null>(null);
  const [networkInfo, setNetworkInfo] = useState({
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    label: "Unknown",
  });
  const [storageUsagePercent, setStorageUsagePercent] = useState<number>(0);
  const [stats, setStats] = useState({
    activeMissions: 0,
    pendingSyncs: 0,
    totalReports: 0,
    points: 12.8,
    zone: "Bengaluru South"
  });

  const hasActiveMission = Boolean(activeMission?.id);

  const handleNavigateToMission = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!hasActiveMission) {
      setActiveTab("Active");
      return;
    }

    const locationData = activeMission?.location || {};
    const lat = Number(locationData?.lat);
    const lng = Number(locationData?.lng);
    const address = String(locationData?.address || "").trim();
    const destination = Number.isFinite(lat) && Number.isFinite(lng)
      ? `${lat},${lng}`
      : address || activeMission?.zoneName || "";

    if (!destination) {
      setActiveTab("Active");
      return;
    }

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
  const token = localStorage.getItem("nexus_access_token");

  useFieldworkerLiveTranslation({
    containerRef: translationContainerRef,
    apiBaseUrl,
    token,
    language: uiLanguage,
    enabled: activeTab === "Dashboard",
    refreshKey: activeTab,
  });

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch Stats
      const statsRes = await fetch(`${apiBaseUrl}/fieldworker/stats`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      // 2. Fetch Recent Reports (Operations Log)
      const reportsRes = await fetch(`${apiBaseUrl}/fieldworker/reports`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (reportsRes.ok) {
        const data = await reportsRes.json();
        setLogs(data.reports.slice(0, 3));
      }

      const missionRes = await fetch(`${apiBaseUrl}/fieldworker/mission/active`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (missionRes.ok) {
        const missionData = await missionRes.json();
        setActiveMission(missionData.mission || null);
      }
    } catch (err) {
      console.error("Dashboard sync error:", err);
    }
  };

  const refreshDeviceHealth = async () => {
    const navAny = navigator as any;
    const connection = navAny.connection || navAny.mozConnection || navAny.webkitConnection;
    const effectiveType = connection?.effectiveType ? String(connection.effectiveType).toUpperCase() : null;
    setNetworkInfo({
      online: navigator.onLine,
      label: navigator.onLine ? (effectiveType || "ONLINE") : "OFFLINE",
    });

    if (navigator.storage?.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usage = Number(estimate.usage || 0);
        const quota = Number(estimate.quota || 0);
        if (quota > 0) {
          setStorageUsagePercent(Math.min(100, Math.round((usage / quota) * 100)));
        }
      } catch {
        setStorageUsagePercent(0);
      }
    }
  };

  useEffect(() => {
    // Initial Load
    const storedUser = localStorage.getItem("nexus_user");
    if (storedUser) setUser(JSON.parse(storedUser));
    
    fetchDashboardData();
    refreshDeviceHealth();

    // Synchronization Listener
    const handleSync = () => {
      const updated = localStorage.getItem("nexus_user");
      if (updated) setUser(JSON.parse(updated));
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('userUpdate', handleSync);

    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 60000);

    const onlineHandler = () => refreshDeviceHealth();
    const offlineHandler = () => refreshDeviceHealth();
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);

    const navAny = navigator as any;
    const connection = navAny.connection || navAny.mozConnection || navAny.webkitConnection;
    connection?.addEventListener?.("change", refreshDeviceHealth);

    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('userUpdate', handleSync);
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
      connection?.removeEventListener?.("change", refreshDeviceHealth);
    };
  }, []);

  // Force refresh when coming back to dashboard
  useEffect(() => {
    if (activeTab === "Dashboard") {
      fetchDashboardData();
      const intervalId = window.setInterval(fetchDashboardData, 15000);
      return () => window.clearInterval(intervalId);
    }
  }, [activeTab]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Good morning", icon: <Coffee className="w-5 h-5 text-amber-500" /> };
    if (hour < 17) return { text: "Good afternoon", icon: <Sun className="w-5 h-5 text-orange-500" /> };
    return { text: "Good evening", icon: <Moon className="w-5 h-5 text-indigo-400" /> };
  };

  const greeting = getGreeting();
  const firstName = user?.name?.split(" ")[0] || "there";
  const syncRate = logs.length > 0
    ? Math.round((logs.filter((log) => (log.status || "synced").toLowerCase() === "synced").length / logs.length) * 100)
    : 100;
  const reportsDelta = sessionStartReports === null ? 0 : Math.max(0, stats.totalReports - sessionStartReports);
  const missionLocation = activeMission?.location || {};
  const missionLat = Number(missionLocation?.lat);
  const missionLng = Number(missionLocation?.lng);
  const missionAddress = String(missionLocation?.address || "").trim();
  const hasMissionCoords = Number.isFinite(missionLat) && Number.isFinite(missionLng) && Math.abs(missionLat) > 0.000001 && Math.abs(missionLng) > 0.000001;
  const hasMissionLocation = hasMissionCoords || Boolean(missionAddress);
  const missionMapUrl = hasMissionCoords
    ? `https://www.google.com/maps?q=${encodeURIComponent(`${missionLat},${missionLng}`)}&z=15&output=embed`
    : missionAddress
      ? `https://www.google.com/maps?q=${encodeURIComponent(missionAddress)}&z=15&output=embed`
      : "";

  useEffect(() => {
    if (sessionStartReports === null && stats.totalReports >= 0) {
      setSessionStartReports(stats.totalReports);
    }
  }, [stats.totalReports, sessionStartReports]);

  const languageOptions = [
    { code: "en", label: "English" },
    { code: "hi", label: "Hindi" },
    { code: "kn", label: "Kannada" },
    { code: "te", label: "Telugu" },
    { code: "ta", label: "Tamil" },
    { code: "bn", label: "Bengali" },
    { code: "mr", label: "Marathi" },
  ];

  const handleLanguageChange = (value: string) => {
    setUiLanguage(value);
    localStorage.setItem("nexus_fieldworker_language", value);
  };

  return (
    <div ref={translationContainerRef} className="flex min-h-screen bg-[#F8F9FE] font-['Plus_Jakarta_Sans'] overflow-x-hidden text-[#1A1A3D]">
      
      <GlobalSidebar 
        role="fieldworker" 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />

      {/* MAIN CONTENT */}
      <motion.main 
        initial={false}
        animate={{ marginLeft: isMobile ? 0 : isOpen ? 64 : 0 }}
        transition={{ type: "tween", duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="flex-1 flex flex-col overflow-hidden pb-20 lg:pb-0"
      >
        
        <header className="h-16 bg-white border-b border-slate-100 px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
             <div className="w-1 h-6 bg-[#5A57FF] rounded-full" />
             <h2 className="font-bold text-[#1A1A3D] text-sm sm:text-base">
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
                <span className="text-[11px] font-bold uppercase tracking-widest italic">{stats.zone || "N/A"} · Station {user?.id?.slice(-2) || "01"}</span>
             </div>
             <button className="relative w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-[#5A57FF] transition-all">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white" />
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-[#F8F9FE]">
          <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-10">
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
                        <h1 className="text-3xl sm:text-4xl lg:text-[2.5rem] font-bold text-[#1A1A3D] tracking-tight leading-tight">
                          {greeting.text}, {firstName}
                        </h1>
                        <p className="text-sm sm:text-base lg:text-lg text-slate-500 mt-1 font-medium">
                          {stats.activeMissions} active mission{stats.activeMissions !== 1 ? 's' : ''} · {stats.pendingSyncs} pending sync{stats.pendingSyncs !== 1 ? 's' : ''} in {stats.zone}
                        </p>
                     </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div data-no-translate="true" className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm min-w-0 sm:min-w-[190px] w-full sm:w-auto">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Language</p>
                        <Select value={uiLanguage} onValueChange={handleLanguageChange}>
                          <SelectTrigger className="h-10 rounded-xl border-slate-100 text-sm font-semibold">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            {languageOptions.map((option) => (
                              <SelectItem key={option.code} value={option.code}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        </div>

                      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center gap-4 w-full sm:w-auto">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Local Time</p>
                          <p className="text-lg font-bold text-[#1A1A3D]">{currentTime}</p>
                        </div>
                        <div className="w-px h-8 bg-slate-100" />
                        <div className="flex items-center gap-2">
                          {greeting.icon}
                          <span className={cn("text-sm font-bold", networkInfo.online ? "text-[#10B981]" : "text-red-500")}>
                            {networkInfo.online ? "Online" : "Offline"}
                          </span>
                        </div>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div 
                      onClick={() => setActiveTab("Scan")}
                      className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-100 hover:border-[#5A57FF]/30 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group cursor-pointer relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Sparkles className="w-6 h-6 text-[#5A57FF]" />
                      </div>
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-[#F3F2FF] flex items-center justify-center text-[#5A57FF] mb-6 sm:mb-8 group-hover:scale-110 transition-transform shadow-sm">
                        <Camera className="w-8 h-8" />
                      </div>
                      <div className="space-y-3 mb-8">
                        <h4 className="text-xl sm:text-2xl font-bold text-[#1A1A3D]">Scan Survey</h4>
                        <p className="text-sm text-slate-500 leading-relaxed font-medium">Digitize handwritten census forms instantly using AI OCR. Supports Kannada & Hindi.</p>
                      </div>
                      <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                         <span className="text-[11px] font-black text-[#5A57FF] uppercase tracking-[0.2em]">Start Scanning</span>
                         <div className="w-8 h-8 rounded-full bg-[#5A57FF] flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform">
                            <ChevronRight className="w-4 h-4" />
                         </div>
                      </div>
                    </div>

                    <div 
                       onClick={() => setActiveTab("Voice")}
                       className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-100 hover:border-amber-200 hover:shadow-xl hover:shadow-amber-50 transition-all group cursor-pointer relative overflow-hidden"
                    >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-amber-50 flex items-center justify-center text-amber-500 mb-6 sm:mb-8 group-hover:scale-110 transition-transform shadow-sm">
                    <Mic className="w-8 h-8" />
                  </div>
                  <div className="space-y-3 mb-8">
                    <h4 className="text-xl sm:text-2xl font-bold text-[#1A1A3D]">Voice Memo</h4>
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

                <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 lg:p-10 shadow-sm border border-slate-100 min-h-0">
                 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 sm:mb-10">
                   <div>
                     <h3 className="text-xl sm:text-2xl font-bold text-[#1A1A3D]">Operations Log</h3>
                      <p className="text-sm text-slate-400 font-medium mt-1">Your recent field submissions and status</p>
                   </div>
                   <button onClick={() => setActiveTab("Reports")} className="text-[11px] font-black uppercase tracking-widest text-[#5A57FF] px-5 py-2 rounded-xl bg-[#F3F2FF] hover:bg-[#E0E7FF] transition-colors self-start sm:self-auto">History</button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-none">
                        <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Log Method</th>
                        <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Need Category</th>
                        <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Status</th>
                        <th className="pb-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {logs.length > 0 ? logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                          <td className="py-6 font-bold text-[#5A57FF] group-hover:underline text-[11px] flex items-center gap-3">
                             <div className="p-2 rounded-lg bg-indigo-50/50 text-[#5A57FF]">
                                {log.inputType === "voice" ? <Mic className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                             </div>
                             #{log.id.slice(-6).toUpperCase()}
                          </td>
                          <td className="py-6">
                             <div className="space-y-0.5">
                                <p className="font-bold text-[#1A1A3D] text-sm">{log.needType || "General Report"}</p>
                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{log.zoneId || "Sector A"}</p>
                             </div>
                          </td>
                          <td className="py-6">
                            <div className="flex justify-center">
                               <Badge className={cn(
                                "border-none text-[8px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full",
                                log.status === "synced" ? "bg-emerald-100 text-[#10B981]" :
                                log.status === "needs_review" ? "bg-amber-50 text-amber-500" :
                                "bg-indigo-50 text-[#5A57FF]"
                              )}>
                                {log.status || "Synced"}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-6 text-[11px] font-bold text-slate-400 text-right uppercase tracking-wider truncate">
                            {formatTimeAgo(log.createdAt)}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={4} className="py-20 text-center">
                             <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                                   <Database className="w-6 h-6 text-slate-300" />
                                </div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No reports submitted yet</p>
                             </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <aside className="w-full lg:w-[340px] space-y-6 lg:space-y-8">
               
              <div className="bg-gradient-to-br from-[#4F46E5] to-[#3730A3] rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 text-white shadow-xl overflow-hidden relative group">
                  <div className="relative z-10 space-y-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Session Contribution</p>
                    <div>
                       <h3 className="text-5xl font-black">{stats.points.toFixed(1)}</h3>
                       <p className="text-[11px] font-bold mt-2 text-[#10B981] flex items-center gap-1">
                          +{reportsDelta} report{reportsDelta !== 1 ? "s" : ""} this session
                       </p>
                    </div>
                    <div className="pt-6 border-t border-white/10 flex justify-between">
                       <div className="text-center px-4 border-r border-white/10 flex-1">
                          <p className="text-[9px] font-black opacity-40 uppercase">Logs</p>
                          <p className="text-xl font-black">{stats.totalReports.toString().padStart(2, '0')}</p>
                       </div>
                       <div className="text-center px-4 flex-1">
                          <p className="text-[9px] font-black opacity-40 uppercase">Sync</p>
                          <p className="text-xl font-black">{syncRate}%</p>
                       </div>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:scale-150 transition-transform duration-1000" />
               </div>

               <div 
                 onClick={() => setActiveTab("Active")}
                 className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6 relative overflow-hidden group cursor-pointer"
               >
                  <div className="flex items-center justify-between">
                     <div className="space-y-1">
                        <Badge className={cn(
                          "border-none font-black text-[9px] tracking-widest uppercase px-3 py-1",
                          hasActiveMission ? "bg-[#10B981] text-white" : "bg-slate-100 text-slate-400"
                        )}>
                          {hasActiveMission ? "Active Now" : "No Mission"}
                        </Badge>
                        <h4 className="text-xl font-bold text-[#1A1A3D]">{activeMission?.title || "No Active Mission"}</h4>
                     </div>
                     <MapPin className="w-5 h-5 text-slate-300 group-hover:text-[#5A57FF] transition-colors" />
                  </div>

                  <div className="h-44 bg-[#F8FAFF] rounded-[2rem] relative overflow-hidden border border-slate-100">
                    {hasActiveMission && missionMapUrl ? (
                      <iframe
                        title="Active mission map"
                        src={missionMapUrl}
                        className="absolute inset-0 h-full w-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-slate-50 opacity-50" />
                        <div className="absolute inset-0 flex items-center justify-center">
                           <div className="relative">
                              {hasActiveMission && <div className="absolute -inset-6 bg-[#10B981]/10 rounded-full animate-ping" />}
                              <div className={cn(
                                "w-5 h-5 rounded-full border-4 border-white shadow-lg",
                                hasActiveMission ? "bg-[#10B981] shadow-[0_0_20px_rgba(16,185,129,0.5)]" : "bg-slate-300 shadow-none"
                              )} />
                           </div>
                        </div>
                      </>
                    )}
                     <div className="absolute bottom-4 left-4 right-4 bg-white/80 backdrop-blur-sm p-3 rounded-2xl border border-white/50 shadow-sm flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#1A1A3D]">
                          {hasMissionLocation ? "Live mission location" : "Location unavailable"}
                        </span>
                        <div className="flex gap-1">
                          <div className={cn("w-1 h-1 rounded-full", hasActiveMission ? "bg-[#10B981]" : "bg-slate-200")} />
                          <div className={cn("w-1 h-1 rounded-full", hasActiveMission ? "bg-[#10B981]" : "bg-slate-200")} />
                          <div className={cn("w-1 h-1 rounded-full", hasActiveMission ? "bg-[#10B981]" : "bg-slate-200")} />
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <Button
                        onClick={handleNavigateToMission}
                        className="bg-[#F3F2FF] hover:bg-[#E0E7FF] text-[#5A57FF] font-bold text-[10px] uppercase tracking-widest h-12 rounded-[1.2rem] flex items-center gap-2 border-none"
                      >
                        <Navigation className="w-3.5 h-3.5" /> Navigate
                     </Button>
                     <Button
                        onClick={(event) => {
                         event.stopPropagation();
                         setActiveTab(hasActiveMission ? "Active" : "Reports");
                        }}
                       className="bg-[#1A1A3D] hover:bg-[#2A2665] text-white font-bold text-[10px] uppercase tracking-widest h-12 rounded-[1.2rem] flex items-center gap-2 border-none"
                     >
                         {hasActiveMission ? "Resume" : "History"}
                     </Button>
                  </div>
               </div>

              <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Device Health</p>
                  
                  <div className="space-y-6">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-11 h-11 rounded-2xl bg-[#F0FDF4] flex items-center justify-center text-[#10B981]">
                              {networkInfo.online ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5 text-red-500" />}
                           </div>
                           <div className="space-y-0.5">
                              <p className="text-sm font-bold text-[#1A1A3D]">{networkInfo.online ? "Connected" : "Offline"}</p>
                              <p className="text-[10px] font-medium text-slate-400">{networkInfo.label}</p>
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
                          <span className="text-[#1A1A3D]">{storageUsagePercent}% utilized</span>
                        </div>
                        <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                          <div className="h-full bg-[#5A57FF] rounded-full" style={{ width: `${storageUsagePercent}%` }} />
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
