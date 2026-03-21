import React, { useState } from "react";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Languages, 
  Edit2, 
  Plus, 
  X, 
  Calendar, 
  Navigation, 
  Zap, 
  Bell, 
  ShieldCheck, 
  LogOut, 
  Trash2,
  Lock,
  Minus,
  Globe,
  ChevronRight,
  Monitor
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";

const VolunteerProfile = () => {
  const [isAvailable, setIsAvailable] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [radius, setRadius] = useState([12]);
  const [maxMissions, setMaxMissions] = useState(5);

  const stats = [
    { label: "Missions Completed", value: "28" },
    { label: "Success Rate", value: "89%" },
    { label: "Impact Points", value: "340" },
  ];

  const skills = [
    { name: "Food Distribution", color: "bg-[#FDF2E9] text-[#93522E]", dots: 3 },
    { name: "Mental Health First Aid", color: "bg-[#F5F3FF] text-[#4F46E5]", dots: 2 },
    { name: "Child Education", color: "bg-[#EFF6FF] text-[#1E40AF]", dots: 3 },
    { name: "Elder Care", color: "bg-[#F0FDF4] text-[#166534]", dots: 1 },
  ];

  const availability = [
    { day: "Mon - Fri", morning: false, afternoon: false, evening: true },
    { day: "Sat - Sun", morning: true, afternoon: true, evening: true },
  ];

  const intensityOptions = [
    { label: "Light", desc: "Socializing, distribution, logistics", color: "border-emerald-500 bg-emerald-50/30", iconColor: "bg-emerald-500" },
    { label: "Moderate", desc: "Teaching, basic advocacy, first-aid", color: "border-amber-500 bg-amber-50/30", iconColor: "bg-amber-500" },
    { label: "Intensive", desc: "Crisis management, trauma support", color: "border-red-500 bg-red-50/30", iconColor: "bg-red-500" },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-8 p-8 bg-[#F8F7FF] min-h-screen font-['Plus_Jakarta_Sans']">
      
      {/* LEFT COLUMN - PROFILE IDENTITY */}
      <div className="w-full lg:w-[380px] flex-shrink-0">
        <div className="bg-white rounded-[2rem] shadow-[0_4px_24px_rgba(79,70,229,0.08)] overflow-hidden border border-slate-100 flex flex-col min-h-[800px]">
          {/* Gradient Strip */}
          <div className="h-[120px] bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] w-full" />
          
          {/* Avatar Section */}
          <div className="px-8 -mt-10 relative flex flex-col items-center">
            <div className="w-[80px] h-[80px] rounded-full border-[3px] border-white shadow-lg overflow-hidden bg-white mb-4">
              <img 
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150" 
                alt="Priya" 
                className="w-full h-full object-cover"
              />
            </div>
            <h2 className="text-[20px] font-bold text-[#1A1A3D]">Priya Raghunathan</h2>
            <Badge className="mt-2 bg-[#4F46E5] text-white border-none py-1 px-4 rounded-full text-[10px] font-black uppercase tracking-widest ring-0">
              VOLUNTEER
            </Badge>
            <div className="flex items-center gap-1.5 mt-3 text-slate-400">
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-[13px] font-medium">Bengaluru · Hebbal Zone</span>
            </div>

            {/* Availability Toggle */}
            <div className="mt-8 w-full p-1 bg-slate-100 rounded-2xl flex relative cursor-pointer group" onClick={() => setIsAvailable(!isAvailable)}>
              <div className={cn(
                "flex-1 py-3 text-center rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 z-10",
                isAvailable ? "bg-[#9AF7C9] text-[#1B4D3E] shadow-sm" : "text-slate-400 group-hover:text-slate-600"
              )}>
                Available for Missions
              </div>
              <div className={cn(
                "flex-1 py-3 text-center rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 z-10",
                !isAvailable ? "bg-white text-slate-600 shadow-sm" : "text-slate-400 group-hover:text-slate-600"
              )}>
                Unavailable
              </div>
            </div>

            {/* Stats */}
            <div className="w-full mt-10 space-y-6">
              <div className="h-[1px] bg-slate-100 w-full" />
              <div className="flex justify-around text-center">
                {stats.map((s, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="text-[24px] font-black text-[#4F46E5] leading-none mb-1">{s.value}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.label.split(' ')[0]}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.label.split(' ')[1]}</span>
                  </div>
                ))}
              </div>
              <div className="h-[1px] bg-slate-100 w-full" />
            </div>

            {/* Languages */}
            <div className="w-full mt-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">LANGUAGES</p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-[#9AF7C9] text-[#1B4D3E] border-none px-3 py-1 rounded-full text-[11px] font-bold">Kannada</Badge>
                <Badge variant="outline" className="border-slate-200 text-slate-500 bg-transparent px-3 py-1 rounded-full text-[11px] font-bold">Hindi</Badge>
                <Badge variant="outline" className="border-slate-200 text-slate-500 bg-transparent px-3 py-1 rounded-full text-[11px] font-bold">English</Badge>
              </div>
            </div>

            <div className="mt-auto pt-10 pb-8 flex flex-col items-center w-full">
              <p className="text-[12px] text-slate-400 mb-6 italic">Member since March 2024</p>
              <Button variant="ghost" className="w-full border border-slate-200 rounded-xl text-[13px] font-bold text-[#1A1A3D] py-6 hover:bg-slate-50">
                Edit Profile
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - SETTINGS */}
      <div className="flex-1 space-y-6 pb-20">
        
        {/* CARD 1 - PERSONAL INFO */}
        <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-slate-100">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-[1.5rem] font-bold text-[#1A1A3D]">Personal Information</h3>
            <button className="flex items-center gap-2 text-[#4F46E5] font-bold text-sm hover:opacity-80 transition-opacity">
              Edit <Edit2 className="w-4 h-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-10 gap-x-12">
            {[
              { label: "FULL NAME", value: "Priya Raghunathan" },
              { label: "EMAIL ADDRESS", value: "priya.r@nexus.org" },
              { label: "PHONE NUMBER", value: "+91 98765 43210" },
              { label: "CITY", value: "Bengaluru" },
              { label: "WARD / ZONE", value: "Hebbal (Zone 4)" },
            ].map((f, i) => (
              <div key={i} className="flex flex-col gap-2">
                <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase">{f.label}</span>
                <span className="text-[15px] font-bold text-[#1A1A3D]">{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 2 - VOLUNTEER SKILLS */}
        <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-slate-100">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-[1.5rem] font-bold text-[#1A1A3D]">Volunteer Skills</h3>
            <button className="text-[#4F46E5] font-bold text-sm">Edit</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {skills.map((skill, i) => (
              <div key={i} className={cn("p-6 rounded-[1.5rem] flex items-center justify-between", skill.color)}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", skill.dots === 3 ? "bg-current" : "bg-current/40")} />
                    <span className="text-[15px] font-black tracking-tight">{skill.name}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map(dot => (
                      <div key={dot} className={cn(
                        "w-2.5 h-2.5 rounded-full transition-all",
                        dot <= skill.dots ? "bg-black/80" : "bg-black/10"
                      )} />
                    ))}
                  </div>
                </div>
                <X className="w-4 h-4 opacity-40 cursor-pointer hover:opacity-100" />
              </div>
            ))}
            <div className="border-2 border-dashed border-slate-200 p-6 rounded-[1.5rem] flex items-center justify-center gap-2 text-slate-400 font-bold text-sm cursor-pointer hover:bg-slate-50 transition-colors">
              <Plus className="w-5 h-5" /> Add new skill
            </div>
          </div>
        </div>

        {/* CARD 3 - AVAILABILITY WINDOWS */}
        <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-slate-100">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-[1.5rem] font-bold text-[#1A1A3D]">Availability Windows</h3>
            <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Max Missions/Week</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setMaxMissions(Math.max(0, maxMissions-1))} className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-[#4F46E5]"><Minus className="w-3 h-3" /></button>
                <span className="text-sm font-black text-[#4F46E5] w-4 text-center">0{maxMissions}</span>
                <button onClick={() => setMaxMissions(Math.min(7, maxMissions+1))} className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-[#4F46E5]"><Plus className="w-3 h-3" /></button>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="pb-6 text-left font-black">DAY</th>
                  <th className="pb-6 text-center font-black">MORNING</th>
                  <th className="pb-6 text-center font-black">AFTERNOON</th>
                  <th className="pb-6 text-center font-black">EVENING</th>
                </tr>
              </thead>
              <tbody className="space-y-4">
                {availability.map((row, i) => (
                  <tr key={i} className="group">
                    <td className="py-4 text-[15px] font-bold text-[#1A1A3D]">{row.day}</td>
                    <td className="py-4">
                      <div className="flex justify-center">
                        <Checkbox checked={row.morning} className="w-6 h-6 rounded-lg border-slate-200 data-[state=checked]:bg-[#4F46E5] data-[state=checked]:border-[#4F46E5]" />
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex justify-center">
                        <Checkbox checked={row.afternoon} className="w-6 h-6 rounded-lg border-slate-200 data-[state=checked]:bg-[#4F46E5] data-[state=checked]:border-[#4F46E5]" />
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex justify-center">
                        <Checkbox checked={row.evening} className="w-6 h-6 rounded-lg border-slate-200 data-[state=checked]:bg-[#4F46E5] data-[state=checked]:border-[#4F46E5]" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CARD 4 - TRAVEL PREFERENCES */}
        <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-slate-100 flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <h3 className="text-[1.5rem] font-bold text-[#1A1A3D] mb-10">Travel Preferences</h3>
            
            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-end mb-4">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">TRAVEL RADIUS</span>
                  <span className="text-[1.5rem] font-black text-[#4640DE]">{radius[0]} <span className="text-sm font-bold opacity-60">km</span></span>
                </div>
                <Slider 
                  value={radius} 
                  onValueChange={setRadius} 
                  max={25} 
                  min={1} 
                  step={1} 
                  className="[&_[role=slider]]:bg-[#4F46E5] [&_[role=slider]]:border-[#4F46E5]"
                />
                <div className="flex justify-between mt-2 text-[10px] font-black text-slate-300 tracking-widest">
                  <span>1KM</span>
                  <span>25KM</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-4">TRANSPORT MODES</span>
                <div className="flex flex-wrap gap-3">
                  {[
                    { icon: Zap, label: "Two Wheeler", active: true },
                    { icon: Monitor, label: "Public Transit" },
                    { icon: Navigation, label: "Walking" },
                  ].map((m, i) => (
                    <Badge key={i} className={cn(
                      "flex items-center gap-2 px-4 py-3 rounded-xl border transition-all cursor-pointer ring-0",
                      m.active ? "bg-[#4F46E5] text-white border-[#4F46E5]" : "bg-transparent text-slate-500 border-slate-200 hover:border-slate-300"
                    )}>
                      <m.icon className="w-4 h-4" />
                      <span className="text-xs font-black uppercase tracking-widest">{m.label}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Map Placeholder */}
          <div className="w-full md:w-[260px] h-[300px] bg-[#E0E7FF] rounded-[1.5rem] overflow-hidden relative shadow-inner">
             <div className="absolute inset-0 opacity-40 bg-[url('https://www.google.com/maps/vt/pb=!1m5!1m4!1i12!2i2365!2i1575!4i256!2m3!1e0!2sm!3i625206676!3m17!2sen!3sUS!5e18!12m4!1e68!2m2!1sset!2sRoadmap!12m3!1e37!2m1!1ssmartmaps!12m4!1e26!2m2!1s1i1!2s1!4e0!5m4!1e0!8m2!1i1100!2i1100!6m6!1e12!2i2!26b1!39b1!44e1!50e0!23i1301813')] bg-cover" />
             <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-32 h-32 bg-[#4F46E5]/10 border-2 border-[#4F46E5]/40 rounded-full animate-pulse flex items-center justify-center">
                 <div className="w-2 h-2 bg-[#4F46E5] rounded-full shadow-[0_0_10px_#4F46E5]" />
               </div>
             </div>
             <div className="absolute bottom-4 left-4 right-4 bg-white/80 backdrop-blur-sm p-3 rounded-xl border border-white/40">
                <p className="text-[10px] font-black text-[#1A1A3D] uppercase tracking-widest">Active Coverage</p>
                <p className="text-xs font-bold text-slate-500">12km around Hebbal</p>
             </div>
          </div>
        </div>

        {/* CARD 5 - EMOTIONAL CAPACITY */}
        <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-slate-100">
          <h3 className="text-[1.5rem] font-bold text-[#1A1A3D] mb-2">Emotional Capacity Settings</h3>
          <p className="text-sm text-slate-400 mb-10">Help us match you to missions that suit your wellbeing</p>
          
          <div className="space-y-10">
            <div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-6">PREFERRED MISSION INTENSITY</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {intensityOptions.map((opt, i) => (
                  <div key={i} className={cn(
                    "p-6 rounded-[1.5rem] border-2 transition-all cursor-pointer hover:shadow-md h-full flex flex-col",
                    opt.color
                  )}>
                    <div className={cn("w-10 h-1 rounded-full mb-6", opt.iconColor)} />
                    <h4 className="text-[18px] font-black text-[#1A1A3D] mb-2 tracking-tight">{opt.label}</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-bold uppercase tracking-tight">{opt.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-6">I PREFER NOT TO WORK WITH</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                {[
                  "Terminal Illness cases",
                  "Animal rescues",
                  "High-noise environments",
                  "Night-shift patrolling",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 group cursor-pointer">
                    <Checkbox id={`check-${i}`} className="w-6 h-6 rounded-lg border-slate-200 data-[state=checked]:bg-[#4F46E5] data-[state=checked]:border-[#4F46E5]" />
                    <label htmlFor={`check-${i}`} className="text-[14px] font-bold text-slate-600 group-hover:text-[#1A1A3D] transition-colors cursor-pointer">{item}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CARD 6 - NOTIFICATION PREFERENCES */}
        <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-slate-100">
          <h3 className="text-[1.5rem] font-bold text-[#1A1A3D] mb-10">Notification Preferences</h3>
          
          <div className="space-y-8">
            {[
              { title: "Push Notifications", desc: "Real-time alerts for urgent local missions", active: true },
              { title: "Email Digest", desc: "Weekly impact summary and scheduled events", active: true },
              { title: "SMS Alerts", desc: "Critical disaster-response coordination", active: false },
            ].map((notif, i) => (
              <div key={i} className="flex items-center justify-between pb-8 border-b border-slate-50 last:border-0 last:pb-0">
                <div>
                  <h4 className="text-[15px] font-black text-[#1A1A3D] mb-1">{notif.title}</h4>
                  <p className="text-[13px] text-slate-400 font-medium">{notif.desc}</p>
                </div>
                <Switch checked={notif.active} className="data-[state=checked]:bg-[#4F46E5]" />
              </div>
            ))}
          </div>
        </div>

        {/* CARD 7 - ACCOUNT & SECURITY */}
        <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-slate-100">
          <h3 className="text-[1.5rem] font-bold text-[#1A1A3D] mb-10">Account & Security</h3>
          
          <div className="space-y-10">
            <div className="flex items-center justify-between group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-[1rem] bg-[#F5F3FF] flex items-center justify-center text-[#4F46E5] group-hover:bg-[#4F46E5] group-hover:text-white transition-all">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[15px] font-black text-[#1A1A3D]">Password</h4>
                  <p className="text-[12px] text-slate-400 font-medium tracking-tight">Last changed 4 months ago</p>
                </div>
              </div>
              <button className="text-[13px] font-black text-[#4F46E5] uppercase tracking-widest">Update</button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-[1rem] bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-100">
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[15px] font-black text-[#1A1A3D]">Connected Google Account</h4>
                  <p className="text-[12px] text-slate-400 font-medium tracking-tight">priya.ragh@gmail.com</p>
                </div>
              </div>
              <button className="text-[13px] font-black text-slate-400 uppercase tracking-widest hover:text-[#4F46E5]">Disconnect</button>
            </div>

            <div className="pt-8 border-t border-slate-50 flex items-center justify-between">
              <Button variant="ghost" className="text-slate-400 hover:text-slate-600 font-bold p-0 bg-transparent flex gap-2">
                <LogOut className="w-4 h-4" /> Sign out of all devices
              </Button>
              <button className="text-[13px] font-black text-red-400 uppercase tracking-widest hover:text-red-600 transition-colors">
                Delete Account
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VolunteerProfile;