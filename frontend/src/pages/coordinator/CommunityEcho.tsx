import { useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, Users, MessageSquare, Send, Calendar, Clock, Heart, Info, MoreVertical, Smartphone, LayoutGrid, BarChart3, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const languages = ["Kannada", "Hindi", "Telugu", "English"];
const tones = [
  { label: "Warm & encouraging", icon: Heart },
  { label: "Informational", icon: Info },
  { label: "Urgent", icon: Info }
];

export default function CommunityEcho() {
  const [selectedLang, setSelectedLang] = useState("Kannada");
  const [selectedTone, setSelectedTone] = useState("Warm & encouraging");

  return (
    <div className="flex flex-col h-full bg-[#F8F9FE]">
      <DashboardTopBar breadcrumb="Community Echo" />
      
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[2.5rem] font-bold text-[#1A1A3D] tracking-tight">Community Echo</h1>
            <p className="text-lg text-slate-500 mt-1 font-medium">Friday broadcasts to your zones</p>
            <p className="text-sm text-slate-400 font-medium">The only platform that reports back to communities — not just about them</p>
          </div>
          <Button className="bg-[#5A57FF] hover:bg-[#4845E0] text-white font-bold px-8 py-6 rounded-2xl shadow-lg shadow-indigo-100 flex gap-2">
            <Clock className="w-5 h-5" /> Schedule Next Broadcast
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Broadcaster Main Card */}
          <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 relative">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-[#1A1A3D]">Week 14 Broadcast — Hebbal North</h2>
                <div className="flex items-center gap-2 mt-2 text-slate-500 font-medium">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">2,847 registered households in Hebbal North</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-slate-400">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-8">
              {/* Language Cluster */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Language Cluster</p>
                <div className="flex gap-3">
                  {languages.map(l => (
                    <Button
                      key={l}
                      onClick={() => setSelectedLang(l)}
                      variant={selectedLang === l ? "default" : "secondary"}
                      className={cn(
                        "rounded-2xl px-6 py-2 h-auto font-bold transition-all",
                        selectedLang === l ? "bg-[#5A57FF] text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      {l}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Echo Tone */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Echo Tone</p>
                <div className="flex gap-3">
                  {tones.map(t => (
                    <Button
                      key={t.label}
                      onClick={() => setSelectedTone(t.label)}
                      className={cn(
                        "rounded-2xl px-6 py-5 h-auto font-bold border-2 transition-all flex gap-2",
                        selectedTone === t.label 
                          ? "bg-white border-[#5A57FF] text-[#5A57FF] shadow-md shadow-indigo-50" 
                          : "bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100"
                      )}
                    >
                      <t.icon className={cn("w-4 h-4", t.label === "Urgent" && "text-red-400")} />
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Message Box */}
              <div className="relative group">
                <div className="absolute -top-3 left-4 bg-white px-3 flex items-center gap-1.5 text-[8px] font-black text-[#5A57FF] border border-blue-100 rounded-full py-1 z-10 shadow-sm">
                  <Sparkles className="w-2.5 h-2.5" /> AI GENERATED PREVIEW
                </div>
                <div className="bg-[#F8FAFF] border-2 border-[#E0E7FF] rounded-[2rem] p-8 pt-10">
                  <p className="text-lg text-[#1A1A3D] leading-relaxed font-medium">
                    This week in your neighborhood: <span className="text-[#5A57FF] font-bold">34 families</span> received food support. 
                    A counsellor visits Tuesday 3pm at Community Center. Your area improved 
                    from <span className="font-bold">61 → 68</span> this week. Thank you.
                  </p>
                  <div className="mt-6 flex justify-end">
                    <button className="flex items-center gap-2 text-[10px] font-black text-[#5A57FF] hover:underline uppercase tracking-widest">
                      <Sparkles className="w-3.5 h-3.5" /> Regenerate with Gemini
                    </button>
                  </div>
                </div>
              </div>

              {/* Channels */}
              <div className="flex gap-4">
                {[
                  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare, active: true },
                  { id: "sms", label: "SMS", icon: Smartphone, active: false },
                  { id: "push", label: "Push", icon: Bell, active: true }
                ].map((channel) => (
                  <div key={channel.id} className="flex-1 bg-slate-50 rounded-2xl p-5 flex items-center justify-between border border-transparent hover:border-slate-100 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-xl", channel.active ? "bg-white text-[#5A57FF]" : "bg-slate-100 text-slate-400")}>
                        <channel.icon className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-[#1A1A3D] text-sm">{channel.label}</span>
                    </div>
                    <Switch defaultChecked={channel.active} className="data-[state=checked]:bg-[#5A57FF]" />
                  </div>
                ))}
              </div>

              {/* Action */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button className="text-sm font-bold text-slate-500 hover:text-[#1A1A3D] flex gap-2 items-center">
                  <LayoutGrid className="w-4 h-4" /> Preview in {selectedLang}
                </button>
                <Button className="bg-[#5A57FF] hover:bg-[#4845E0] text-white font-bold px-12 py-7 rounded-2xl text-md">
                  Schedule Broadcast
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Community Response Card */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-[#1A1A3D] mb-6">Community Response</h2>
              
              <div className="space-y-2 mb-8">
                <div className="flex justify-between items-end">
                  <span className="text-[#10B981] font-black text-sm">87% positive responses</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">This Week</span>
                </div>
                <div className="h-3 bg-slate-50 rounded-full overflow-hidden">
                  <div className="h-full bg-[#10B981] rounded-full" style={{ width: '87%' }} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-10">
                {[
                  { label: "Grateful", active: false, color: "text-[#10B981] bg-[#ECFDF5]" },
                  { label: "Helpful", active: true, color: "bg-[#5A57FF] text-white" },
                  { label: "Timing", active: false, color: "bg-slate-50 text-slate-400" },
                  { label: "Food Support", active: true, color: "bg-[#E0E7FF] text-[#3730A3]" },
                  { label: "Clear", active: false, color: "bg-slate-50 text-slate-400" },
                  { label: "Essential", active: true, color: "bg-amber-50 text-amber-600" }
                ].map((tag, i) => (
                  <Badge key={i} className={cn("px-5 py-3 rounded-2xl font-bold border-none transition-transform hover:scale-105", tag.color)}>
                    {tag.label}
                  </Badge>
                ))}
              </div>

              <div className="space-y-6">
                {[
                  { text: "The update about the counsellor was very helpful for my mother. We didn't know about the center before this.", author: "VERIFIED RESIDENT" },
                  { text: "Thank you for showing us the impact. Knowing 34 families were helped makes us feel proud of our zone.", author: "ANONYMOUS MEMBER" }
                ].map((quote, i) => (
                  <div key={i} className="bg-slate-50 rounded-[2rem] p-6 italic relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#5A57FF] opacity-20 group-hover:opacity-100 transition-opacity" />
                    <p className="text-sm text-[#1A1A3D] font-medium leading-relaxed">"{quote.text}"</p>
                    <p className="text-[10px] font-black tracking-widest text-slate-400 mt-4 uppercase">— {quote.author}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Impact Score Card */}
            <div className="bg-gradient-to-br from-[#4F46E5] to-[#3730A3] rounded-[2.5rem] p-8 text-white shadow-lg overflow-hidden relative">
              <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Global Impact Score</p>
                <h3 className="text-6xl font-black mt-4">72.4</h3>
                <p className="text-xs font-bold mt-4 text-[#10B981] flex items-center gap-1">
                   +4.2 points from last broadcast
                </p>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl" />
            </div>
          </div>
        </div>

        {/* Broadcast History Table */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-2xl font-bold text-[#1A1A3D]">Broadcast History</h2>
            <Button variant="ghost" className="text-[#5A57FF] font-bold text-sm">
              View Full Archive <Send className="ml-2 w-4 h-4" />
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="uppercase text-[10px] font-black tracking-widest text-slate-400 pb-6">Date</TableHead>
                <TableHead className="uppercase text-[10px] font-black tracking-widest text-slate-400 pb-6">Zone</TableHead>
                <TableHead className="uppercase text-[10px] font-black tracking-widest text-slate-400 pb-6">Recipients</TableHead>
                <TableHead className="uppercase text-[10px] font-black tracking-widest text-slate-400 pb-6 text-center">Open Rate</TableHead>
                <TableHead className="uppercase text-[10px] font-black tracking-widest text-slate-400 pb-6">Tone</TableHead>
                <TableHead className="uppercase text-[10px] font-black tracking-widest text-slate-400 pb-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { date: "May 19, 2024", zone: "Hebbal North", recipients: "2,842", rate: "92%", color: "#10B981", tone: "Warm", status: "success" },
                { date: "May 12, 2024", zone: "Hebbal North", recipients: "2,810", rate: "89%", color: "#10B981", tone: "Informational", status: "success" },
                { date: "May 05, 2024", zone: "Indiranagar East", recipients: "4,120", rate: "74%", color: "#F59E0B", tone: "Urgent", status: "warning" }
              ].map((row, i) => (
                <TableRow key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                  <TableCell className="py-6 font-bold text-slate-500 group-hover:text-[#1A1A3D]">{row.date}</TableCell>
                  <TableCell className="py-6">
                    <div className="flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full" style={{ backgroundColor: row.status === "warning" ? "#F59E0B" : "#10B981" }} />
                       <span className="font-bold text-[#1A1A3D]">{row.zone}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-6 font-mono font-bold text-[#1A1A3D] text-lg">{row.recipients}</TableCell>
                  <TableCell className="py-6">
                    <div className="flex justify-center">
                      <span className={cn("px-4 py-1 rounded-lg text-[10px] font-black", row.status === "warning" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
                        {row.rate}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-6 font-medium text-slate-400">{row.tone}</TableCell>
                  <TableCell className="py-6 text-right">
                    <Button variant="ghost" size="icon" className="text-slate-300 hover:text-[#5A57FF] hover:bg-[#F3F2FF]">
                      <BarChart3 className="w-5 h-5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
