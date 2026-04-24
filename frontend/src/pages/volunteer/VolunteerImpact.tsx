import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getVolunteerImpact } from "@/lib/coordinator-api";
import { Download, Trophy, ChevronRight, Lock, Linkedin, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNexusGoogleMapsLoader } from "@/lib/google-maps";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { GoogleMap, MarkerF } from "@react-google-maps/api";
import { downloadNexusPdfReport } from "@/lib/pdf-report";

type TimeRange = "month" | "3m" | "6m" | "all";

const rangeTabs: Array<{ label: string; value: TimeRange }> = [
  { label: "This Month", value: "month" },
  { label: "3 Months", value: "3m" },
  { label: "6 Months", value: "6m" },
  { label: "All Time", value: "all" },
];

const dnaLabels = ["skill", "reach", "consistency", "proximity", "urgency", "empathy"] as const;

const clampPercent = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const riskBadge = (risk: string) => {
  if (["high", "critical"].includes(risk.toLowerCase())) {
    return { text: "HIGH RISK — TAKE A PAUSE", className: "text-red-600 bg-red-50" };
  }
  if (["medium", "moderate"].includes(risk.toLowerCase())) {
    return { text: "MODERATE RISK — STAY BALANCED", className: "text-amber-600 bg-amber-50" };
  }
  return { text: "LOW RISK — YOU ARE DOING WELL", className: "text-emerald-600 bg-emerald-50" };
};

const buildDnaPolygon = (values: number[], center = 100, radius = 72) => {
  return values
    .map((score, index) => {
      const angle = ((Math.PI * 2) / values.length) * index - Math.PI / 2;
      const scaled = radius * (clampPercent(score) / 100);
      const x = center + Math.cos(angle) * scaled;
      const y = center + Math.sin(angle) * scaled;
      return `${x},${y}`;
    })
    .join(" ");
};

