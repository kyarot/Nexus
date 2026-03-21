import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { 
  Download, 
  Share2, 
  MapPin, 
  Trophy, 
  Activity, 
  Clock, 
  Users, 
  ChevronRight,
  Lock,
  Linkedin,
  Sparkles,
  Info,
  TrendingUp,
  Award,
  ShieldCheck,
  HeartPulse,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  BarChart,
  Bar,
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";

const timelineData = [
  { month: "Jan", points: 40, avg: 35 },
  { month: "Feb", points: 65, avg: 40 },
  { month: "Mar", points: 60, avg: 45 },
  { month: "Apr", points: 85, avg: 50 },
  { month: "May", points: 50, avg: 55 },
  { month: "Jun", points: 95, avg: 60 },
  { month: "Jul", points: 75, avg: 65 },
  { month: "Aug", points: 100, avg: 70 },
  { month: "Sep", points: 45, avg: 60 },
  { month: "Oct", points: 80, avg: 55 },
  { month: "Nov", points: 35, avg: 50 },
  { month: "Dec", points: 70, avg: 45 },
];

export default function MyImpact() {
  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7FF] font-['Plus_Jakarta_Sans']">
      <DashboardTopBar breadcrumb="Menu / My Impact" />
      
      <div className="flex-1 p-8 max-w-[1600px] mx-auto w-full space-y-8">
        
        {/* Page Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[2rem] font-bold text-[#1A1A3D] tracking-tight">My Impact</h1>
            <p className="text-slate-500 font-medium text-base mt-1">Your verified contribution to community wellbeing</p>
          </div>
          <Button className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] hover:opacity-90 text-white font-bold h-12 px-6 rounded-xl flex gap-2 shadow-lg shadow-indigo-100 transition-all border-none">
            <Download className="w-4 h-4" /> Download Impact Report
          </Button>
        </header>

        {/* Time Filter Tabs */}
        <div className="flex gap-2 p-1.5 bg-slate-200/30 rounded-2xl w-fit">
          {["This Month", "3 Months", "6 Months", "All Time"].map((tab, i) => (
            <button
              key={tab}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                i === 1 ? "bg-white text-[#4F46E5] shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Top Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Families Helped", value: "847", delta: "+124 this month", color: "border-[#4F46E5]", deltaColor: "text-emerald-500" },
            { label: "Need Score Reduced", value: "-34%", delta: "Across 12 zones", color: "border-emerald-500", deltaColor: "text-slate-400" },
            { label: "Total Hours Volunteered", value: "64h", delta: "Since March 2024", color: "border-amber-500", deltaColor: "text-slate-400" },
            { label: "Impact Points", value: "340", delta: "Top 12% of volunteers", color: "border-violet-500", deltaColor: "text-slate-400" },
          ].map((m, i) => (
            <div key={i} className={cn("bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 border-l-[6px] flex flex-col justify-between", m.color)}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{m.label}</p>
              <span className="text-[2rem] font-black text-[#1A1A3D] leading-none">{m.value}</span>
              <p className={cn("text-[10px] font-bold mt-2 uppercase tracking-widest", m.deltaColor)}>{m.delta}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          
          {/* LEFT + CENTER COLUMNS */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* IMPACT TIMELINE CHART */}
            <div className="bg-[#F9F9FF] rounded-[2rem] p-8 shadow-sm border border-slate-100 relative">
              <div className="flex justify-between items-center mb-10 text-[#1A1A3D]">
                <h2 className="text-[1.5rem] font-bold">Impact Timeline</h2>
                <div className="flex gap-6 items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-[#4F46E5]" />
                    <span className="text-xs font-bold">Your Impact</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-[#CBD5E1]" />
                    <span className="text-xs font-bold text-slate-400">Zone Avg</span>
                  </div>
                </div>
              </div>
              
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timelineData} barGap={0}>
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#1A1A3D', fontSize: 12, fontWeight: 700 }}
                      dy={20}
                    />
                    <YAxis hide />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar 
                      dataKey="points" 
                      radius={[8, 8, 0, 0]} 
                      barSize={45}
                    >
                      {timelineData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.points > 80 ? '#4F46E5' : entry.points > 60 ? '#818CF8' : '#C7D2FE'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* TRUST FABRIC SECTION */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-8">
                <h2 className="text-[1.5rem] font-bold text-[#1A1A3D]">Verified Impact Ledger</h2>
              </div>

              <div className="w-full">
                <div className="grid grid-cols-5 py-6 bg-[#F9F9FF] rounded-xl px-4 text-[11px] font-bold uppercase tracking-widest text-[#1A1A3D]/40 mb-4">
                  <div className="col-span-1">Mission Name</div>
                  <div className="col-span-1">Zone</div>
                  <div className="col-span-1">Before/After</div>
                  <div className="col-span-1">Change</div>
                  <div className="col-span-1 text-right">Date</div>
                </div>

                <div className="px-4 space-y-2">
                  {[
                    { name: "Urban Food Drive", zone: "Hebbal", ba: "84 → 92", delta: "+8pts", type: "pos", date: "Oct 12" },
                    { name: "Youth Mentorship", zone: "Indiranagar", ba: "45 → 62", delta: "+17pts", type: "pos", date: "Oct 08" },
                    { name: "Emergency Shelter Log", zone: "Whitefield", ba: "12 → 10", delta: "-2pts", type: "neg", date: "Oct 03" },
                  ].map((row, i) => (
                    <div key={i} className="grid grid-cols-5 py-6 items-center border-b border-slate-50 last:border-0">
                      <div className="text-base font-bold text-[#1A1A3D]">{row.name}</div>
                      <div className="text-sm font-medium text-slate-500">{row.zone}</div>
                      <div className="text-sm font-bold text-[#1A1A3D] tabular-nums">{row.ba}</div>
                      <div>
                        <Badge className={cn(
                          "border-none py-2 px-4 rounded-full text-xs font-bold",
                          row.type === "pos" ? "bg-[#9AF7C9]/40 text-[#059669]" : "bg-red-50 text-red-600"
                        )}>
                          {row.delta}
                        </Badge>
                      </div>
                      <div className="text-sm font-bold text-slate-400 text-right">{row.date}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* COMMUNITY CONTRIBUTION MAP */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 space-y-6">
              <h2 className="text-xl font-bold text-[#1A1A3D]">Zones you have impacted</h2>
              <div className="relative h-64 bg-slate-100 rounded-2xl overflow-hidden shadow-inner border border-white/50 group">
                {/* Mock map thumbnail */}
                <div className="absolute inset-0 bg-[#E2E8F0] opacity-40" 
                  style={{ 
                    backgroundImage: 'radial-gradient(#94A3B8 2px, transparent 2px)', 
                    backgroundSize: '24px 24px' 
                  }} 
                />
                
                {/* Colored Pins */}
                <div className="absolute top-1/4 left-1/3 group-hover:scale-110 transition-transform">
                  <div className="relative">
                    <MapPin className="w-8 h-8 text-[#4F46E5] fill-[#4F46E5]/20" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                  </div>
                </div>
                <div className="absolute bottom-1/3 right-1/4">
                  <div className="relative">
                    <MapPin className="w-8 h-8 text-[#7C3AED] fill-[#7C3AED]/20" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white" />
                  </div>
                </div>
                <div className="absolute top-1/2 right-1/2">
                  <MapPin className="w-8 h-8 text-emerald-500 fill-emerald-500/20" />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3">
                {[
                  { name: "Hebbal", count: "8 missions" },
                  { name: "Yelahanka", count: "4 missions" },
                  { name: "Whitefield", count: "2 missions" },
                  { name: "Indiranagar", count: "5 missions" }
                ].map((z, i) => (
                  <Badge key={i} className="bg-indigo-50/70 text-[#4F46E5] border border-indigo-100/30 px-4 py-2 rounded-xl font-bold text-xs ring-0">
                    {z.name} <span className="opacity-50 ml-2 font-medium">{z.count}</span>
                  </Badge>
                ))}
              </div>
            </div>

            {/* BURNOUT HEALTH CARD */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 border-l-[6px] border-l-emerald-500">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-[#1A1A3D]">Your Wellbeing</h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">Private — only you see this</p>
                </div>
                <Badge variant="success" className="text-emerald-500 bg-emerald-50 font-black text-[9px] tracking-widest px-3 py-1.5 rounded-full ring-0">
                  LOW RISK — YOU ARE DOING WELL
                </Badge>
              </div>
              
              <div className="space-y-8">
                <div className="space-y-2">
                  <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden relative">
                    <div className="h-full w-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 opacity-20" />
                    <div className="absolute top-0 left-0 h-full w-[25%] bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                    <div className="absolute top-1/2 left-[25%] -translate-y-1/2 w-4 h-4 bg-white rounded-full border-4 border-emerald-500 shadow-lg -ml-2" />
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#1A1A3D]/40">Last 30 days activity:</p>
                  <div className="flex gap-4">
                    {["6 missions", "Avg 45min", "2 rest days"].map(s => (
                      <div key={s} className="bg-slate-50 px-5 py-2.5 rounded-xl text-xs font-bold text-[#1A1A3D]">
                        {s}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#EEF2FF] rounded-2xl p-6 relative overflow-hidden border border-indigo-100/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-[#4F46E5]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#4F46E5]">Nexus AI Advice</span>
                  </div>
                  <p className="text-[12px] text-[#1A1A3D] font-medium leading-relaxed">
                    Nexus suggests taking a lighter mission this week. Your acceptance rate has slowed — that is okay.
                  </p>
                </div>

                <Button variant="outline" className="text-slate-400 text-xs font-bold flex gap-2 p-0 border-none hover:bg-transparent hover:text-slate-600 bg-transparent">
                  View Wellbeing Tips <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN (DNA + BADGES) */}
          <div className="space-y-6">
            
            {/* DNA RADAR CHART CARD */}
            <div className="bg-[#F9F9FF] rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col items-center">
              <h3 className="text-[1.5rem] font-bold text-[#1A1A3D] mb-4 w-full text-center">Impact DNA</h3>
              <div className="relative w-64 h-64 flex items-center justify-center">
                {/* Spider Chart Mockup */}
                <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-18">
                  {/* Backdrop shapes */}
                  <polygon points="100,20 180,80 160,160 40,160 20,80" fill="#E6E6FF" opacity="0.3" />
                  <polygon points="100,40 160,85 145,145 55,145 40,85" fill="#E6E6FF" opacity="0.5" />
                  
                  {/* Your DNA */}
                  <polygon 
                    points="100,30 155,75 140,140 65,145 35,80" 
                    fill="rgba(79, 70, 229, 0.45)" 
                    stroke="#4F46E5" 
                    strokeWidth="2" 
                  />
                </svg>
                
                {/* Labels at tips */}
                <div className="absolute top-0 text-[10px] font-black text-[#1A1A3D]/40 tracking-widest">SKILL</div>
                <div className="absolute right-[-15px] top-[40%] text-[10px] font-black text-[#1A1A3D]/40 tracking-widest">REACH</div>
                <div className="absolute right-[-5px] bottom-10 text-[10px] font-black text-[#1A1A3D]/40 tracking-widest">CONSIST</div>
                <div className="absolute left-[-20px] top-[40%] text-[10px] font-black text-[#1A1A3D]/40 tracking-widest">PROXIMITY</div>
                <div className="absolute left-[-15px] bottom-10 text-[10px] font-black text-[#1A1A3D]/40 tracking-widest">URGENCY</div>
                <div className="absolute bottom-[-10px] text-[10px] font-black text-[#1A1A3D]/40 tracking-widest">EMPATHY</div>
              </div>
            </div>

            {/* ACHIEVEMENT BADGES CARD */}
            <div className="bg-[#F9F9FF] rounded-[2rem] p-8 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-[1.5rem] font-bold text-[#1A1A3D]">Impact Badges</h3>
                <button className="text-[#4F46E5] text-sm font-bold border-b-2 border-[#4F46E5] pb-0.5">View All</button>
              </div>
              
              <div className="grid grid-cols-3 gap-6">
                {[
                  { icon: "🍃", name: "ECO-GUARDIAN", color: "text-[#5C4033]" },
                  { icon: "🤝", name: "HIGH EMPATHY", color: "text-[#4F46E5]" },
                  { icon: "🌱", name: "MIND-CARE", color: "text-[#1B4D3E]" },
                  { icon: <Lock className="w-8 h-8 opacity-20" />, name: "CIVIC HERO", locked: true },
                  { icon: <Lock className="w-8 h-8 opacity-20" />, name: "DATA WHIZ", locked: true },
                  { icon: <Lock className="w-8 h-8 opacity-20" />, name: "ZONE LEAD", locked: true },
                ].map((b, i) => (
                  <div key={i} className={cn(
                    "flex flex-col items-center justify-center aspect-square rounded-[1.5rem] p-4 text-center transition-all",
                    b.locked ? "border-2 border-dashed border-slate-200" : "bg-white shadow-sm"
                  )}>
                    <div className={cn("text-3xl mb-3", b.color)}>
                      {b.icon}
                    </div>
                    <span className={cn(
                      "text-[10px] font-black tracking-widest leading-tight",
                      b.locked ? "text-slate-300" : "text-[#1A1A3D]"
                    )}>{b.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* LEVEL + RANK CARD */}
            <div className="bg-[#1E1B4B] rounded-[2rem] p-8 shadow-sm overflow-hidden relative text-white">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest opacity-60 mb-2">GLOBAL RANK</p>
                  <p className="text-[3rem] font-black leading-none">#47</p>
                </div>
                <div className="bg-white/10 px-4 py-2 rounded-full border border-white/20">
                  <span className="text-xs font-black">LVL 24</span>
                </div>
              </div>

              <div className="mt-12 space-y-4">
                <div className="flex justify-between items-end">
                  <h4 className="text-lg font-bold">Community Champion</h4>
                  <span className="text-sm font-bold opacity-70">2,400 / 3,000 XP</span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full w-[80%] bg-[#5A57FF] shadow-[0_0_12px_rgba(90,87,255,0.6)]" />
                </div>
              </div>
              
              {/* Background decorative Rank icon */}
              <div className="absolute bottom-[-20px] right-[-20px] opacity-10 rotate-12">
                <Trophy className="w-32 h-32" />
              </div>
            </div>

            {/* SHARE IMPACT CARD */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 space-y-6">
              <h3 className="text-lg font-bold text-[#1A1A3D]">Share your impact</h3>
              <div className="bg-[#F8F7FF] rounded-2xl p-4 border border-indigo-50/50 flex flex-col items-center">
                <div className="w-full aspect-[1.91/1] bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col p-4 relative overflow-hidden">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 bg-[#4F46E5] rounded flex items-center justify-center text-[10px] font-black text-white px-0.5">N</div>
                      <span className="text-[8px] font-black text-[#1A1A3D] uppercase tracking-tighter">NEXUS IMPACT</span>
                    </div>
                    <span className="text-[6px] font-black text-slate-300">#VOLUNTEERHACK</span>
                  </div>
                  <div className="mt-2">
                    <p className="text-[10px] font-extrabold text-[#1A1A3D]">Helping Hebbal</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-slate-50 p-1.5 rounded-lg flex flex-col">
                        <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Missions</span>
                        <span className="text-xs font-black text-[#1A1A3D]">847</span>
                      </div>
                      <div className="bg-indigo-50 p-1.5 rounded-lg flex flex-col">
                        <span className="text-[6px] font-black text-indigo-400 uppercase tracking-widest">Impact</span>
                        <span className="text-xs font-black text-[#4F46E5]">Level 24</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-8 -right-8 w-20 h-20 bg-[#4F46E5]/10 rounded-full blur-xl" />
                </div>
              </div>
              
              <div className="space-y-3">
                <Button className="w-full bg-[#0077B5] hover:bg-[#006097] text-white font-bold h-12 rounded-xl flex gap-3 shadow-md border-none ring-0">
                  <Linkedin className="w-5 h-5" fill="currentColor" /> Share on LinkedIn
                </Button>
                <div className="flex flex-col items-center gap-3">
                  <button className="text-slate-400 text-[11px] font-bold hover:text-slate-600 transition-colors py-2 flex items-center gap-2">
                    <Download className="w-3.5 h-3.5" /> Download as Image
                  </button>
                  <button className="text-[#4F46E5] text-[11px] font-black uppercase tracking-widest hover:underline">
                    Copy shareable link
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
