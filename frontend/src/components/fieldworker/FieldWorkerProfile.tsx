import React, { useState } from "react";
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
  Database
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
  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* LEFT COLUMN - Identity Card */}
      <div className="lg:w-[320px] space-y-8 shrink-0">
        
        <div className="bg-white rounded-[3rem] p-10 border border-slate-50 shadow-xl shadow-indigo-500/5 text-center space-y-8 relative overflow-hidden">
           <div className="relative w-40 h-40 mx-auto group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#5A57FF] to-purple-600 rounded-[2.5rem] rotate-6 group-hover:rotate-12 transition-transform duration-500" />
              <div className="absolute inset-0 bg-white rounded-[2.5rem] overflow-hidden border-2 border-slate-100 relative shadow-sm">
                 <img src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=200&h=200" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-emerald-500 border-4 border-white flex items-center justify-center text-white shadow-lg">
                 <CheckCircle2 className="w-5 h-5" />
              </div>
           </div>
           
           <div className="space-y-3">
              <div className="flex flex-col items-center gap-2">
                 <h2 className="text-3xl font-black text-[#1A1A3D] tracking-tight">Ravi Kumar</h2>
                 <Badge className="bg-amber-500 text-white border-none font-black text-[9px] tracking-[0.2em] uppercase px-4 py-1.5 h-6">Field Worker</Badge>
              </div>
              <p className="text-xs font-bold text-slate-400 flex items-center justify-center gap-1.5 uppercase tracking-widest">
                 <MapPin className="w-3.5 h-3.5" /> Bengaluru South Hub
              </p>
           </div>
           
           <div className="pt-8 border-t border-slate-50 grid grid-cols-2 gap-4">
              <div className="text-center">
                 <p className="text-2xl font-black text-[#1A1A3D]">124</p>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reports</p>
              </div>
              <div className="w-px h-8 bg-slate-100 mx-auto self-center" />
              <div className="text-center">
                 <p className="text-2xl font-black text-[#1A1A3D]">38</p>
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
                    <span className="text-xs font-bold text-[#1A1A3D]">Sector 7G — Central</span>
                 </div>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-400">Hebbal North Buffer</span>
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
        
        {/* Personal info */}
        <SettingCard 
          title="Personal Information" 
          icon={User} 
          action={<Button variant="ghost" className="text-[#5A57FF] font-bold text-xs flex gap-2 h-10 px-5 rounded-xl hover:bg-indigo-50"><Edit3 className="w-4 h-4" /> Edit Profile</Button>}
        >
           <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</Label>
                 <div className="flex items-center gap-3 bg-slate-50 px-5 h-14 rounded-2xl border border-transparent">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-bold text-[#1A1A3D]">ravi.kumar@globalrelief.org</span>
                 </div>
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone Number</Label>
                 <div className="flex items-center gap-3 bg-slate-50 px-5 h-14 rounded-2xl border border-transparent">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-bold text-[#1A1A3D]">+91 99827 41203</span>
                 </div>
              </div>
           </div>
        </SettingCard>

        {/* Language Preferences */}
        <SettingCard title="Reporting Languages" icon={Languages}>
           <div className="space-y-6">
              <div className="space-y-3">
                 <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Voice Languages</Label>
                 <div className="flex flex-wrap gap-3">
                    {["Kannada (Native)", "Hindi (Professional)", "English (Conversational)"].map((lang) => (
                       <Badge key={lang} className="bg-indigo-100 text-[#5A57FF] border-none px-4 py-2 font-bold text-xs rounded-xl">{lang}</Badge>
                    ))}
                    <button className="h-9 px-4 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 font-bold text-xs hover:border-indigo-200 hover:text-[#5A57FF] transition-all flex items-center gap-2">
                       + Add New
                    </button>
                 </div>
              </div>
           </div>
        </SettingCard>

        {/* Notifications */}
        <SettingCard title="Notification Preferences" icon={Bell}>
           <div className="space-y-6">
              {[
                { title: "Emergency Alerts", desc: "Push & SMS for zone emergencies", icon: CloudLightning, color: "text-red-500", bg: "bg-red-50", active: true },
                { title: "New Missions Assigned", desc: "Instantly notify for field dispatch", icon: Zap, color: "text-[#10B981]", bg: "bg-emerald-50", active: true },
                { title: "Sync Status Reports", desc: "Daily summary of uploaded intelligence", icon: Database, color: "text-indigo-500", bg: "bg-indigo-50", active: false }
              ].map((item) => (
                <div key={item.title} className="flex items-center justify-between p-6 bg-slate-50/50 rounded-2xl border border-slate-50 group hover:border-indigo-100 transition-all">
                   <div className="flex items-center gap-5">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", item.bg, item.color)}>
                         <item.icon className="w-6 h-6" />
                      </div>
                      <div className="space-y-0.5">
                         <h4 className="font-bold text-[#1A1A3D] text-sm">{item.title}</h4>
                         <p className="text-xs text-slate-400 font-medium">{item.desc}</p>
                      </div>
                   </div>
                   <Switch defaultChecked={item.active} />
                </div>
              ))}
           </div>
        </SettingCard>

        {/* Offline Cache & Session */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <SettingCard title="Offline Mode" icon={WifiOff}>
              <div className="space-y-6">
                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="space-y-0.5">
                       <p className="text-xs font-bold text-[#1A1A3D]">Auto-Sync Reports</p>
                       <p className="text-[10px] text-slate-400 font-medium">When back online</p>
                    </div>
                    <Switch defaultChecked />
                 </div>
                 <div className="flex flex-col gap-3">
                    <button className="w-full h-14 bg-indigo-50 text-[#5A57FF] font-bold text-xs rounded-2xl border border-indigo-100 flex items-center justify-center gap-3 group">
                       <MapPin className="w-4 h-4 group-hover:scale-110 transition-transform" /> Manage Map Cache
                    </button>
                    <p className="text-[9px] text-center font-bold text-slate-400 uppercase tracking-widest">Current cache: 1.2GB (3 regions)</p>
                 </div>
              </div>
           </SettingCard>
           
           <SettingCard title="Active Session" icon={Smartphone}>
              <div className="space-y-6">
                 <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                       <p className="text-xs font-bold text-emerald-900">iPhone 15 Pro - Chicago</p>
                       <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest">Last synced 2m ago</p>
                    </div>
                 </div>
                 <Button variant="outline" className="w-full h-14 border-red-100 text-red-500 hover:bg-red-50 font-black text-[10px] uppercase tracking-widest gap-2 rounded-2xl">
                    <LogOut className="w-4 h-4" /> Terminate Session
                 </Button>
              </div>
           </SettingCard>
        </div>

      </div>

    </div>
  );
};