import { useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Clock, CheckCircle2, Leaf, Droplets, Languages, Utensils, ArrowRight, Bell, Target, Award, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VolunteerDashboard() {
  const [isAvailable, setIsAvailable] = useState(true);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F8F9FE]">
      <DashboardTopBar breadcrumb="Volunteer Dashboard" />
      
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Hero Greeting Card */}
          <div className="bg-gradient-to-br from-[#4F46E5] to-[#3730A3] rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 flex justify-between items-center">
              <div>
                <h1 className="text-[2rem] font-bold tracking-tight">Good morning, Priya!</h1>
                <p className="text-base opacity-80 mt-1 font-medium max-w-md">
                  Your contribution to the Hebbal community last week impacted 45 families.
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">Availability</span>
                <Switch 
                  checked={isAvailable} 
                  onCheckedChange={setIsAvailable}
                  className="data-[state=checked]:bg-[#10B981] h-7 w-12"
                />
              </div>
            </div>
            {/* Abstract background shapes */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* New Mission Priority Card */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-400" />
              <div className="flex items-center justify-between mb-4">
                <Badge className="bg-orange-50 text-orange-600 border-none font-black text-[9px] tracking-widest px-3 py-1 rounded-full">
                  NEW MISSION PRIORITY
                </Badge>
                <span className="text-[10px] font-bold text-slate-400">2m ago</span>
              </div>

              <h2 className="text-xl font-bold text-[#1A1A3D] mb-4">Hebbal North Food Distribution</h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-slate-500 font-bold text-xs">
                  <MapPin className="w-4 h-4 text-slate-300" />
                  Hebbal North Zone
                </div>
                <div className="flex items-center gap-3 text-slate-500 font-bold text-xs">
                  <Navigation className="w-4 h-4 text-slate-300" />
                  3.2 km away
                </div>
                <div className="flex items-center gap-3 text-slate-500 font-bold text-xs">
                  <Clock className="w-4 h-4 text-slate-300" />
                  4 Hours (Start 11:00 AM)
                </div>
              </div>

              <div className="flex gap-3">
                <Button className="flex-1 bg-[#5A57FF] hover:bg-[#4845E0] text-white font-bold py-5 rounded-xl shadow-lg shadow-indigo-50">
                  View Details
                </Button>
                <Button variant="secondary" className="bg-slate-50 text-slate-400 font-bold py-5 px-8 rounded-xl border-none hover:bg-slate-100 italic">
                  Decline
                </Button>
              </div>
            </div>

            {/* Mission in Progress Card */}
            <div className="bg-[#1A1A3D] rounded-[2rem] p-6 shadow-sm flex flex-col justify-between text-white relative">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#10B981]">Mission in Progress</span>
              </div>

              <div>
                <h2 className="text-xl font-bold mb-1">Education Outreach</h2>
                <p className="text-slate-400 text-sm font-medium">Marthahalli Community Center</p>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex -space-x-2">
                  <img src="https://i.pravatar.cc/150?u=1" className="w-8 h-8 rounded-full border-2 border-[#1A1A3D]" alt="v" />
                  <img src="https://i.pravatar.cc/150?u=2" className="w-8 h-8 rounded-full border-2 border-[#1A1A3D]" alt="v" />
                  <div className="w-8 h-8 rounded-full bg-[#3730A3] border-2 border-[#1A1A3D] flex items-center justify-center text-[9px] font-bold">+4</div>
                </div>
                <Button className="bg-white text-[#1A1A3D] hover:bg-slate-100 font-bold px-6 py-4 rounded-xl flex gap-1.5 text-xs">
                  <Navigation className="w-3.5 h-3.5" /> Navigate
                </Button>
              </div>
            </div>
          </div>

          {/* Recent Impact History */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#1A1A3D]">Recent Impact History</h2>
              <Button variant="ghost" className="text-[#5A57FF] font-black text-[10px] uppercase tracking-widest flex gap-2">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="space-y-3">
              {[
                { 
                  title: "Peer Mentorship Program", 
                  loc: "Whitefield • 3 days ago", 
                  status: "SUCCESS", 
                  quote: "Priya was exceptional in her communication.",
                  icon: Leaf,
                  bg: "bg-[#ECFDF5]",
                  textColor: "text-[#10B981]"
                },
                { 
                  title: "Clean Water Drive", 
                  loc: "Koramangala • 1 week ago", 
                  status: "SUCCESS", 
                  icon: Droplets,
                  bg: "bg-[#EFF6FF]",
                  textColor: "text-[#3B82F6]"
                }
              ].map((h, i) => (
                <div key={i} className="bg-white rounded-[1.5rem] p-4 shadow-sm border border-slate-50 relative group">
                  <div className="flex items-start gap-4">
                    <div className={cn("p-3 rounded-xl", h.bg)}>
                      <h.icon className={cn("w-5 h-5", h.textColor)} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <h3 className="text-base font-bold text-[#1A1A3D]">{h.title}</h3>
                        <Badge className="bg-[#10B981] text-white border-none font-black text-[8px] tracking-widest px-2">
                          {h.status}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium text-slate-400 mb-2">{h.loc}</p>
                      {h.quote && (
                        <div className="bg-[#F8F9FE] rounded-xl p-3 border border-slate-50 italic text-slate-500 font-medium text-xs leading-relaxed relative">
                          "{h.quote}"
                          <div className="absolute -left-px top-3 w-1 h-1/2 bg-[#5A57FF]/10 rounded-full" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Stats & DNA */}
        <div className="flex w-[350px] shrink-0 border-l border-slate-100 bg-[#FBFBFF] flex-col p-8 min-h-0 overflow-y-auto overflow-x-hidden">
          
          {/* Circular Metric */}
          <div className="text-center mb-10">
            <p className="text-[10px] font-black uppercase symbols tracking-[0.25em] text-slate-400 mb-6">Impact Summary</p>
            <div className="relative w-40 h-40 mx-auto">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="80" cy="80" r="70" stroke="#EEF0FF" strokeWidth="8" fill="transparent" />
                <circle 
                  cx="80" cy="80" r="70" stroke="#3730A3" strokeWidth="10" fill="transparent" 
                  strokeDasharray="440" strokeDashoffset="110"
                  strokeLinecap="round"
                  className="drop-shadow-[0_0_8px_rgba(55,48,163,0.2)]"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-[#1A1A3D]">12</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#3730A3] mt-0.5">Missions/Mo</span>
              </div>
            </div>
            <p className="mt-6 text-xs font-bold text-[#1A1A3D] flex items-center justify-center gap-2">
              <Target className="w-3.5 h-3.5 text-[#5A57FF]" /> Top 5% in Bengaluru
            </p>
          </div>

          {/* DNA Radar Chart */}
          <div className="mb-10">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-8">Impact DNA</p>
            <div className="relative w-full aspect-square flex items-center justify-center scale-100">
              {/* Background Hexagon Rings */}
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-[0.03]">
                <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="none" stroke="#1A1A3D" strokeWidth="1.5" />
              </svg>
              
              {/* Radar Data Shape */}
              <svg viewBox="0 0 100 100" className="w-[80%] h-[80%]">
                <polygon 
                  points="50,15 88,38 82,78 50,92 18,78 12,38" 
                  fill="rgba(90, 87, 255, 0.25)" 
                  stroke="#5A57FF" 
                  strokeWidth="2.5" 
                  strokeLinejoin="round"
                />
                <circle cx="50" cy="15" r="2" fill="#5A57FF" />
                <circle cx="88" cy="38" r="2" fill="#5A57FF" />
                <circle cx="82" cy="78" r="2" fill="#5A57FF" />
                <circle cx="50" cy="92" r="2" fill="#5A57FF" />
                <circle cx="18" cy="78" r="2" fill="#5A57FF" />
                <circle cx="12" cy="38" r="2" fill="#5A57FF" />
              </svg>

              {/* Labels */}
              <div className="absolute top-[-5px] text-[8px] font-black tracking-tighter text-slate-400">SKILL</div>
              <div className="absolute right-[-15px] top-[30%] text-[8px] font-black tracking-tighter text-slate-400">PROXIMITY</div>
              <div className="absolute right-[-15px] bottom-[25%] text-[8px] font-black tracking-tighter text-slate-400">EMOTIONAL</div>
              <div className="absolute bottom-[-5px] text-[8px] font-black tracking-tighter text-slate-400 uppercase">LANG</div>
              <div className="absolute left-[-15px] bottom-[25%] text-[8px] font-black tracking-tighter text-slate-400">SUCCESS</div>
              <div className="absolute left-[-15px] top-[30%] text-[8px] font-black tracking-tighter text-slate-400">AVAIL</div>
            </div>
          </div>

          {/* Verified Badges Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
              <p>Verified Badges</p>
              <Award className="w-3.5 h-3.5 text-slate-300" />
            </div>
            <div className="space-y-3">
              <div className="bg-white border text-xs border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                <div className="p-2 bg-amber-50 rounded-lg">
                  <Utensils className="w-4 h-4 text-amber-500" />
                </div>
                <span className="font-bold text-[#1A1A3D]">Food Expert</span>
              </div>
              <div className="bg-white border text-xs border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <Languages className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="font-bold text-[#1A1A3D]">Kannada Specialist</span>
              </div>
            </div>
          </div>

          {/* Burnout Risk Section */}
          <div className="mt-auto pt-6 border-t border-slate-100/50">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-3.5 h-3.5 text-slate-300" />
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Burnout Risk</p>
              </div>
              <span className="text-[8px] font-black text-[#10B981] uppercase tracking-widest px-2 py-0.5 bg-emerald-50 rounded-full">Low</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full mb-4 overflow-hidden">
              <div className="h-full w-1/4 bg-[#10B981] rounded-full" />
            </div>
            <div className="bg-[#5A57FF]/5 rounded-xl p-3 border border-[#5A57FF]/10">
              <p className="text-[9px] italic text-[#5A57FF] leading-relaxed font-bold">
                "Stable engagement patterns detected."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
