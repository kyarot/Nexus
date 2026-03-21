import React, { useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  Building2, 
  ArrowRight, 
  RefreshCw, 
  ChevronDown, 
  Send, 
  Download, 
  Eye, 
  Plus, 
  LayoutDashboard,
  Shield,
  Clock,
  ExternalLink,
  ChevronRight,
  History,
  Target,
  Calendar,
  TrendingDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

const LivingConstitution = () => {
  const [tone, setTone] = useState("formal");
  const [language, setLanguage] = useState("English");

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7FF] font-['Plus_Jakarta_Sans']">
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardTopBar breadcrumb="Reports / Living Constitution" />
        
        <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-[#4F46E5] shadow-sm">
                  <FileText className="w-7 h-7" />
                </div>
                <h1 className="text-[32px] font-bold text-[#1A1A3D]">Living Constitution</h1>
              </div>
              <p className="text-[#64748B] text-lg leading-relaxed">
                Auto-generated monthly policy brief — community ground truth flowing directly into government decision-making.
              </p>
              
              {/* Success Acknowledgment Bar */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#F0FDF4] rounded-xl border border-[#DCFCE7] text-[#166534] text-sm font-bold shadow-sm">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  March 2026 brief acknowledged by DC Office ✓
                </div>
                <span className="text-[10px] font-black opacity-40 font-mono tracking-tighter">REF ID: NEX-2026-83-ACK</span>
              </div>
            </div>
            
            <Button className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] hover:opacity-90 text-white font-bold h-12 px-6 rounded-xl shadow-lg shadow-indigo-200">
               <Building2 className="w-4 h-4 mr-2" /> Send to District Collector →
            </Button>
          </div>

          {/* How it Works Banner */}
          <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.04)] border border-indigo-50/50">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                {[
                  { step: 1, title: "Data Analysis", desc: "Nexus analyses all field reports this month", icon: LayoutDashboard },
                  { step: 2, title: "Gemini Identifies Needs", desc: "Gemini identifies top 10 unmet needs", icon: Sparkles },
                  { step: 3, title: "Auto-Formatted", desc: "Brief auto-formatted to govt standards", icon: FileText },
                ].map((item, i) => (
                  <div key={item.step} className="flex gap-4 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-[#4F46E5] font-black text-sm shrink-0">
                       {item.step}
                    </div>
                    <div className="space-y-1">
                       <h4 className="text-sm font-black text-[#1A1A3D] uppercase tracking-widest">{item.title}</h4>
                       <p className="text-xs text-slate-400 font-medium leading-relaxed">{item.desc}</p>
                    </div>
                    {i < 2 && (
                      <div className="hidden md:block absolute -right-6 top-5 text-indigo-100">
                         <ArrowRight className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
             </div>
             <p className="text-[11px] text-slate-400 font-bold italic mt-6 text-center">"Takes 4 seconds. Used to take 3 months."</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left Column - Document Preview */}
            <div className="lg:col-span-3 space-y-6">
               <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-50">
                     <div className="space-y-1">
                        <h3 className="text-lg font-bold text-[#1A1A3D]">March 2026 Policy Brief</h3>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                           <Calendar className="w-3.5 h-3.5" /> Period: March 1 - March 21
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <Button variant="ghost" className="h-9 px-3 rounded-lg text-[#4F46E5] hover:bg-indigo-50 font-bold text-xs">
                           <RefreshCw className="w-3.5 h-3.5 mr-2" /> Regenerate
                        </Button>
                        <select className="h-9 bg-slate-50 border-none rounded-lg px-3 text-xs font-bold text-slate-600 focus:ring-1 ring-indigo-100">
                           <option>English</option>
                           <option>Hindi</option>
                           <option>Kannada</option>
                        </select>
                     </div>
                  </div>

                  <div className="flex gap-2">
                     {[
                       { id: "formal", label: "Formal (Government)" },
                       { id: "accessible", label: "Accessible (Public)" },
                       { id: "summary", label: "Summary (1-page)" }
                     ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => setTone(t.id)}
                          className={cn(
                            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                            tone === t.id ? "bg-[#4F46E5] text-white border-[#4F46E5] shadow-md" : "text-slate-400 border-slate-100 hover:border-slate-200"
                          )}
                        >
                          {t.label}
                        </button>
                     ))}
                  </div>

                  {/* Document Preview Area */}
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-inner overflow-hidden min-h-[900px] flex flex-col">
                     {/* Doc Header */}
                     <div className="bg-[#1E1B4B] p-10 text-white space-y-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-10">
                           <Building2 className="w-32 h-32" />
                        </div>
                        <div className="space-y-1 relative z-10">
                           <p className="text-[10px] font-black opacity-60 uppercase tracking-[0.2em]">OFFICIAL POLICY BRIEF • NEX-2026-03</p>
                           <h2 className="text-3xl font-black">Executive Summary</h2>
                        </div>
                        <div className="flex gap-3 relative z-10">
                           <Badge className="bg-white/10 hover:bg-white/10 text-white border-white/20 font-bold px-3 py-1">Priority: High</Badge>
                           <Badge className="bg-white/10 hover:bg-white/10 text-white border-white/20 font-bold px-3 py-1">District: Bengaluru Urban</Badge>
                        </div>
                     </div>

                     <div className="p-12 flex-1 space-y-12">
                        {/* Section 1 */}
                        <div className="space-y-6">
                           <h4 className="text-[12px] font-black text-[#4F46E5] uppercase tracking-[0.2em] border-b border-indigo-50 pb-2">TOP 10 UNMET NEEDS</h4>
                           <div className="space-y-8">
                              {[
                                { id: "01", title: "Potable Water Access in Hebbal Slum", desc: "Over 1,200 households reporting inconsistent supply despite infrastructure presence." },
                                { id: "02", title: "Delayed Primary Healthcare Payments", desc: "Community health workers (ASHAs) reporting 3-month backlog in basic stipends." },
                                { id: "03", title: "Digital Literacy for Street Vendors", desc: "Difficulty accessing PMSVANidhi benefits due to platform complexity." }
                              ].map(need => (
                                <div key={need.id} className="flex gap-6 group">
                                   <span className="text-2xl font-black text-slate-100 group-hover:text-indigo-100 transition-colors font-mono">{need.id}</span>
                                   <div className="space-y-2">
                                      <h5 className="font-bold text-[#1A1A3D] text-[15px]">{need.title}</h5>
                                      <p className="text-sm text-slate-500 leading-relaxed font-medium">{need.desc}</p>
                                   </div>
                               </div>
                              ))}
                           </div>
                        </div>

                        {/* Section 2 */}
                        <div className="space-y-6">
                           <h4 className="text-[12px] font-black text-[#4F46E5] uppercase tracking-[0.2em] border-b border-indigo-50 pb-2">RECOMMENDED ACTIONS</h4>
                           <div className="bg-indigo-50/30 rounded-2xl p-6 border border-indigo-50/50 space-y-4">
                              <ul className="space-y-4">
                                 {[
                                   "Immediate deployment of 4 mobile water tankers to Zone 7.",
                                   "Direct audit of health department payroll for the Q1 period.",
                                   "Setup of 5 localized \"Help Desks\" at KR Puram Market."
                                 ].map((action, i) => (
                                   <li key={i} className="flex gap-3 items-start text-sm font-bold text-[#1E1B4B]">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] mt-1.5 shrink-0" />
                                      {action}
                                   </li>
                                 ))}
                              </ul>
                           </div>
                        </div>

                        {/* Section 3 - Stats */}
                        <div className="space-y-6">
                           <h4 className="text-[12px] font-black text-[#4F46E5] uppercase tracking-[0.2em] border-b border-indigo-50 pb-2">SUPPORTING DATA</h4>
                           <div className="aspect-[2/1] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300 gap-4">
                              <LayoutDashboard className="w-8 h-8 opacity-20" />
                              <span className="text-[10px] font-black uppercase tracking-widest leading-none">Impact Latency Visualization Active</span>
                           </div>
                        </div>

                        {/* Footer Section */}
                        <div className="flex items-center justify-between pt-12 mt-12 border-t border-slate-50">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-500">
                                 <CheckCircle2 className="w-5 h-5" />
                              </div>
                              <div className="space-y-0.5">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">TRUST FABRIC SCORE</p>
                                 <p className="text-lg font-black text-[#1A1A3D]">98.4%</p>
                              </div>
                           </div>
                           <div className="text-right space-y-0.5">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">NGO VERIFICATION</p>
                              <p className="text-sm font-black text-indigo-600">Nexus Community Verified</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex justify-between items-center pt-4">
                     <button className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1.5 transition-colors">
                        Edit manually
                     </button>
                     <button className="text-xs font-black text-[#4F46E5] uppercase tracking-widest flex items-center gap-1 hover:underline">
                        Full preview <ChevronRight className="w-3.5 h-3.5" />
                     </button>
                  </div>
               </div>
            </div>

            {/* Right Column - Controls + History */}
            <div className="lg:col-span-2 space-y-8">
               {/* Send to Government Card */}
               <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-8">
                  <div className="flex items-center gap-3 mb-2">
                     <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-[#4F46E5]">
                        <Send className="w-4 h-4" />
                     </div>
                     <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest">Send to Government</h3>
                  </div>

                  <div className="space-y-6">
                     <div className="space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">RECIPIENT</label>
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 group">
                           <div className="flex items-center gap-3">
                              <Building2 className="w-4 h-4 text-slate-400" />
                              <span className="text-sm font-bold text-[#1A1A3D]">District Collector Office (Bengaluru)</span>
                           </div>
                           <button className="text-slate-300 hover:text-[#4F46E5] transition-colors"><Plus className="w-4 h-4" /></button>
                        </div>
                     </div>

                     <div className="space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">DELIVERY METHOD</label>
                        <div className="grid grid-cols-3 gap-2">
                           {["Email", "API Pull", "Post"].map(m => (
                              <button key={m} className={cn("py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all", m === "Email" ? "bg-white text-[#4F46E5] border-indigo-100 shadow-sm" : "bg-transparent text-slate-400 border-slate-50")}>
                                 {m}
                              </button>
                           ))}
                        </div>
                     </div>

                     <Button className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-black py-7 rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 group transition-all active:scale-[0.98]">
                        Send Policy Brief Now <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                     </Button>
                  </div>
               </div>

               {/* Gemini Intelligence */}
               <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-6 bg-gradient-to-br from-white to-indigo-50/30">
                  <div className="flex items-center justify-between">
                     <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest flex items-center gap-2">Gemini Intelligence <Sparkles className="w-4 h-4 text-indigo-400" /></h3>
                  </div>
                  <div className="space-y-4">
                     {[
                       "Food insecurity in Hebbal affects 34% more families than Feb.",
                       "Cross-district water migration detected in southern wards.",
                       "Healthcare accessibility drop correlated with monsoon prep.",
                       "Sanitation grievance volume has reached \"Intervention\" threshold.",
                       "Urban education subsidy awareness is at a record 12-month low."
                     ].map((insight, i) => (
                        <div key={i} className="flex gap-3">
                           <div className="w-1 h-1 rounded-full bg-[#4F46E5] mt-1.5 shrink-0" />
                           <p className="text-[13px] text-slate-600 font-bold leading-relaxed">{insight}</p>
                        </div>
                     ))}
                  </div>
               </div>

               {/* Outcome History */}
               <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-6">
                  <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest">Outcome History</h3>
                  <div className="space-y-4">
                     <div className="p-5 bg-green-50/50 rounded-2xl border border-green-100 border-l-[3px] border-l-green-500 space-y-2">
                        <div className="flex items-center gap-2">
                           <TrendingDown className="w-3.5 h-3.5 text-green-600" />
                           <span className="text-[9px] font-black text-green-700 uppercase tracking-widest">JAN 2026 BRIEF IMPACT</span>
                        </div>
                        <p className="text-[13px] font-bold text-[#166534]">Government allocated ₹2.4L for water purification in Kadugodi.</p>
                     </div>
                  </div>
               </div>

               {/* SDG Alignment */}
               <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-6">
                  <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest">Global Alignment</h3>
                  <div className="flex flex-wrap gap-2">
                     <Badge className="bg-[#E5243B] hover:bg-[#E5243B] text-white border-none font-bold text-[9px] uppercase px-3 py-1">SDG 1: No Poverty</Badge>
                     <Badge className="bg-[#4C9F38] hover:bg-[#4C9F38] text-white border-none font-bold text-[9px] uppercase px-3 py-1">SDG 3: Good Health</Badge>
                     <Badge className="bg-[#DD1367] hover:bg-[#DD1367] text-white border-none font-bold text-[9px] uppercase px-3 py-1">SDG 10: Reduced Inequality</Badge>
                     <Badge className="bg-[#00689D] hover:bg-[#00689D] text-white border-none font-bold text-[9px] uppercase px-3 py-1">SDG 16: Peace & Justice</Badge>
                     <Badge className="bg-[#19486A] hover:bg-[#19486A] text-white border-none font-bold text-[9px] uppercase px-3 py-1">SDG 17: Partnerships</Badge>
                  </div>
               </div>

               {/* Past Briefs List */}
               <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-6">
                  <div className="flex items-center justify-between">
                     <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest">Past Briefs</h3>
                     <button className="text-[10px] font-black text-[#4F46E5] uppercase tracking-widest hover:underline">View All</button>
                  </div>
                  <div className="space-y-4">
                     {[
                       { month: "February 2026", date: "Feb 1, 2026", status: "SENT" },
                       { month: "January 2026", date: "Jan 3, 2026", status: "SENT" },
                       { month: "December 2025", date: "Dec 2, 2025", status: "DRAFT" }
                     ].map((brief, i) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:shadow-sm transition-all group cursor-pointer">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-[#4F46E5] transition-colors">
                                 {brief.status === "SENT" ? <FileText className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                              </div>
                              <div className="space-y-0.5">
                                 <p className="text-sm font-bold text-[#1A1A3D]">{brief.month}</p>
                                 <p className="text-[10px] font-medium text-slate-400">{brief.date}</p>
                              </div>
                           </div>
                           <Badge className={cn("text-[9px] font-black border-none px-2", brief.status === "SENT" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400")}>
                             {brief.status}
                           </Badge>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivingConstitution;