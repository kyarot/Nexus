import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
   Send,
   Plus,
   LayoutDashboard,
   Shield,
   Clock,
   ChevronRight,
   Calendar,
   TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
   getCoordinatorInsights,
   getImpactReportSummary,
   sendImpactPolicyBrief,
} from "@/lib/coordinator-api";

const parseDate = (value?: string | null) => {
   if (!value) {
      return null;
   }
   const parsed = new Date(value);
   return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatMonthYear = (value?: string | null) => {
   const parsed = parseDate(value);
   if (!parsed) {
      return "Latest";
   }
   return parsed.toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

const formatShortDate = (value?: string | null) => {
   const parsed = parseDate(value);
   if (!parsed) {
      return "--";
   }
   return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const PERIOD_LABELS: Record<string, string> = {
   "1m": "Last 30 days",
   "3m": "Last 3 months",
   "6m": "Last 6 months",
   "1y": "Last 12 months",
};

const LivingConstitution = () => {
  const [tone, setTone] = useState("formal");
  const [language, setLanguage] = useState("English");
   const [deliveryMethod, setDeliveryMethod] = useState("Email");
   const [sending, setSending] = useState(false);
   const token = localStorage.getItem("nexus_access_token");
   const { toast } = useToast();
   const period = "3m";

   const reportQuery = useQuery({
      queryKey: ["living-constitution-report", token, period],
      enabled: Boolean(token),
      refetchInterval: 20_000,
      queryFn: () => getImpactReportSummary(period),
   });

   const insightsQuery = useQuery({
      queryKey: ["living-constitution-insights", token],
      enabled: Boolean(token),
      refetchInterval: 30_000,
      queryFn: () => getCoordinatorInsights(),
   });

   const report = reportQuery.data;
   const summary = report?.summary;
   const metrics = report?.metrics;
   const insights = insightsQuery.data?.insights ?? [];
   const policyBriefItems = report?.policyBrief?.items ?? [];

   const briefGeneratedAt = report?.policyBrief?.generatedAt;
   const briefTitle = `${formatMonthYear(briefGeneratedAt)} Policy Brief`;
   const briefPeriodLabel = PERIOD_LABELS[period] ?? "Recent period";
   const briefStatusLabel = briefGeneratedAt
      ? `${formatMonthYear(briefGeneratedAt)} brief generated`
      : "No policy brief generated yet";
   const refId = report?.policyBrief?.sourceInsightId
      ? report.policyBrief.sourceInsightId.slice(0, 12).toUpperCase()
      : "NEX-AUTO";
   const priorityLabel = insights[0]?.severity === "critical"
      ? "Critical"
      : insights[0]?.severity === "high"
         ? "High"
         : "Standard";
   const orgName = report?.organization?.name || "NGO Partner";

   const topNeeds = useMemo(() => {
      return insights.slice(0, 3).map((insight, index) => {
         const signalLabel = insight.signals?.[0]?.label;
         const zoneLabel = insight.zoneName || "priority zone";
         const title = signalLabel ? `${signalLabel} in ${zoneLabel}` : `Escalation in ${zoneLabel}`;
         const desc = insight.summary || "No summary available yet.";
         return {
            id: String(index + 1).padStart(2, "0"),
            title,
            desc,
         };
      });
   }, [insights]);

   const recommendedActions = useMemo(() => {
      return policyBriefItems.slice(0, 4);
   }, [policyBriefItems]);

   const intelligenceItems = useMemo(() => {
      const items: string[] = [];
      insights.forEach((insight) => {
         if (insight.summary) {
            items.push(insight.summary);
         }
         insight.signals?.forEach((signal) => {
            if (signal?.label) {
               items.push(signal.label);
            }
         });
      });
      return items.filter(Boolean).slice(0, 5);
   }, [insights]);

   const outcomeHistory = useMemo(() => {
      const rows = report?.ledger ?? [];
      return rows.slice(0, 2).map((row) => {
         const change = typeof row.change === "number" ? row.change : 0;
         const delta = Math.abs(change);
         const direction = change < 0 ? "reduced" : "increased";
         const zone = row.zone || "Zone";
         const mission = row.mission ? String(row.mission).slice(0, 6) : "mission";
         return `${zone} need score ${direction} by ${delta} points after mission ${mission}.`;
      });
   }, [report]);

   const pastBriefs = useMemo(() => {
      const seen = new Set<string>();
      const items = [] as Array<{ month: string; date: string; status: string }>;
      insights.forEach((insight) => {
         const generatedAt = parseDate(insight.generatedAt || null);
         if (!generatedAt) {
            return;
         }
         const key = `${generatedAt.getFullYear()}-${generatedAt.getMonth()}`;
         if (seen.has(key)) {
            return;
         }
         seen.add(key);
         items.push({
            month: generatedAt.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
            date: formatShortDate(generatedAt.toISOString()),
            status: (insight.status || "auto").toUpperCase(),
         });
      });
      return items.slice(0, 3);
   }, [insights]);

   const sdgBadges = useMemo(() => {
      const text = insights
         .map((insight) => [insight.summary, ...(insight.signals?.map((signal) => signal.label) || [])].join(" "))
         .join(" ")
         .toLowerCase();

      const library = [
         { label: "SDG 2: Zero Hunger", color: "bg-[#DDA63A]", keywords: ["food", "hunger", "nutrition"] },
         { label: "SDG 3: Good Health", color: "bg-[#4C9F38]", keywords: ["health", "clinic", "medical"] },
         { label: "SDG 4: Quality Education", color: "bg-[#C5192D]", keywords: ["school", "education", "literacy"] },
         { label: "SDG 6: Clean Water", color: "bg-[#26BDE2]", keywords: ["water", "sanitation"] },
         { label: "SDG 11: Sustainable Cities", color: "bg-[#FD9D24]", keywords: ["shelter", "housing", "eviction"] },
         { label: "SDG 16: Peace & Justice", color: "bg-[#00689D]", keywords: ["safety", "violence", "crime"] },
      ];

      return library.filter((item) => item.keywords.some((keyword) => text.includes(keyword))).slice(0, 5);
   }, [insights]);

   const trustScore = typeof metrics?.missionSuccessRate === "number"
      ? `${Math.round(metrics.missionSuccessRate)}%`
      : "--";

   const handleRefresh = () => {
      reportQuery.refetch();
      insightsQuery.refetch();
      toast({ title: "Brief refreshed", description: "Latest policy signals loaded." });
   };

   const handleSendBrief = async () => {
      if (sending) {
         return;
      }
      setSending(true);
      try {
         const channel = deliveryMethod === "API Pull" ? "api_pull" : deliveryMethod.toLowerCase();
         await sendImpactPolicyBrief(period, {
            recipient: "district_collector",
            channel,
         });
         toast({ title: "Policy brief queued", description: "Delivery request sent to the district collector." });
      } catch (error) {
         const message = error instanceof Error ? error.message : "Unable to send policy brief.";
         toast({ title: "Send failed", description: message, variant: "destructive" });
      } finally {
         setSending(false);
      }
   };

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
                           {briefStatusLabel}
                </div>
                        <span className="text-[10px] font-black opacity-40 font-mono tracking-tighter">REF ID: {refId}</span>
              </div>
            </div>
            
                  <Button
                     className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] hover:opacity-90 text-white font-bold h-12 px-6 rounded-xl shadow-lg shadow-indigo-200"
                     disabled={sending}
                     onClick={handleSendBrief}
                  >
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
                        <h3 className="text-lg font-bold text-[#1A1A3D]">{briefTitle}</h3>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                           <Calendar className="w-3.5 h-3.5" /> Period: {briefPeriodLabel}
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          className="h-9 px-3 rounded-lg text-[#4F46E5] hover:bg-indigo-50 font-bold text-xs"
                          onClick={handleRefresh}
                          disabled={reportQuery.isFetching || insightsQuery.isFetching}
                        >
                           <RefreshCw className="w-3.5 h-3.5 mr-2" /> Regenerate
                        </Button>
                        <select
                          className="h-9 bg-slate-50 border-none rounded-lg px-3 text-xs font-bold text-slate-600 focus:ring-1 ring-indigo-100"
                          value={language}
                          onChange={(event) => setLanguage(event.target.value)}
                        >
                           <option value="English">English</option>
                           <option value="Hindi">Hindi</option>
                           <option value="Kannada">Kannada</option>
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
                           <p className="text-[10px] font-black opacity-60 uppercase tracking-[0.2em]">OFFICIAL POLICY BRIEF • {refId}</p>
                           <h2 className="text-3xl font-black">Executive Summary</h2>
                        </div>
                        <div className="flex gap-3 relative z-10">
                           <Badge className="bg-white/10 hover:bg-white/10 text-white border-white/20 font-bold px-3 py-1">Priority: {priorityLabel}</Badge>
                           <Badge className="bg-white/10 hover:bg-white/10 text-white border-white/20 font-bold px-3 py-1">Organization: {orgName}</Badge>
                        </div>
                     </div>

                     <div className="p-12 flex-1 space-y-12">
                        {/* Section 1 */}
                        <div className="space-y-6">
                           <h4 className="text-[12px] font-black text-[#4F46E5] uppercase tracking-[0.2em] border-b border-indigo-50 pb-2">TOP 10 UNMET NEEDS</h4>
                           <div className="space-y-8">
                              {topNeeds.length ? (
                                topNeeds.map((need) => (
                                  <div key={need.id} className="flex gap-6 group">
                                     <span className="text-2xl font-black text-slate-100 group-hover:text-indigo-100 transition-colors font-mono">{need.id}</span>
                                     <div className="space-y-2">
                                        <h5 className="font-bold text-[#1A1A3D] text-[15px]">{need.title}</h5>
                                        <p className="text-sm text-slate-500 leading-relaxed font-medium">{need.desc}</p>
                                     </div>
                                 </div>
                                ))
                              ) : (
                                <p className="text-sm text-slate-400 font-medium">No priority needs detected yet.</p>
                              )}
                           </div>
                        </div>

                        {/* Section 2 */}
                        <div className="space-y-6">
                           <h4 className="text-[12px] font-black text-[#4F46E5] uppercase tracking-[0.2em] border-b border-indigo-50 pb-2">RECOMMENDED ACTIONS</h4>
                           <div className="bg-indigo-50/30 rounded-2xl p-6 border border-indigo-50/50 space-y-4">
                              <ul className="space-y-4">
                                                 {recommendedActions.length ? (
                                                    recommendedActions.map((action, i) => (
                                                       <li key={i} className="flex gap-3 items-start text-sm font-bold text-[#1E1B4B]">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] mt-1.5 shrink-0" />
                                                            {action}
                                                       </li>
                                                    ))
                                                 ) : (
                                                    <li className="text-sm text-slate-400 font-medium">No recommended actions yet.</li>
                                                 )}
                              </ul>
                           </div>
                        </div>

                        {/* Section 3 - Stats */}
                        <div className="space-y-6">
                           <h4 className="text-[12px] font-black text-[#4F46E5] uppercase tracking-[0.2em] border-b border-indigo-50 pb-2">SUPPORTING DATA</h4>
                           <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="space-y-1">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Completed Missions</p>
                                 <p className="text-xl font-black text-[#1A1A3D]">{summary?.completedMissions ?? 0}</p>
                              </div>
                              <div className="space-y-1">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Families Reached</p>
                                 <p className="text-xl font-black text-[#1A1A3D]">{metrics?.familiesReached ?? 0}</p>
                              </div>
                              <div className="space-y-1">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Need Score Shift</p>
                                 <p className="text-xl font-black text-[#1A1A3D]">-{metrics?.avgNeedReduction ?? 0}%</p>
                              </div>
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
                                 <p className="text-lg font-black text-[#1A1A3D]">{trustScore}</p>
                              </div>
                           </div>
                           <div className="text-right space-y-0.5">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">NGO VERIFICATION</p>
                              <p className="text-sm font-black text-indigo-600">{orgName} Verified</p>
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
                           {["Email", "API Pull", "Post"].map((method) => (
                              <button
                                key={method}
                                type="button"
                                onClick={() => setDeliveryMethod(method)}
                                className={cn(
                                  "py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all",
                                  deliveryMethod === method
                                    ? "bg-white text-[#4F46E5] border-indigo-100 shadow-sm"
                                    : "bg-transparent text-slate-400 border-slate-50"
                                )}
                              >
                                 {method}
                              </button>
                           ))}
                        </div>
                     </div>

                     <Button
                       className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-black py-7 rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 group transition-all active:scale-[0.98]"
                       disabled={sending || reportQuery.isFetching}
                       onClick={handleSendBrief}
                     >
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
                     {intelligenceItems.length ? (
                       intelligenceItems.map((insight, i) => (
                          <div key={i} className="flex gap-3">
                             <div className="w-1 h-1 rounded-full bg-[#4F46E5] mt-1.5 shrink-0" />
                             <p className="text-[13px] text-slate-600 font-bold leading-relaxed">{insight}</p>
                          </div>
                       ))
                     ) : (
                       <p className="text-[13px] text-slate-400 font-bold">No new intelligence yet.</p>
                     )}
                  </div>
               </div>

               {/* Outcome History */}
               <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-6">
                  <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest">Outcome History</h3>
                  <div className="space-y-4">
                     {outcomeHistory.length ? (
                       outcomeHistory.map((outcome, index) => (
                         <div key={`${outcome}-${index}`} className="p-5 bg-green-50/50 rounded-2xl border border-green-100 border-l-[3px] border-l-green-500 space-y-2">
                            <div className="flex items-center gap-2">
                               <TrendingDown className="w-3.5 h-3.5 text-green-600" />
                               <span className="text-[9px] font-black text-green-700 uppercase tracking-widest">RECENT OUTCOME</span>
                            </div>
                            <p className="text-[13px] font-bold text-[#166534]">{outcome}</p>
                         </div>
                       ))
                     ) : (
                       <p className="text-[13px] font-bold text-slate-400">No verified outcomes yet.</p>
                     )}
                  </div>
               </div>

               {/* SDG Alignment */}
               <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-6">
                  <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest">Global Alignment</h3>
                           <div className="flex flex-wrap gap-2">
                               {sdgBadges.length ? (
                                  sdgBadges.map((badge) => (
                                     <Badge
                                        key={badge.label}
                                        className={`${badge.color} text-white border-none font-bold text-[9px] uppercase px-3 py-1`}
                                     >
                                        {badge.label}
                                     </Badge>
                                  ))
                               ) : (
                                  <p className="text-[11px] font-bold text-slate-400">No SDG alignment generated yet.</p>
                               )}
                           </div>
               </div>

               {/* Past Briefs List */}
               <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-6">
                  <div className="flex items-center justify-between">
                     <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest">Past Briefs</h3>
                     <button className="text-[10px] font-black text-[#4F46E5] uppercase tracking-widest hover:underline">View All</button>
                  </div>
                  <div className="space-y-4">
                     {pastBriefs.length ? (
                       pastBriefs.map((brief, i) => (
                          <div key={`${brief.month}-${i}`} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:shadow-sm transition-all group cursor-pointer">
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
                       ))
                     ) : (
                       <p className="text-[11px] font-bold text-slate-400">No past briefs found.</p>
                     )}
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