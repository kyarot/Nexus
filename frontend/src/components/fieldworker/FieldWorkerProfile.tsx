import React, { useState, useEffect, useRef } from "react";
import { 
  User, 
  MapPin, 
  Globe, 
  Bell, 
  Settings, 
  LogOut, 
  Edit3, 
  Phone, 
  Mail, 
  Languages, 
  Trash2, 
  History,
  FileText,
  Zap,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  Wifi,
  WifiOff,
  CloudLightning,
  Database,
  Camera,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ProfileStat = ({ label, value, icon: Icon }: { label: string, value: string | number, icon: any }) => (
  <div className="bg-white rounded-[2.5rem] p-8 border border-slate-50 flex items-center justify-between shadow-sm flex-1">
    <div className="space-y-1">
       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{label}</p>
       <p className="text-3xl font-black text-[#1A1A3D]">{value}</p>
    </div>
    <div className="w-12 h-12 rounded-2xl bg-[#F3F2FF] flex items-center justify-center text-[#5A57FF]">
       <Icon className="w-6 h-6" />
    </div>
  </div>
);

const SettingCard = ({ title, children, icon: Icon, action }: { title: string, children: React.ReactNode, icon: any, action?: React.ReactNode }) => (
  <div className="bg-white rounded-[2.5rem] p-10 border border-slate-50 shadow-sm space-y-8 relative overflow-hidden group">
    <div className="flex items-center justify-between relative z-10">
       <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F3F2FF] flex items-center justify-center text-[#5A57FF]">
             <Icon className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold text-[#1A1A3D]">{title}</h3>
       </div>
       {action && <div className="z-10">{action}</div>}
    </div>
    <div className="relative z-10">{children}</div>
    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/20 rounded-full -mr-16 -mt-16 blur-3xl" />
  </div>
);

export const FieldWorkerProfile = () => {
  const [user, setUser] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [stats, setStats] = useState({
    activeMissions: 0,
    totalReports: 0,
    points: 12.8,
    zone: "N/A"
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
  const token = localStorage.getItem("nexus_access_token");

  useEffect(() => {
    const storedUser = localStorage.getItem("nexus_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    const fetchStats = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/fieldworker/stats`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setStats({
            activeMissions: data.activeMissions,
            totalReports: data.totalReports,
            points: data.points,
            zone: data.zone
          });
        }
      } catch (err) {
        console.error("Failed to fetch profile stats", err);
      }
    };

    fetchStats();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${apiBaseUrl}/fieldworker/profile/image`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        const updatedUser = { ...user, photoUrl: data.photoUrl };
        setUser(updatedUser);
        localStorage.setItem("nexus_user", JSON.stringify(updatedUser));
        // Force header update and same-window sync
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('userUpdate'));
      }
    } catch (err) {
      console.error("Avatar upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* LEFT COLUMN - Identity Card */}
      <div className="lg:w-[320px] space-y-8 shrink-0">
        
        <div className="bg-white rounded-[3rem] p-10 border border-slate-50 shadow-xl shadow-indigo-500/5 text-center space-y-8 relative overflow-hidden">
           <div className="relative w-40 h-40 mx-auto group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#5A57FF] to-purple-600 rounded-[2.5rem] rotate-6 group-hover:rotate-12 transition-transform duration-500" />
              
              {/* Profile Image Container */}
              <div 
                className="absolute inset-0 bg-white rounded-[2.5rem] overflow-hidden border-2 border-slate-100 relative shadow-sm cursor-pointer group/avatar"
                onClick={() => fileInputRef.current?.click()}
              >
                  {isUploading ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                       <Loader2 className="w-8 h-8 text-[#5A57FF] animate-spin" />
                    </div>
                  ) : (
                    <>
                      <img 
                        src={user?.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'User'}`} 
                        className="w-full h-full object-cover transition-all group-hover/avatar:scale-110 group-hover/avatar:blur-[2px]" 
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                         <Camera className="w-10 h-10 text-white drop-shadow-lg" />
                      </div>
                    </>
                  )}
              </div>
              
              {/* Hidden File Input */}
              <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef} 
                accept="image/*"
                onChange={handleImageUpload}
              />

              <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-emerald-500 border-4 border-white flex items-center justify-center text-white shadow-lg">
                  <CheckCircle2 className="w-5 h-5" />
              </div>
           </div>
           
           <div className="space-y-3">
              <div className="flex flex-col items-center gap-2">
                 <h2 className="text-3xl font-black text-[#1A1A3D] tracking-tight">{user?.name || "Field Worker"}</h2>
                 <Badge className="bg-amber-500 text-white border-none font-black text-[9px] tracking-[0.2em] uppercase px-4 py-1.5 h-6">Verified Personnel</Badge>
              </div>
              <p className="text-xs font-bold text-slate-400 flex items-center justify-center gap-1.5 uppercase tracking-widest">
                 <MapPin className="w-3.5 h-3.5" /> {stats.zone || user?.zone || "Central Hub"}
              </p>
           </div>
           
           <div className="pt-8 border-t border-slate-50 grid grid-cols-2 gap-4">
              <div className="text-center">
                 <p className="text-2xl font-black text-[#1A1A3D]">{stats.totalReports}</p>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reports</p>
              </div>
              <div className="w-px h-8 bg-slate-100 mx-auto self-center" />
              <div className="text-center">
                 <p className="text-2xl font-black text-[#1A1A3D]">{stats.activeMissions}</p>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Missions</p>
              </div>
           </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-50 shadow-sm space-y-6">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Assigned Area</p>
           <div className="flex flex-col gap-2">
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-[#5A57FF]" />
                    <span className="text-xs font-bold text-[#1A1A3D]">{stats.zone || user?.zone}</span>
                 </div>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-400">Regional Node {user?.id?.slice(-2) || "A"}</span>
                 </div>
              </div>
           </div>
           <Button variant="ghost" className="w-full h-12 text-[#5A57FF] font-bold text-[10px] uppercase tracking-widest gap-2">
              Request Zone Change <ChevronRight className="w-3 h-3" />
           </Button>
        </div>

      </div>

      {/* RIGHT COLUMN - Settings */}
      <div className="flex-1 space-y-8">
        
        {/* Statistics cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <ProfileStat label="Mission Points" value={stats.points?.toFixed(1) || "0.0"} icon={Zap} />
           <ProfileStat label="Active Success" value="98%" icon={CheckCircle2} />
        </div>

        {/* Personal info */}
        <SettingCard 
          title="Personal Information" 
          icon={User} 
          action={<Button variant="ghost" className="text-[#5A57FF] font-bold text-xs flex gap-2 h-10 px-5 rounded-xl hover:bg-indigo-50"><Edit3 className="w-4 h-4" /> Edit Profile</Button>}
        >
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</Label>
                 <div className="flex items-center gap-3 bg-slate-50 px-5 h-14 rounded-2xl border border-transparent">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-bold text-[#1A1A3D] truncate">{user?.email || "loading..."}</span>
                 </div>
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nexus Worker ID</Label>
                 <div className="flex items-center gap-3 bg-slate-50 px-5 h-14 rounded-2xl border border-transparent">
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-bold text-[#1A1A3D]">FW-{user?.id?.slice(-8) || "000000"}</span>
                 </div>
              </div>
           </div>
        </SettingCard>

        {/* Language Preferences */}
        <SettingCard title="Operational Languages" icon={Languages}>
           <div className="space-y-6">
              <div className="space-y-3">
                 <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transcribing For {stats.zone || "Zone"}</Label>
                 <div className="flex flex-wrap gap-3">
                    <Badge className="bg-indigo-100 text-[#5A57FF] border-none px-4 py-2 font-bold text-xs rounded-xl">English (Standard)</Badge>
                    <Badge className="bg-indigo-100 text-[#5A57FF] border-none px-4 py-2 font-bold text-xs rounded-xl">Local Dialect (Primary)</Badge>
                    <button className="h-9 px-4 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 font-bold text-xs hover:border-indigo-200 hover:text-[#5A57FF] transition-all flex items-center gap-2">
                       + Add New
                    </button>
                 </div>
              </div>
           </div>
        </SettingCard>

        {/* Notifications */}
        <SettingCard title="Incident Alerts" icon={Bell}>
           <div className="space-y-4">
              {[
                { title: "Emergency Broadcasts", desc: "Push & SMS for life-safety events", icon: CloudLightning, color: "text-red-500", bg: "bg-red-50", active: true },
                { title: "Mission Dispatches", desc: "Instantly notify for assigned field work", icon: Zap, color: "text-[#10B981]", bg: "bg-emerald-50", active: true },
                { title: "Report Sync Updates", desc: "confirmations for all field submissions", icon: Database, color: "text-indigo-500", bg: "bg-indigo-50", active: true }
              ].map((item) => (
                <div key={item.title} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100 group hover:border-indigo-100 transition-all">
                   <div className="flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", item.bg, item.color)}>
                         <item.icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-0.5">
                         <h4 className="font-bold text-[#1A1A3D] text-sm">{item.title}</h4>
                         <p className="text-[10px] text-slate-400 font-medium">{item.desc}</p>
                      </div>
                   </div>
                   <Switch defaultChecked={item.active} />
                </div>
              ))}
           </div>
        </SettingCard>

        {/* Offline Cache & Session */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <SettingCard title="Edge Cache" icon={WifiOff}>
              <div className="space-y-6">
                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="space-y-0.5">
                       <p className="text-xs font-bold text-[#1A1A3D]">Active Edge Sync</p>
                       <p className="text-[10px] text-slate-400 font-medium">Automatic background uploads</p>
                    </div>
                    <Switch defaultChecked />
                 </div>
                 <div className="flex flex-col gap-3">
                    <button className="w-full h-12 bg-indigo-50 text-[#5A57FF] font-bold text-xs rounded-2xl border border-indigo-100 flex items-center justify-center gap-3 group">
                       <MapPin className="w-4 h-4 group-hover:scale-110 transition-transform" /> Manage Zone Cache
                    </button>
                    <p className="text-[9px] text-center font-bold text-slate-400 uppercase tracking-widest italic">{stats.zone} Node Cache Active</p>
                 </div>
              </div>
           </SettingCard>
           
           <SettingCard title="Field Session" icon={Smartphone}>
              <div className="space-y-6">
                 <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                       <p className="text-xs font-bold text-emerald-900">Instance Active</p>
                       <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest">{user?.name?.split(" ")[0]}'s Device</p>
                    </div>
                 </div>
                 <Button variant="outline" className="w-full h-12 border-red-100 text-red-500 hover:bg-red-50 font-black text-[10px] uppercase tracking-widest gap-2 rounded-2xl" onClick={() => {
                   localStorage.removeItem("nexus_access_token");
                   localStorage.removeItem("nexus_user");
                   window.location.href = "/login";
                 }}>
                    <LogOut className="w-4 h-4" /> Terminate Session
                 </Button>
              </div>
           </SettingCard>
        </div>

      </div>

    </div>
  );
};