export default function MyImpact() {
  const [range, setRange] = useState<TimeRange>("3m");
  const { data: impact, isLoading } = useQuery({
    queryKey: ["volunteer-impact", range],
    queryFn: () => getVolunteerImpact(range),
    refetchInterval: 15000,
  });

  const summaryCards = [
    { ...impact?.summaryCards?.familiesHelped, color: "border-[#4F46E5]", deltaColor: "text-emerald-500" },
    { ...impact?.summaryCards?.needScoreReduced, color: "border-emerald-500", deltaColor: "text-slate-400" },
    { ...impact?.summaryCards?.totalHours, color: "border-amber-500", deltaColor: "text-slate-400" },
    { ...impact?.summaryCards?.impactPoints, color: "border-violet-500", deltaColor: "text-slate-400" },
  ];

  const timelineData = impact?.timeline ?? [];
  const wellbeing = impact?.wellbeing;
  const badgeStyle = riskBadge(wellbeing?.risk || "low");

  const gmapsApiKey = import.meta.env.VITE_GMAPS_KEY || "";
  const { isLoaded: isImpactMapLoaded } = useNexusGoogleMapsLoader();

  const impactedZones = useMemo(
    () =>
      (impact?.zones || []).filter(
        (zone) => Number.isFinite(zone.lat) && Number.isFinite(zone.lng) && (zone.lat !== 0 || zone.lng !== 0),
      ),
    [impact?.zones],
  );

  const mapCenter = useMemo(() => {
    if (!impactedZones.length) {
      return { lat: 12.9716, lng: 77.5946 };
    }
    const avgLat = impactedZones.reduce((sum, zone) => sum + zone.lat, 0) / impactedZones.length;
    const avgLng = impactedZones.reduce((sum, zone) => sum + zone.lng, 0) / impactedZones.length;
    return { lat: avgLat, lng: avgLng };
  }, [impactedZones]);

  const dnaValues = dnaLabels.map((key) => impact?.dna?.[key] ?? 50);
  const dnaPolygon = buildDnaPolygon(dnaValues);
  const xpProgress = clampPercent(((impact?.rank?.xp ?? 0) / Math.max(1, impact?.rank?.xpTarget ?? 1)) * 100);

  const handleDownloadReport = () => {
    if (!impact) {
      return;
    }
    downloadNexusPdfReport({
      fileName: `nexus-impact-${range}.pdf`,
      reportTitle: "Nexus Volunteer Impact Report",
      reportSubtitle: "Personal impact summary with wellbeing, rank, and verified outcomes.",
      generatedAt: new Date().toISOString(),
      meta: [
        { label: "Range", value: range },
        { label: "Rank", value: impact.rank.title },
        { label: "Level", value: String(impact.rank.level) },
      ],
      metrics: [
        { label: "Families Helped", value: impact.summaryCards.familiesHelped.value, note: impact.summaryCards.familiesHelped.delta },
        { label: "Need Reduced", value: impact.summaryCards.needScoreReduced.value, note: impact.summaryCards.needScoreReduced.delta },
        { label: "Total Hours", value: impact.summaryCards.totalHours.value, note: impact.summaryCards.totalHours.delta },
        { label: "Impact Points", value: impact.summaryCards.impactPoints.value, note: impact.summaryCards.impactPoints.delta },
      ],
      sections: [
        {
          title: "Wellbeing",
          lines: [
            `Risk: ${impact.wellbeing.risk}`,
            `Score: ${impact.wellbeing.score}`,
            `30d Missions: ${impact.wellbeing.activity30d.missions}`,
            `30d Avg Duration: ${impact.wellbeing.activity30d.avgDurationMinutes} min`,
            `Rest Days: ${impact.wellbeing.activity30d.restDays}`,
            impact.wellbeing.advice,
          ],
        },
        {
          title: "Badges",
          lines: impact.badges.length ? impact.badges : ["No badges yet."],
        },
        {
          title: "Share Summary",
          lines: [impact.share.headline, impact.share.shareText],
        },
      ],
      tables: [
        {
          title: "Impact Ledger",
          headers: ["Mission", "Zone", "Before", "After", "Delta", "Date"],
          rows: impact.ledger.map((row) => [row.missionId.slice(0, 8), row.zone, row.beforeScore, row.afterScore, row.deltaScore, row.date]),
        },
      ],
      footerNote: "Nexus volunteer impact report.",
    });
  };

  const handleCopyShareLink = async () => {
    if (!impact?.share?.shareUrl) {
      return;
    }
    await navigator.clipboard.writeText(impact.share.shareUrl);
  };

  const handleLinkedInShare = () => {
    if (!impact?.share) {
      return;
    }
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(impact.share.shareUrl)}&summary=${encodeURIComponent(impact.share.shareText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7FF] font-['Plus_Jakarta_Sans']">
      <DashboardTopBar breadcrumb="Menu / My Impact" />

      <div className="flex-1 p-8 max-w-[1600px] mx-auto w-full space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[2rem] font-bold text-[#1A1A3D] tracking-tight">My Impact</h1>
            <p className="text-slate-500 font-medium text-base mt-1">Your verified contribution to community wellbeing</p>
          </div>
          <Button onClick={handleDownloadReport} className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] hover:opacity-90 text-white font-bold h-12 px-6 rounded-xl flex gap-2 shadow-lg shadow-indigo-100 transition-all border-none">
            <Download className="w-4 h-4" /> Download Impact Report
          </Button>
        </header>

        <div className="flex gap-2 p-1.5 bg-slate-200/30 rounded-2xl w-fit">
          {rangeTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setRange(tab.value)}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                range === tab.value ? "bg-white text-[#4F46E5] shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {summaryCards.map((m, i) => (
            <div key={i} className={cn("bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 border-l-[6px] flex flex-col justify-between", m.color)}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{m.label || "..."}</p>
              <span className="text-[2rem] font-black text-[#1A1A3D] leading-none">{m.value || (isLoading ? "..." : "0")}</span>
              <p className={cn("text-[10px] font-bold mt-2 uppercase tracking-widest", m.deltaColor)}>{m.delta || ""}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          <div className="xl:col-span-2 space-y-6">
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
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#1A1A3D", fontSize: 12, fontWeight: 700 }} dy={20} />
                    <YAxis hide />
                    <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                    <Bar dataKey="points" radius={[8, 8, 0, 0]} barSize={45}>
                      {timelineData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.points > entry.avg ? "#4F46E5" : entry.points > 0 ? "#818CF8" : "#C7D2FE"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

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
                  {(impact?.ledger || []).map((row, i) => (
                    <div key={i} className="grid grid-cols-5 py-6 items-center border-b border-slate-50 last:border-0">
                      <div className="text-base font-bold text-[#1A1A3D]">{row.name}</div>
                      <div className="text-sm font-medium text-slate-500">{row.zone}</div>
                      <div className="text-sm font-bold text-[#1A1A3D] tabular-nums">{row.beforeScore} → {row.afterScore}</div>
                      <div>
                        <Badge className={cn("border-none py-2 px-4 rounded-full text-xs font-bold", row.type === "pos" ? "bg-[#9AF7C9]/40 text-[#059669]" : "bg-red-50 text-red-600")}>
                          {row.deltaScore >= 0 ? `+${row.deltaScore}` : row.deltaScore} pts
                        </Badge>
                      </div>
                      <div className="text-sm font-bold text-slate-400 text-right">{row.date}</div>
                    </div>
                  ))}
                  {!impact?.ledger?.length ? <p className="text-sm text-slate-400 py-3">No verified ledger entries for this range.</p> : null}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 space-y-6">
              <h2 className="text-xl font-bold text-[#1A1A3D]">Zones you have impacted</h2>
              <div className="relative h-64 bg-slate-100 rounded-2xl overflow-hidden shadow-inner border border-white/50 group">
                {!gmapsApiKey ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#E2E8F0]">
                    <p className="text-sm font-semibold text-slate-500">Set VITE_GMAPS_KEY to display live impacted locations</p>
                  </div>
                ) : !isImpactMapLoaded ? (
                  <div className="absolute inset-0 animate-pulse bg-[#E2E8F0]" />
                ) : (
                  <GoogleMap
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    center={mapCenter}
                    zoom={11}
                    onLoad={(map) => {
                      if (!impactedZones.length) {
                        return;
                      }
                      const bounds = new google.maps.LatLngBounds();
                      impactedZones.forEach((zone) => bounds.extend({ lat: zone.lat, lng: zone.lng }));
                      map.fitBounds(bounds);
                      if (impactedZones.length === 1) {
                        map.setZoom(12);
                      }
                    }}
                    options={{
                      disableDefaultUI: true,
                      zoomControl: true,
                      mapTypeControl: false,
                      streetViewControl: false,
                      fullscreenControl: false,
                    }}
                  >
                    {impactedZones.map((zone) => (
                      <MarkerF
                        key={zone.zoneId}
                        position={{ lat: zone.lat, lng: zone.lng }}
                        title={`${zone.name} · ${zone.missionCount} missions`}
                        label={{
                          text: String(zone.missionCount),
                          color: "#FFFFFF",
                          fontSize: "11px",
                          fontWeight: "700",
                        }}
                      />
                    ))}
                  </GoogleMap>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {(impact?.zones || []).map((z, i) => (
                  <Badge key={i} className="bg-indigo-50/70 text-[#4F46E5] border border-indigo-100/30 px-4 py-2 rounded-xl font-bold text-xs ring-0">
                    {z.name} <span className="opacity-50 ml-2 font-medium">{z.missionCount} missions</span>
                  </Badge>
                ))}
                {!impact?.zones?.length ? <p className="text-sm text-slate-400">No impacted zones in this period.</p> : null}
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 border-l-[6px] border-l-emerald-500">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-[#1A1A3D]">Your Wellbeing</h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">Private — only you see this</p>
                </div>
                <Badge className={cn("font-black text-[9px] tracking-widest px-3 py-1.5 rounded-full ring-0", badgeStyle.className)}>
                  {badgeStyle.text}
                </Badge>
              </div>

              <div className="space-y-8">
                <div className="space-y-2">
                  <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden relative">
                    <div className="h-full w-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 opacity-20" />
                    <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" style={{ width: `${Math.max(4, clampPercent(100 - (wellbeing?.score || 0)))}%` }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-4 border-emerald-500 shadow-lg -ml-2" style={{ left: `${Math.max(4, clampPercent(100 - (wellbeing?.score || 0)))}%` }} />
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#1A1A3D]/40">Last 30 days activity:</p>
                  <div className="flex gap-4">
                    {[
                      `${wellbeing?.activity30d?.missions ?? 0} missions`,
                      `Avg ${Math.round(wellbeing?.activity30d?.avgDurationMinutes ?? 0)}min`,
                      `${wellbeing?.activity30d?.restDays ?? 0} rest days`,
                    ].map((item) => (
                      <div key={item} className="bg-slate-50 px-5 py-2.5 rounded-xl text-xs font-bold text-[#1A1A3D]">
                        {item}
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
                    {wellbeing?.advice || "Nexus suggests maintaining your current mission rhythm."}
                  </p>
                </div>

                <Button variant="outline" className="text-slate-400 text-xs font-bold flex gap-2 p-0 border-none hover:bg-transparent hover:text-slate-600 bg-transparent">
                  View Wellbeing Tips <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[#F9F9FF] rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col items-center">
              <h3 className="text-[1.5rem] font-bold text-[#1A1A3D] mb-4 w-full text-center">Impact DNA</h3>
              <div className="relative w-64 h-64 flex items-center justify-center">
                <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-18">
                  <polygon points="100,20 180,80 160,160 40,160 20,80" fill="#E6E6FF" opacity="0.3" />
                  <polygon points="100,40 160,85 145,145 55,145 40,85" fill="#E6E6FF" opacity="0.5" />
                  <polygon points={dnaPolygon} fill="rgba(79, 70, 229, 0.45)" stroke="#4F46E5" strokeWidth="2" />
                </svg>

                <div className="absolute top-0 text-[10px] font-black text-[#1A1A3D]/40 tracking-widest">SKILL</div>
                <div className="absolute right-[-15px] top-[40%] text-[10px] font-black text-[#1A1A3D]/40 tracking-widest">REACH</div>
                <div className="absolute right-[-5px] bottom-10 text-[10px] font-black text-[#1A1A3D]/40 tracking-widest">CONSIST</div>
                <div className="absolute left-[-20px] top-[40%] text-[10px] font-black text-[#1A1A3D]/40 tracking-widest">PROXIMITY</div>
                <div className="absolute left-[-15px] bottom-10 text-[10px] font-black text-[#1A1A3D]/40 tracking-widest">URGENCY</div>
                <div className="absolute bottom-[-10px] text-[10px] font-black text-[#1A1A3D]/40 tracking-widest">EMPATHY</div>
              </div>
            </div>

            <div className="bg-[#F9F9FF] rounded-[2rem] p-8 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-[1.5rem] font-bold text-[#1A1A3D]">Impact Badges</h3>
                <button className="text-[#4F46E5] text-sm font-bold border-b-2 border-[#4F46E5] pb-0.5">View All</button>
              </div>

              <div className="grid grid-cols-3 gap-6">
                {[
                  { icon: "🍃", name: (impact?.badges?.[0] || "ECO-GUARDIAN").toUpperCase(), color: "text-[#5C4033]" },
                  { icon: "🤝", name: (impact?.badges?.[1] || "HIGH EMPATHY").toUpperCase(), color: "text-[#4F46E5]" },
                  { icon: "🌱", name: (impact?.badges?.[2] || "MIND-CARE").toUpperCase(), color: "text-[#1B4D3E]" },
                  { icon: <Lock className="w-8 h-8 opacity-20" />, name: "CIVIC HERO", locked: true },
                  { icon: <Lock className="w-8 h-8 opacity-20" />, name: "DATA WHIZ", locked: true },
                  { icon: <Lock className="w-8 h-8 opacity-20" />, name: "ZONE LEAD", locked: true },
                ].map((b, i) => (
                  <div key={i} className={cn("flex flex-col items-center justify-center aspect-square rounded-[1.5rem] p-4 text-center transition-all", b.locked ? "border-2 border-dashed border-slate-200" : "bg-white shadow-sm")}>
                    <div className={cn("text-3xl mb-3", b.color)}>{b.icon}</div>
                    <span className={cn("text-[10px] font-black tracking-widest leading-tight", b.locked ? "text-slate-300" : "text-[#1A1A3D]")}>{b.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#1E1B4B] rounded-[2rem] p-8 shadow-sm overflow-hidden relative text-white">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest opacity-60 mb-2">GLOBAL RANK</p>
                  <p className="text-[3rem] font-black leading-none">#{impact?.rank?.globalRank || "-"}</p>
                </div>
                <div className="bg-white/10 px-4 py-2 rounded-full border border-white/20">
                  <span className="text-xs font-black">LVL {impact?.rank?.level || 1}</span>
                </div>
              </div>

              <div className="mt-12 space-y-4">
                <div className="flex justify-between items-end">
                  <h4 className="text-lg font-bold">{impact?.rank?.title || "Rising Volunteer"}</h4>
                  <span className="text-sm font-bold opacity-70">{impact?.rank?.xp || 0} / {impact?.rank?.xpTarget || 1000} XP</span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#5A57FF] shadow-[0_0_12px_rgba(90,87,255,0.6)]" style={{ width: `${xpProgress}%` }} />
                </div>
              </div>

              <div className="absolute bottom-[-20px] right-[-20px] opacity-10 rotate-12">
                <Trophy className="w-32 h-32" />
              </div>
            </div>

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
                    <p className="text-[10px] font-extrabold text-[#1A1A3D]">{impact?.share?.headline || "Helping your community"}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-slate-50 p-1.5 rounded-lg flex flex-col">
                        <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Missions</span>
                        <span className="text-xs font-black text-[#1A1A3D]">{impact?.share?.missions || 0}</span>
                      </div>
                      <div className="bg-indigo-50 p-1.5 rounded-lg flex flex-col">
                        <span className="text-[6px] font-black text-indigo-400 uppercase tracking-widest">Impact</span>
                        <span className="text-xs font-black text-[#4F46E5]">Level {impact?.share?.level || 1}</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-8 -right-8 w-20 h-20 bg-[#4F46E5]/10 rounded-full blur-xl" />
                </div>
              </div>

              <div className="space-y-3">
                <Button onClick={handleLinkedInShare} className="w-full bg-[#0077B5] hover:bg-[#006097] text-white font-bold h-12 rounded-xl flex gap-3 shadow-md border-none ring-0">
                  <Linkedin className="w-5 h-5" fill="currentColor" /> Share on LinkedIn
                </Button>
                <div className="flex flex-col items-center gap-3">
                  <button onClick={handleDownloadReport} className="text-slate-400 text-[11px] font-bold hover:text-slate-600 transition-colors py-2 flex items-center gap-2">
                    <Download className="w-3.5 h-3.5" /> Download as Image
                  </button>
                  <button onClick={handleCopyShareLink} className="text-[#4F46E5] text-[11px] font-black uppercase tracking-widest hover:underline">
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
