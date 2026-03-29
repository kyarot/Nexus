import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Info, 
  MapPin, 
  MessageSquare, 
  ShieldCheck, 
  Shield,
  Clock,
  Package,
  Box,
  Utensils,
  Plus,
  Truck,
  Wind,
  PlusCircle,
  Activity,
  Mic, 
  Navigation,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function EmpathyEngine() {
  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FE]">
      <DashboardTopBar breadcrumb="Mission / Briefing" />
      
      <div className="flex-1 p-6 space-y-6 flex flex-col">
        <header className="mb-0">
          <h1 className="text-[2rem] font-bold text-[#1A1A3D] tracking-tight">Pre-Mission Briefing</h1>
          <p className="text-slate-500 font-medium text-base">Cognitive readiness assessment for Mission ID: #ALPHA-772</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
          {/* Mission Context Card */}
          <div className="lg:col-span-2 bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-indigo-50 rounded-md">
                <MapPin className="w-5 h-5 text-[#4F46E5]" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Mission Context</span>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Zone</p>
                <p className="text-base font-bold text-[#1A1A3D]">Sector 4-G (Urban Edge)</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</p>
                <p className="text-base font-bold text-[#1A1A3D]">Displaced / 4 Members</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Language</p>
                <p className="text-base font-bold text-[#1A1A3D]">Modern Greek</p>
              </div>
            </div>

            <div className="bg-[#FBFBFF] rounded-xl p-4 border border-slate-50 relative">
              <h3 className="text-sm font-bold text-[#1A1A3D] mb-1">Recent Trigger Events</h3>
              <p className="text-slate-500 text-xs font-medium leading-relaxed">
                Family lost primary dwelling 48h ago. High cortisol in parents. Children show avoidant stress response.
              </p>
            </div>
          </div>

          {/* Side Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
            {/* Trust Level Card */}
            <div className="bg-[#9AF7C9] rounded-[2rem] p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#1A1A3D]/60">Trust</p>
                  <p className="text-[2rem] font-black text-[#1A1A3D]">84%</p>
                </div>
                <ShieldCheck className="w-6 h-6 text-[#1A1A3D] opacity-40" />
              </div>
            </div>

            {/* Empathy Pulse Card */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Pulse</p>
              <div className="flex items-end gap-1 h-12">
                {[30, 45, 60, 40, 75, 55, 45].map((h, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-2 rounded-full",
                      i === 4 ? "bg-[#4F46E5] h-full" : "bg-[#C7D2FE] h-[var(--height)]"
                    )}
                    style={{ '--height': `${h}%` } as any}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1 — ZONE SAFETY PROFILE */}
        <div className="bg-white rounded-[2rem] p-8 shadow-card border border-slate-50 space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-[#14532D]" />
              <h2 className="text-sm font-semibold text-[#1A1A3D]">Zone safety profile</h2>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-[#F0FDF4] rounded-full">
              <div className="w-2 h-2 rounded-full bg-[#14532D]" />
              <span className="text-xs font-medium text-[#14532D]">Safety 84/100 • Safe</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Based on 23 field worker interactions this week</span>
              <span className="text-[#14532D]">84% Secure</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#22C55E] rounded-full" style={{ width: '84%' }} />
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Past Interactions Timeline</p>
            <div className="space-y-3">
              {[
                { date: "Mar 12", note: "Medical delivery completed successfully", status: "success" },
                { date: "Mar 08", note: "Minor congestion at distribution point A", status: "warning" },
                { date: "Mar 03", note: "Night-shift patrol reported high noise levels", status: "warning" }
              ].map((row, i) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="text-[10px] font-bold text-slate-400 w-12">{row.date}</span>
                  <div className="flex-1 bg-[#F8F7FF] rounded-xl p-3 flex justify-between items-center">
                    <span className="text-xs font-medium text-[#1A1A3D]">{row.note}</span>
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      row.status === "success" ? "bg-green-500" : "bg-amber-500"
                    )} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#F0FDF4] rounded-xl text-[#14532D]">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold">Good time to visit — area active and safe right now</span>
            </div>
          </div>

          <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl space-y-2">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Specific notes for this visit</p>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-xs text-amber-900 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Building 3, 2nd floor — dog at entrance
              </li>
              <li className="flex items-center gap-2 text-xs text-amber-900 font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Water tank area — slippery in rain
              </li>
            </ul>
          </div>
        </div>

        {/* SECTION 2 — RESOURCES NEAR ZONE */}
        <div className="bg-white rounded-[2rem] p-8 shadow-card border border-slate-50 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Box className="w-5 h-5 text-[#4F46E5]" />
            </div>
            <h2 className="text-sm font-semibold text-[#1A1A3D]">Resources available near this zone</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-2">
            {[
              { 
                name: "Food packets", 
                qty: "24 food packets", 
                loc: "Point 4–G North", 
                contact: "ext. 402", 
                icon: Utensils, 
                color: "amber",
                status: "Available"
              },
              { 
                name: "First aid kit", 
                qty: "02 trauma kits", 
                loc: "Nexus Mobile Unit", 
                contact: "ext. 119", 
                icon: Activity, 
                color: "red",
                status: "Low stock"
              },
              { 
                name: "Blankets / warm clothing", 
                qty: "15 thermal blankets", 
                loc: "Sector 4 Hub", 
                contact: "ext. 004", 
                icon: Wind, 
                color: "blue",
                status: "Available"
              },
              { 
                name: "NGO vehicle available", 
                qty: "01 transport van", 
                loc: "Checkpoint 12", 
                contact: "Radio CH 4", 
                icon: Truck, 
                color: "green",
                status: "Available"
              }
            ].map((res, i) => (
              <div key={i} className="min-w-[240px] bg-white border border-slate-100 rounded-[1.25rem] p-5 space-y-4 relative shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    res.color === "amber" ? "bg-amber-100" : 
                    res.color === "red" ? "bg-red-100" : 
                    res.color === "blue" ? "bg-blue-100" : "bg-green-100"
                  )}>
                    <res.icon className={cn(
                      "w-5 h-5",
                      res.color === "amber" ? "text-amber-600" : 
                      res.color === "red" ? "text-red-600" : 
                      res.color === "blue" ? "text-blue-600" : "text-green-600"
                    )} />
                  </div>
                  <Badge variant="outline" className={cn(
                    "text-[10px] font-bold border-none px-2 py-0.5 rounded-full",
                    res.status === "Available" ? "text-green-600 bg-green-50" : "text-amber-600 bg-amber-50"
                  )}>
                    {res.status}
                  </Badge>
                </div>
                
                <div>
                  <p className="text-xs font-bold text-[#1A1A3D] mb-0.5">{res.name}</p>
                  <p className="text-sm font-black text-[#4F46E5]">{res.qty}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <MapPin className="w-3 h-3" />
                    <span className="text-[10px] font-medium">{res.loc}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Info className="w-3 h-3" />
                    <span className="text-[10px] font-medium">{res.contact}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 text-slate-400 pt-2">
            <Info className="w-4 h-4" />
            <p className="text-[11px] font-medium tracking-tight">Coordinator pre-selected resources for this mission</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 shrink-0">
          {/* What to Say First Card */}
          <div className="bg-[#4F46E5] rounded-[2rem] p-6 text-white shadow-md relative overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 opacity-70" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Say First</span>
            </div>
            <p className="text-base font-bold leading-tight mb-4 relative z-10">
              "I am here primarily to listen. We have resources for your safety, but first, I want to understand what your morning was like."
            </p>
            <div className="flex gap-2">
              <Badge className="bg-white/10 text-white border-none py-1 px-3 rounded-full text-[10px] font-bold">Supportive</Badge>
              <Badge className="bg-white/10 text-white border-none py-1 px-3 rounded-full text-[10px] font-bold">Low Pressure</Badge>
            </div>
          </div>

          {/* What to Avoid Card */}
          <div className="bg-orange-50 rounded-[2rem] p-6 shadow-sm border border-orange-100">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-5 h-5 text-orange-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">Avoid</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-xl">
                <p className="text-xs font-bold text-[#1A1A3D]">Dismissive Optimism</p>
                <p className="text-[10px] text-slate-500 whitespace-nowrap overflow-hidden">"Everything happens..."</p>
              </div>
              <div className="p-3 bg-white rounded-xl">
                <p className="text-xs font-bold text-[#1A1A3D]">Bureaucratic Jargon</p>
                <p className="text-[10px] text-slate-500 whitespace-nowrap overflow-hidden">Internal codes/IDs</p>
              </div>
            </div>
          </div>
        </div>

        {/* Linguistic Decision Tree */}
        <section className="flex flex-col space-y-4">
          <header className="flex justify-between items-end">
            <div>
              <h2 className="text-xl font-bold text-[#1A1A3D]">Decision Tree</h2>
              <p className="text-slate-500 text-xs">Dynamic sentiment mapping.</p>
            </div>
          </header>

          <div className="space-y-4 pb-4">
            {[
              { id: "01", say: "We don't need help.", resp: "I respect your independence. Perhaps we can just walk through the area together?" },
              { id: "02", say: "When will we go home?", resp: "I don't have the exact timeline yet, but my primary mission is ensuring your current location is comfortable." }
            ].map((item) => (
              <div key={item.id} className="bg-white rounded-[1.5rem] p-6 border border-slate-100 flex gap-4 shadow-sm">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center font-black text-slate-300 text-sm shrink-0">{item.id}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-bold text-[#1A1A3D] truncate">If: <span className="text-[#4F46E5] italic">"{item.say}"</span></p>
                    <ChevronDown className="w-4 h-4 text-slate-300" />
                  </div>
                  <div className="pl-4 border-l-2 border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 mb-1 uppercase">RESPONSE:</p>
                    <p className="text-xs text-slate-500 font-medium italic leading-relaxed">{item.resp}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer Actions Row */}
        <div className="flex items-center justify-between gap-4 py-8 px-1 mt-4">
          {/* Compact Audio Assistance Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between flex-1">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Audio Assistance</span>
              <p className="text-sm font-bold text-[#1A1A3D]">Activate In-Ear Mode</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch className="data-[state=checked]:bg-[#3730A3] h-6 w-10 scale-90" />
              <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-[#3730A3] border border-slate-100 shadow-sm">
                <Mic className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Navigate to Mission Button */}
          <Button className="h-16 px-8 rounded-2xl bg-gradient-to-r from-[#4F46E5] to-[#5A57FF] text-white font-bold text-base flex gap-3 shadow-lg shadow-indigo-100 hover:opacity-90 transition-opacity">
            I'm ready — Navigate to mission <Navigation className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Decision Tree Section Ends - Bottom Controls Removed per Request */}
    </div>
  );
}
