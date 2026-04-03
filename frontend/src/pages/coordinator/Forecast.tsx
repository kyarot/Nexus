import { useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableRow, TableCell, TableHead, TableHeader } from "@/components/ui/table";
import { BarChart3, Bell, Mail, MessageSquare, ExternalLink, Info, Filter, Zap, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const forecastData = [
  { week: "W12", score: 42 }, { week: "W13", score: 48 },
  { week: "W14", score: 55 }, { week: "W15", score: 62 },
  { week: "W16", score: 68 }, { week: "W17", score: 76 },
  { week: "W18", score: 72 }, { week: "W19", score: 70 },
];

export default function Forecast() {
  const [threshold, setThreshold] = useState([75]);

  // Split data for solid vs dashed line effect
  const chartData = forecastData.map((d, i) => ({
    ...d,
    historical: i <= 3 ? d.score : null,
    forecast: i >= 3 ? d.score : null,
  }));

  return (
    <div className="flex flex-col h-full bg-[#F8F9FE]">
      <DashboardTopBar breadcrumb="Community Forecast" />
      
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[2.5rem] font-bold text-[#1A1A3D] tracking-tight">Community Forecast</h1>
            <p className="text-lg text-slate-500 mt-1 font-medium">Predicted need intensity for next 4 weeks across all zones</p>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6">
              All Zones (Global) <Filter className="ml-2 w-4 h-4" />
            </Button>
            <Button className="bg-[#5A57FF] hover:bg-[#4845E0] text-white font-bold px-6 rounded-xl">
              Set Alert Threshold
            </Button>
          </div>
        </div>

        {/* Top Grid: Main Chart & Performance Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Forecast Chart */}
          <div className="lg:col-span-2 bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 relative">
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-xl font-bold text-[#1A1A3D]">Predictive Intensity Map</h2>
              <div className="flex gap-6 text-xs font-bold uppercase tracking-widest">
                <span className="flex items-center gap-2 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#5A57FF]" /> HISTORICAL
                </span>
                <span className="flex items-center gap-2 text-[#1A1A3D]">
                  <Target className="w-3.5 h-3.5" /> FORECAST
                </span>
              </div>
            </div>

            <div className="relative h-[300px] w-full mt-8">
              <div className="absolute right-0 top-0 z-10 bg-[#1A1A3D] text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest">
                Pre-position Resources
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5A57FF" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#5A57FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis 
                    dataKey="week" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94A3B8', fontSize: 11, fontWeight: 600}} 
                    dy={10}
                  />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip 
                    cursor={{ stroke: '#5A57FF', strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-50 min-w-[120px]">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{data.week} Intensity</p>
                            <div className="flex items-baseline gap-1">
                              <p className="text-2xl font-bold text-[#1A1A3D]">{data.score}</p>
                              <p className="text-[10px] font-bold text-[#5A57FF]">Pts</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="historical" 
                    stroke="#5A57FF" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorScore)" 
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#5A57FF' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="forecast" 
                    stroke="#5A57FF" 
                    strokeWidth={3} 
                    strokeDasharray="6 6"
                    fillOpacity={1} 
                    fill="url(#colorScore)" 
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#5A57FF' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-12 flex items-end justify-between">
              <div className="flex gap-12">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peak Confidence</p>
                  <p className="text-3xl font-bold text-[#5A57FF] mt-1">92.4%</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Drift Ratio</p>
                  <p className="text-3xl font-bold text-[#1A1A3D] mt-1">0.02</p>
                </div>
              </div>
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 w-10 rounded-full border-2 border-white bg-slate-200 overflow-hidden">
                    <img src={`https://i.pravatar.cc/150?u=${i}`} alt="user" className="w-full h-full object-cover" />
                  </div>
                ))}
                <div className="h-10 w-10 rounded-full border-2 border-white bg-[#E0E7FF] text-[#5A57FF] text-xs font-bold flex items-center justify-center">+12</div>
              </div>
            </div>
          </div>

          {/* Forecast Performance Card */}
          <div className="bg-gradient-to-br from-[#4F46E5] to-[#3730A3] rounded-[2rem] p-8 text-white flex flex-col shadow-lg">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold leading-tight max-w-[180px]">Last Month's Forecast Performance</h2>
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                <BarChart3 className="w-6 h-6" />
              </div>
            </div>

            <div className="mt-8 space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-sm font-medium opacity-80 uppercase tracking-widest text-[10px]">Accuracy Score</span>
                <span className="text-4xl font-black">84%</span>
              </div>
              <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                <div className="h-full bg-[#10B981] rounded-full" style={{ width: '84%' }} />
              </div>
            </div>

            <div className="mt-12 flex-1 flex items-end justify-between gap-2 h-32">
              {[40, 60, 50, 80, 70].map((h, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex-1 rounded-lg transition-all duration-700",
                    i === 4 ? "bg-[#10B981]" : "bg-white/20"
                  )} 
                  style={{ height: `${h}%` }} 
                />
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-white/10 italic text-xs opacity-60">
              Model retrained 4h ago using updated rainfall data.
            </div>
          </div>
        </div>

        {/* Zone Forecasts: 3 Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { zone: "Hebbal", peak: "WEEK 17 PEAK", color: "#5A57FF", trend: [30, 45, 60, 80, 70], status: "Deploy 3 food volunteers", badge: "bg-[#F3F2FF] text-[#5A57FF]" },
            { zone: "Yelahanka", peak: "STABLE", color: "#10B981", trend: [40, 42, 41, 43, 42], status: "Baseline flow maintained", badge: "bg-[#ECFDF5] text-[#10B981]" },
            { zone: "Jalahalli", peak: "HIGH RISK", color: "#EF4444", trend: [50, 60, 75, 90, 85], status: "Medication stock low", badge: "bg-[#FEF2F2] text-[#EF4444]" }
          ].map((z, i) => (
            <div key={i} className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold text-[#1A1A3D]">{z.zone}</h3>
                <span className={cn("text-[10px] font-black px-3 py-1 rounded-full", z.badge)}>{z.peak}</span>
              </div>

              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confidence</p>
                  <p className="text-2xl font-bold text-[#1A1A3D] mt-1">78%</p>
                </div>
                <div className="flex items-end gap-1 h-12 w-24">
                  {z.trend.map((h, j) => (
                    <div key={j} className="flex-1 rounded-sm" style={{ height: `${h}%`, backgroundColor: z.color, opacity: 0.3 + (j * 0.15) }} />
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 mb-6">
                {i === 2 ? <Info className="w-4 h-4 text-[#EF4444]" /> : i === 1 ? <Target className="w-4 h-4 text-[#10B981]" /> : <Users className="w-4 h-4 text-[#5A57FF]" />}
                <p className="text-sm font-medium text-slate-700">{z.status}</p>
              </div>

              <Button className={cn(
                "w-full rounded-xl py-6 font-bold uppercase tracking-widest text-xs",
                i === 1 ? "bg-white border-2 border-[#1A1A3D] text-[#1A1A3D] hover:bg-slate-50" : "bg-[#1A1A3D] text-white hover:bg-black"
              )}>
                {i === 1 ? "View Details" : "Pre-position Now"}
              </Button>
            </div>
          ))}
        </div>

        {/* Bottom Grid: Risk Assessment & Alert Config */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
          {/* Risk Assessment Table */}
          <div className="lg:col-span-2 bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-bold text-[#1A1A3D]">Generational Risk Assessment</h2>
                <p className="text-xs font-medium text-slate-400 mt-1">2025–2030 Cohort Analysis</p>
              </div>
              <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                <Button size="sm" variant="ghost" className="bg-white shadow-sm font-bold text-xs h-8">Map View</Button>
                <Button size="sm" variant="ghost" className="text-slate-500 font-bold text-xs h-8">Grid View</Button>
              </div>
            </div>

            <div className="grid grid-cols-[35%_1fr] gap-8">
              <div className="bg-[#E0E7FF] rounded-2xl flex items-center justify-center relative overflow-hidden h-[280px]">
                <div className="bg-[#1A1A3D] text-white text-[10px] font-bold px-4 py-2 rounded-full backdrop-blur-md shadow-lg z-10">
                  Interactive Hotspots Active
                </div>
                <div className="absolute inset-0 opacity-20">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle cx="30" cy="40" r="10" fill="#5A57FF" />
                    <circle cx="70" cy="60" r="15" fill="#5A57FF" />
                  </svg>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="uppercase text-[10px] font-black tracking-widest text-slate-400">Zone</TableHead>
                    <TableHead className="uppercase text-[10px] font-black tracking-widest text-slate-400">At-Risk</TableHead>
                    <TableHead className="uppercase text-[10px] font-black tracking-widest text-slate-400">Need</TableHead>
                    <TableHead className="uppercase text-[10px] font-black tracking-widest text-slate-400 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { zone: "Hebbal", risk: "1,240", need: "Education", color: "text-[#5A57FF] bg-[#F3F2FF]" },
                    { zone: "Jalahalli", risk: "890", need: "Nutrition", color: "text-[#EF4444] bg-[#FEF2F2]" },
                    { zone: "RT Nagar", risk: "2,100", need: "Health", color: "text-[#10B981] bg-[#ECFDF5]" },
                    { zone: "Yelahanka", risk: "450", need: "Shelter", color: "text-amber-600 bg-amber-50" }
                  ].map((row, i) => (
                    <TableRow key={i} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-[#1A1A3D]">{row.zone}</TableCell>
                      <TableCell className="font-mono font-medium text-slate-600">{row.risk}</TableCell>
                      <TableCell>
                        <Badge className={cn("rounded-lg border-none hover:bg-transparent px-3 py-1 text-[10px] font-bold", row.color)}>
                          {row.need}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" className="text-[#5A57FF] hover:bg-[#F3F2FF]">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Alert Configuration Card */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col">
            <div className="flex items-center gap-4 mb-10">
              <div className="p-3 bg-amber-50 rounded-2xl">
                <Bell className="w-6 h-6 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-[#1A1A3D]">Alert Configuration</h2>
            </div>

            <div className="space-y-8 flex-1">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm font-black uppercase tracking-widest text-slate-400">
                  <span>Confidence Threshold</span>
                  <span className="text-[#5A57FF]">75%</span>
                </div>
                <Slider defaultValue={[75]} max={100} step={1} className="py-4" />
              </div>

              <div className="space-y-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notification Methods</p>
                <div className="space-y-3">
                  {[
                    { icon: Mail, label: "Email Summary", active: true },
                    { icon: MessageSquare, label: "SMS Critical Alerts", active: true },
                    { icon: Bell, label: "Push Notifications", active: false }
                  ].map((method, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl transition-all hover:bg-slate-100">
                      <div className="flex items-center gap-4">
                        <method.icon className="w-5 h-5 text-slate-400" />
                        <span className="text-sm font-bold text-[#1A1A3D]">{method.label}</span>
                      </div>
                      <Switch className="data-[state=checked]:bg-[#5A57FF]" defaultChecked={method.active} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button className="mt-8 bg-[#3730A3] hover:bg-[#2D267E] text-white font-bold py-6 rounded-2xl shadow-lg transition-transform active:scale-95">
              Save Configuration
            </Button>
          </div>
        </div>

        {/* Footer Status Bar */}
        <div className="border-t border-slate-200 mt-12 py-6 flex flex-wrap items-center justify-between text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
          <div className="flex gap-8">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" /> CORE ENGINE: SYNCING
            </span>
            <span>LAST UPDATE: 14:02 UTC</span>
          </div>
          <div className="flex gap-8">
            <span>API Response: <span className="text-[#5A57FF]">12ms</span></span>
            <span>Uptime: <span className="text-[#10B981]">99.99%</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
