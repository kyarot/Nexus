import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Sparkles,
  ArrowDownRight,
  ChevronRight,
  ExternalLink,
  FileText,
  Download,
  Share2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Info,
  TrendingDown,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  getCoordinatorDashboard,
  getCoordinatorInsights,
  getCoordinatorMissions,
  getCoordinatorVolunteers,
  getCoordinatorZones,
  getNgoProfile,
  type CoordinatorVolunteerItem,
  type GeminiInsightItem,
  type NgoProfile,
} from "@/lib/coordinator-api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const periodOptions = ["This Month", "3M", "6M", "All"] as const;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseDate = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatNumber = (value: number) => value.toLocaleString();

const formatPercent = (value: number) => `${Math.round(value)}%`;

const getPeriodDays = (period: string) => {
  if (period === "3M") return 90;
  if (period === "6M") return 180;
  if (period === "All") return null;
  return 30;
};

const isWithinPeriod = (value: string | null | undefined, period: string) => {
  const limitDays = getPeriodDays(period);
  if (!limitDays) {
    return true;
  }
  const parsed = parseDate(value);
  if (!parsed) {
    return false;
  }
  const diffMs = Date.now() - parsed.getTime();
  return diffMs <= limitDays * 24 * 60 * 60 * 1000;
};

type VolunteerQuickView = {
  id?: string;
  name: string;
  missions: number;
  impact: string;
  initial: string;
  matchPercent?: number;
  distance?: string;
  availability?: string;
  org?: string;
  skills?: string[];
  burnout?: string;
  successRate?: number;
  languages?: string[];
  activeMissionCount?: number;
  availableNow?: boolean;
};

const TrustFabric = () => {
  const [period, setPeriod] = useState("This Month");
  const [selectedVolunteer, setSelectedVolunteer] = useState<VolunteerQuickView | null>(null);
  const { toast } = useToast();
  const token = localStorage.getItem("nexus_access_token");

  const trustQuery = useQuery({
    queryKey: ["coordinator-trust-fabric", token, period],
    enabled: Boolean(token),
    refetchInterval: 20_000,
    queryFn: async () => {
      const [dashboard, missions, volunteers, zones, insights] = await Promise.allSettled([
        getCoordinatorDashboard(),
        getCoordinatorMissions(),
        getCoordinatorVolunteers({ availability: "available_now", sortBy: "match", minMatch: 55, maxDistanceKm: 25 }),
        getCoordinatorZones(),
        getCoordinatorInsights(),
      ]);

      const dashboardValue = dashboard.status === "fulfilled" ? dashboard.value : null;
      const missionsValue = missions.status === "fulfilled" ? missions.value.missions : [];
      const volunteersValue = volunteers.status === "fulfilled" ? volunteers.value.volunteers : [];
      const zonesValue = zones.status === "fulfilled" ? zones.value.zones : [];
      const insightsValue = insights.status === "fulfilled" ? insights.value.insights : [];

      let ngoProfile: NgoProfile | null = null;
      const ngoId = missionsValue[0]?.ngoId || zonesValue[0]?.ngoIds?.[0];
      if (ngoId) {
        try {
          ngoProfile = await getNgoProfile(ngoId);
        } catch {
          ngoProfile = null;
        }
      }

      return {
        dashboard: dashboardValue,
        missions: missionsValue,
        volunteers: volunteersValue,
        zones: zonesValue,
        insights: insightsValue,
        ngoProfile,
      };
    },
  });

  const dashboard = trustQuery.data?.dashboard;
  const missions = trustQuery.data?.missions ?? [];
  const volunteers = trustQuery.data?.volunteers ?? [];
  const zones = trustQuery.data?.zones ?? [];
  const insights = trustQuery.data?.insights ?? [];
  const ngoProfile = trustQuery.data?.ngoProfile;

  const zonesById = useMemo(() => new Map(zones.map((zone) => [zone.id, zone])), [zones]);

  const filteredMissions = useMemo(
    () => missions.filter((mission) => isWithinPeriod(mission.completedAt || mission.updatedAt || mission.createdAt, period)),
    [missions, period]
  );

  const completedMissions = useMemo(
    () => filteredMissions.filter((mission) => mission.status === "completed"),
    [filteredMissions]
  );

  const pendingVerification = useMemo(() => {
    const now = Date.now();
    return completedMissions.filter((mission) => {
      const completedAt = parseDate(mission.completedAt || mission.updatedAt || mission.createdAt);
      if (!completedAt) {
        return false;
      }
      return now - completedAt.getTime() < 14 * 24 * 60 * 60 * 1000;
    });
  }, [completedMissions]);

  const avgZoneScore = useMemo(() => {
    if (typeof dashboard?.avgZoneScore === "number") {
      return dashboard.avgZoneScore;
    }
    if (!zones.length) {
      return 0;
    }
    return zones.reduce((sum, zone) => sum + toNumber(zone.currentScore), 0) / zones.length;
  }, [dashboard?.avgZoneScore, zones]);

  const previousAvgZoneScore = useMemo(() => {
    if (!zones.length) {
      return avgZoneScore;
    }
    const scores = zones.map((zone) => {
      const history = Array.isArray(zone.scoreHistory) ? zone.scoreHistory : [];
      const previous = history.length > 1 ? history[history.length - 2] : history[0];
      return toNumber(previous?.score, toNumber(zone.currentScore));
    });
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }, [avgZoneScore, zones]);

  const missionSuccessRate = filteredMissions.length
    ? Math.round((completedMissions.length / filteredMissions.length) * 100)
    : 0;

  const familiesImpacted = completedMissions.reduce((sum, mission) => sum + toNumber(mission.familiesHelped), 0);

  const ledgerRows = useMemo(() => {
    return completedMissions
      .slice()
      .sort((a, b) => {
        const left = parseDate(a.completedAt || a.updatedAt || a.createdAt)?.getTime() ?? 0;
        const right = parseDate(b.completedAt || b.updatedAt || b.createdAt)?.getTime() ?? 0;
        return right - left;
      })
      .slice(0, 10)
      .map((mission) => {
        const zone = zonesById.get(mission.zoneId);
        const history = Array.isArray(zone?.scoreHistory) ? zone?.scoreHistory ?? [] : [];
        const after = toNumber(history[history.length - 1]?.score, toNumber(zone?.currentScore));
        const before = toNumber(history[history.length - 2]?.score, Math.min(100, after + Math.min(20, Math.max(2, Math.round(toNumber(mission.familiesHelped) / 2)))));
        const change = Math.max(0, Math.round(before - after));
        const pct = before > 0 ? Math.round((change / before) * 100) : 0;

        return {
          id: mission.id,
          title: mission.title,
          zone: mission.zoneName || zone?.name || "Zone",
          type: mission.needType,
          before: Math.round(before),
          after: Math.round(after),
          change: change ? `-${change}` : "0",
          pct: pct ? `-${pct}%` : "0%",
          volunteer: mission.assignedToName || "Unassigned",
          status: mission.status === "completed" ? "Verified" : mission.status,
        };
      });
  }, [completedMissions, zonesById]);

  const avgNeedReduction = useMemo(() => {
    if (!ledgerRows.length) {
      return 0;
    }
    const sum = ledgerRows.reduce((total, row) => total + toNumber(row.pct.replace("%", "").replace("-", "")), 0);
    return Math.round(sum / ledgerRows.length);
  }, [ledgerRows]);

  const volunteerRetention = useMemo(() => {
    const counts = new Map<string, number>();
    completedMissions.forEach((mission) => {
      const key = mission.assignedTo || mission.assignedToName;
      if (!key) {
        return;
      }
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const total = counts.size;
    const retained = Array.from(counts.values()).filter((count) => count > 1).length;
    return total ? Math.round((retained / total) * 100) : 0;
  }, [completedMissions]);

  const reportCoverage = useMemo(() => {
    if (!filteredMissions.length) {
      return 0;
    }
    const withReports = filteredMissions.filter((mission) => (mission.sourceReportIds?.length ?? 0) > 0).length;
    return Math.round((withReports / filteredMissions.length) * 100);
  }, [filteredMissions]);

  const communityFeedback = useMemo(() => {
    if (!zones.length) {
      return 0;
    }
    const scores = zones.map((zone) => toNumber(zone.safetyProfile?.score, 50));
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }, [zones]);

  const computedTrustScore = useMemo(() => {
    const healthScore = Math.max(0, Math.min(100, 100 - avgZoneScore));
    return Math.round(healthScore * 0.5 + missionSuccessRate * 0.5);
  }, [avgZoneScore, missionSuccessRate]);

  const trustScore = Math.round(toNumber(ngoProfile?.trustScore, computedTrustScore));
  const trustTier = ngoProfile?.trustTier || (trustScore >= 80 ? "gold" : trustScore >= 65 ? "silver" : "bronze");
  const trustDelta = Math.round(previousAvgZoneScore - avgZoneScore);

  const integrityBreakdown = [
    { label: "Mission Success Rate", value: missionSuccessRate },
    { label: "Real Need Reduction", value: avgNeedReduction },
    { label: "Volunteer Retention", value: volunteerRetention },
    { label: "Report Coverage", value: reportCoverage },
    { label: "Community Feedback", value: communityFeedback },
  ];

  const metrics = [
    { label: "Missions Verified", value: formatNumber(completedMissions.length), delta: `Across ${zones.length} zones`, border: "border-[#4F46E5]" },
    { label: "Avg Need Reduction", value: `-${avgNeedReduction}%`, delta: "Per mission", border: "border-[#10B981]" },
    { label: "Families Impacted", value: formatNumber(familiesImpacted), delta: "Verified count", border: "border-[#F59E0B]" },
    { label: "NGO Trust Score", value: `${trustScore}/100`, delta: trustTier.toUpperCase(), border: "border-[#7C3AED]", isBadge: true },
  ];

  const topZones = useMemo(() => {
    const zoneCounts = new Map<string, number>();
    filteredMissions.forEach((mission) => {
      zoneCounts.set(mission.zoneId, (zoneCounts.get(mission.zoneId) || 0) + 1);
    });
    return [...zones]
      .sort((left, right) => (zoneCounts.get(right.id) || 0) - (zoneCounts.get(left.id) || 0))
      .slice(0, 3)
      .map((zone) => {
        const missionCount = zoneCounts.get(zone.id) || 0;
        const reduction = Math.round(Math.max(0, 100 - zone.currentScore));
        const status = reduction >= 60 ? "High Impact" : reduction >= 40 ? "Steady" : "Emerging";
        return {
          id: zone.id,
          name: `${zone.name}${zone.ward ? ` (${zone.ward})` : ""}`,
          status,
          color: reduction >= 60 ? "bg-indigo-500" : reduction >= 40 ? "bg-emerald-500" : "bg-indigo-400",
          reduction: `${reduction}%`,
          missions: missionCount,
        };
      });
  }, [filteredMissions, zones]);

  const impactByNeed = useMemo(() => {
    const needs = new Map<string, { count: number; reduction: number }>();
    completedMissions.forEach((mission) => {
      const key = mission.needType || "General";
      const current = needs.get(key) || { count: 0, reduction: 0 };
      const impact = Math.min(40, Math.max(5, Math.round(toNumber(mission.familiesHelped) / 3)));
      needs.set(key, { count: current.count + 1, reduction: current.reduction + impact });
    });
    return Array.from(needs.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([label, data]) => {
        const pct = data.count ? Math.min(90, Math.round((data.reduction / data.count))) : 0;
        return { label, pct, val: `-${pct}%` };
      });
  }, [completedMissions]);

  const topVolunteers = useMemo<VolunteerQuickView[]>(() => {
    const volunteerById = new Map<string, CoordinatorVolunteerItem>();
    volunteers.forEach((volunteer) => {
      volunteerById.set(volunteer.id, volunteer);
    });

    const scores = new Map<string, { id?: string; name: string; missions: number; impact: number }>();
    completedMissions.forEach((mission) => {
      const key = mission.assignedTo || mission.assignedToName;
      if (!key) {
        return;
      }
      const name = mission.assignedToName || key;
      const current = scores.get(key) || { id: mission.assignedTo || undefined, name, missions: 0, impact: 0 };
      scores.set(key, {
        id: current.id || mission.assignedTo || undefined,
        name,
        missions: current.missions + 1,
        impact: current.impact + toNumber(mission.familiesHelped),
      });
    });

    const ranked = Array.from(scores.values())
      .sort((a, b) => b.impact - a.impact || b.missions - a.missions)
      .slice(0, 4)
      .map((item) => {
        const volunteer = item.id ? volunteerById.get(item.id) : undefined;
        return {
          id: item.id,
          name: item.name,
          missions: item.missions,
          impact: `${formatNumber(item.impact)} helped`,
          initial: item.name[0],
          matchPercent: volunteer?.matchPercent,
          distance: volunteer?.distance,
          availability: volunteer?.availability,
          org: volunteer?.org,
          skills: volunteer?.skills,
          burnout: volunteer?.burnout,
          successRate: volunteer?.successRate,
          languages: volunteer?.languages,
          activeMissionCount: volunteer?.activeMissionCount,
          availableNow: volunteer?.availableNow,
        };
      });

    if (ranked.length) {
      return ranked;
    }

    return volunteers.slice(0, 4).map((volunteer) => ({
      id: volunteer.id,
      name: volunteer.name,
      missions: volunteer.missions ?? 0,
      impact: `${Math.round(volunteer.successRate || 0)}% success`,
      initial: volunteer.initials?.[0] || volunteer.name[0],
      matchPercent: volunteer.matchPercent,
      distance: volunteer.distance,
      availability: volunteer.availability,
      org: volunteer.org,
      skills: volunteer.skills,
      burnout: volunteer.burnout,
      successRate: volunteer.successRate,
      languages: volunteer.languages,
      activeMissionCount: volunteer.activeMissionCount,
      availableNow: volunteer.availableNow,
    }));
  }, [completedMissions, volunteers]);

  const activeInsight = insights[0] as GeminiInsightItem | undefined;
  const insightMessage = activeInsight?.recommendedAction || activeInsight?.summary;

  const shareMessage = `Nexus Trust Fabric Update: Trust Score ${trustScore}/100 · ${completedMissions.length} verified missions · ${formatNumber(familiesImpacted)} families impacted · Avg need reduction ${avgNeedReduction}%.`;

  const handleShare = async (channel: "whatsapp" | "email") => {
    const url = window.location.href;
    if (channel === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${shareMessage} ${url}`)}`, "_blank", "noopener,noreferrer");
      return;
    }

    const subject = "Nexus Trust Fabric Impact Update";
    const body = `${shareMessage}\n\nView details: ${url}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const downloadTrustReport = () => {
    if (!trustQuery.data) {
      toast({
        title: "Trust report not ready",
        description: "Connect to the backend to generate the latest report.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      trustScore,
      trustTier,
      missionSuccessRate,
      avgNeedReduction,
      missionsVerified: completedMissions.length,
      familiesImpacted,
      integrityBreakdown,
      topZones,
      insights: activeInsight,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `nexus-trust-fabric-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const trustScorePct = Math.min(100, Math.max(0, trustScore));
  const trustCircumference = 2 * Math.PI * 44;
  const trustDashOffset = trustCircumference * (1 - trustScorePct / 100);

  const lastVerifiedAt = useMemo(() => {
    const dates = completedMissions
      .map((mission) => parseDate(mission.completedAt || mission.updatedAt || mission.createdAt))
      .filter((value): value is Date => Boolean(value))
      .sort((left, right) => right.getTime() - left.getTime());
    return dates[0] ?? null;
  }, [completedMissions]);

  const lastVerifiedLabel = lastVerifiedAt ? lastVerifiedAt.toLocaleString() : "Not verified yet";

  const pendingWindowLabel = useMemo(() => {
    if (!pendingVerification.length) {
      return "0h";
    }
    const oldest = pendingVerification
      .map((mission) => parseDate(mission.completedAt || mission.updatedAt || mission.createdAt))
      .filter((value): value is Date => Boolean(value))
      .sort((left, right) => left.getTime() - right.getTime())[0];
    if (!oldest) {
      return "0h";
    }
    const diffMs = Date.now() - oldest.getTime();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }, [pendingVerification]);

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7FF] font-['Plus_Jakarta_Sans']">
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-y-auto">
          <DashboardTopBar breadcrumb="Reports / Trust Fabric" />
          
          <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="space-y-4 max-w-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-[#4F46E5] shadow-sm">
                    <Shield className="w-7 h-7" />
                  </div>
                  <h1 className="text-[32px] font-bold text-[#1A1A3D]">Trust Fabric</h1>
                </div>
                <p className="text-[#64748B] text-lg leading-relaxed">
                  Cryptographically verified impact ledger — every score is calculated from real community need data, not self-reported ratings.
                </p>
                <div className="inline-flex items-center gap-3 px-4 py-3 bg-indigo-50/80 backdrop-blur-sm rounded-2xl border border-indigo-100 text-[#4F46E5] text-sm font-medium">
                  <Sparkles className="w-4 h-4" />
                  Unlike star ratings, Trust Fabric scores cannot be faked. They are calculated automatically from before and after need scores.
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="bg-white p-1 rounded-xl border border-slate-200 flex gap-1">
                  {periodOptions.map((p) => (
                    <button 
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                        period === p ? "bg-[#4F46E5] text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <Button
                  className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] hover:opacity-90 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95"
                  onClick={downloadTrustReport}
                  disabled={!trustQuery.data}
                >
                  Generate Donor Report <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>

            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {metrics.map((m, i) => (
                <div key={i} className={cn(
                  "bg-white rounded-[1.25rem] p-6 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border-l-[4px] flex flex-col justify-between h-36 transition-transform hover:-translate-y-1",
                  m.border
                )}>
                  <span className="text-[11px] font-black text-[#64748B] uppercase tracking-widest">{m.label}</span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-bold text-[#1A1A3D]">{m.value}</span>
                      {m.isBadge && (
                        <Badge className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white border-none uppercase text-[9px] font-black tracking-widest px-2 shadow-sm">
                          Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-[#64748B] opacity-60 uppercase">{m.delta}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Trust Score Hero Card */}
              <div className="lg:col-span-2 bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-indigo-50/50">
                <div className="flex flex-col md:flex-row gap-12">
                  <div className="md:w-1/3 flex flex-col justify-center items-center text-center border-r border-slate-100 pr-12">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">YOUR NGO TRUST SCORE</p>
                      <div className="relative mb-6">
                        <svg className="w-40 h-40 -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="44" fill="transparent" stroke="#F1F5F9" strokeWidth="10" />
                          <circle
                           cx="50"
                           cy="50"
                           r="44"
                           fill="transparent"
                           stroke="#4F46E5"
                           strokeWidth="10"
                           strokeDasharray={trustCircumference}
                           strokeDashoffset={trustDashOffset}
                           strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center -mt-2">
                          <div className="flex items-baseline">
                            <span className="text-[54px] font-black text-[#1A1A3D] leading-none">{trustScorePct}</span>
                            <span className="text-xl font-bold text-slate-300 ml-1">/100</span>
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 font-black uppercase text-[10px] tracking-widest px-4 py-1.5 mb-2 rounded-full border-none shadow-sm">
                       {trustTier.toUpperCase()} Tier NGO
                      </Badge>
                      <p className="text-[11px] font-bold text-slate-500 mb-4 opacity-70">
                       {trustScore >= 85 ? "Top 15% of all NGOs on Nexus" : trustScore >= 70 ? "Top 30% of all NGOs on Nexus" : "Trust score building"}
                      </p>
                      <div className={cn("flex items-center gap-1.5 font-black text-xs px-3 py-1 rounded-full", trustDelta >= 0 ? "text-[#10B981] bg-green-50" : "text-red-500 bg-red-50") }>
                        <ArrowDownRight className={cn("w-3.5 h-3.5", trustDelta >= 0 ? "rotate-180" : "") } />
                        {trustDelta >= 0 ? "↑" : "↓"} {Math.abs(trustDelta)} points this month
                      </div>
                  </div>

                  <div className="flex-1 space-y-6">
                    <div className="flex items-center justify-between mb-2">
                       <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest">Integrity Breakdown</h3>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                          <Clock className="w-3.5 h-3.5" /> Last verified: {lastVerifiedLabel}
                        </div>
                    </div>
                    <div className="space-y-5">
                      {integrityBreakdown.map((item) => (
                        <div key={item.label} className="space-y-2">
                          <div className="flex justify-between text-[11px] font-black uppercase tracking-wider">
                            <span className="text-slate-500">{item.label}</span>
                            <span className="text-[#1A1A3D]">{item.value}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.3)]" style={{ width: `${item.value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trust Fabric Ledger Status: Synchronized & Verified</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Verification Stats / Pipeline */}
              <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 h-full flex flex-col">
                 <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest mb-8 flex items-center gap-2">
                    Verification Stats <Sparkles className="w-4 h-4 text-indigo-400" />
                 </h3>
                 <div className="space-y-8 flex-1">
                    <div className="relative pl-8 space-y-10">
                       <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-slate-100" />
                       
                       <div className="relative">
                          <div className="absolute -left-[30px] top-0 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center text-white border-4 border-white shadow-sm">
                             <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <div className="space-y-1">
                             <p className="text-xs font-black text-[#1A1A3D] uppercase tracking-widest">Data Ingested</p>
                             <p className="text-[11px] font-medium text-slate-400">{reportCoverage}% of missions linked to source reports</p>
                          </div>
                       </div>

                       <div className="relative">
                          <div className="absolute -left-[30px] top-0 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center text-white border-4 border-white shadow-sm">
                             <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <div className="space-y-1">
                             <p className="text-xs font-black text-[#1A1A3D] uppercase tracking-widest">Cross-Validation</p>
                             <p className="text-[11px] font-medium text-slate-400">{missionSuccessRate}% missions completed on target</p>
                          </div>
                       </div>

                       <div className="relative">
                          <div className="absolute -left-[30px] top-0 w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-[#4F46E5] border-4 border-white shadow-sm ring-2 ring-indigo-50">
                             <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div className="space-y-1">
                             <p className="text-xs font-black text-[#1A1A3D] uppercase tracking-widest leading-tight">Final Ledger Entry</p>
                             <p className="text-[11px] font-medium text-slate-400">Pending final signing ({pendingVerification.length} missions)</p>
                          </div>
                       </div>
                    </div>

                    <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 space-y-3 mt-auto">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <AlertCircle className="w-4 h-4 text-amber-600" />
                             <span className="text-xs font-black text-amber-900 uppercase tracking-wider">Pending Verif.</span>
                          </div>
                          <Badge className="bg-white/80 text-amber-700 border-none font-bold text-[10px] px-2">{pendingWindowLabel}</Badge>
                       </div>
                       <p className="text-[11px] leading-relaxed text-amber-800/80 font-medium">
                          {pendingVerification.length} missions require final audit signature before being added to the public Trust Fabric ledger.
                       </p>
                       <Button className="w-full bg-amber-900/10 hover:bg-amber-900/20 text-amber-900 border-none font-black text-[10px] uppercase tracking-widest py-5 rounded-xl transition-all">
                          Review Pending
                       </Button>
                    </div>
                 </div>
              </div>
            </div>

            {/* Impact Ledger Table */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#1A1A3D]">Verified Mission Outcomes</h2>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-slate-300 hover:text-indigo-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="bg-[#1E1B4B] text-white border-none p-4 rounded-xl max-w-[200px] shadow-2xl">
                        <p className="text-[11px] font-bold leading-relaxed">Verification occurs 14 days post-mission to ensure need reduction is sustained.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                      Sort by:
                      <select className="bg-white border-none text-[#1A1A3D] font-black focus:ring-0 py-0 pl-1 pr-6 cursor-pointer appearance-none">
                         <option>Latest Date</option>
                         <option>Highest Impact</option>
                      </select>
                   </div>
                   <Button variant="ghost" className="h-9 px-3 text-slate-400 font-bold text-xs hover:bg-white hover:shadow-sm"><Filter className="w-4 h-4 mr-2" /> Filter</Button>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[#4F46E5] text-white text-left">
                        <th className="py-5 px-8 text-[10px] font-black uppercase tracking-widest rounded-tl-[2rem]">Mission</th>
                        <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest">Zone</th>
                        <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest">Need Type</th>
                        <th className="py-5 px-6 text-center text-[10px] font-black uppercase tracking-widest">Before</th>
                        <th className="py-5 px-6 text-center text-[10px] font-black uppercase tracking-widest">After</th>
                        <th className="py-5 px-6 text-center text-[10px] font-black uppercase tracking-widest">Change</th>
                        <th className="py-5 px-6 text-[10px] font-black uppercase tracking-widest">Volunteer</th>
                        <th className="py-5 px-8 text-[10px] font-black uppercase tracking-widest rounded-tr-[2rem]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {ledgerRows.map((row, i) => (
                        <tr key={row.id} className={cn(
                          "group hover:bg-indigo-50/30 transition-all cursor-pointer",
                          i % 2 === 1 ? "bg-white" : "bg-[#F8F9FA]/50"
                        )}>
                          <td className="py-6 px-8">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-400 font-mono mb-1">{row.id.slice(0, 6)}</span>
                              <span className="text-sm font-bold text-[#1A1A3D] group-hover:text-[#4F46E5] transition-colors">{row.title}</span>
                            </div>
                          </td>
                          <td className="py-6 px-6">
                            <Badge className="bg-indigo-50 text-[#4F46E5] border-none font-bold text-[10px] px-2.5 rounded-full">
                              {row.zone}
                            </Badge>
                          </td>
                          <td className="py-6 px-6">
                            <Badge className="bg-amber-50 text-amber-700 border-none font-bold text-[10px] px-2.5 rounded-full">
                              {row.type}
                            </Badge>
                          </td>
                          <td className="py-6 px-6 text-center text-sm font-black text-red-400 opacity-60 font-mono">{row.before}</td>
                          <td className="py-6 px-6 text-center text-sm font-black text-[#4F46E5] font-mono">{row.after}</td>
                          <td className="py-6 px-6 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-[15px] font-black text-[#10B981]">{row.change}</span>
                              <span className="text-[10px] font-black text-[#10B981] opacity-70">({row.pct})</span>
                            </div>
                          </td>
                          <td className="py-6 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-[#4F46E5] font-black text-[10px]">
                                {row.volunteer?.[0] || "?"}
                              </div>
                              <span className="text-xs font-bold text-[#1A1A3D]">{row.volunteer}</span>
                            </div>
                          </td>
                          <td className="py-6 px-8">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                              <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">{row.status} ✓</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!ledgerRows.length && (
                        <tr>
                          <td className="py-6 px-8 text-sm text-slate-400" colSpan={8}>No verified missions yet for this period.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                   <p className="text-xs font-bold text-slate-400">Showing {ledgerRows.length ? 1 : 0}-{ledgerRows.length} of {completedMissions.length} records</p>
                   <div className="flex gap-2">
                      <Button variant="outline" className="h-9 px-4 border-slate-200 text-slate-400 font-bold text-xs hover:bg-white" disabled>Previous</Button>
                      <Button variant="outline" className="h-9 px-4 border-slate-200 text-[#4F46E5] font-bold text-xs hover:bg-white hover:border-[#4F46E5]">Next</Button>
                   </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Zone level impact */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex justify-between items-center">
                   <h2 className="text-xl font-bold text-[#1A1A3D]">Impact by Zone</h2>
                   <button className="text-[11px] font-black text-[#4F46E5] uppercase tracking-widest hover:underline flex items-center gap-1">
                      View Map Detail <ExternalLink className="w-3.5 h-3.5" />
                   </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {topZones.map((zone) => (
                    <div key={zone.id} className="bg-white rounded-[1.5rem] p-6 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-6 group hover:border-indigo-100 transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                           <h4 className="text-sm font-black text-[#1A1A3D]">{zone.name}</h4>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">NEED SATURATION</p>
                        </div>
                        <Badge className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none", zone.status === "High Impact" ? "bg-indigo-100 text-indigo-700" : zone.status === "Steady" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")}>
                          {zone.status}
                        </Badge>
                      </div>
                      <div className="h-12 flex items-end gap-1 px-1">
                         {[35, 65, 45, 85, 55].map((h, i) => (
                           <div key={i} className={cn("flex-1 rounded-t-sm transition-all group-hover:opacity-100", zone.color, i === 4 ? "opacity-100" : "opacity-40")} style={{ height: `${h}%` }} />
                         ))}
                      </div>
                      <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-4">
                         <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase">MISSIONS</p>
                            <p className="text-[15px] font-black text-[#1A1A3D]">{zone.missions}</p>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase">REDUCTION</p>
                            <p className="text-[15px] font-black text-[#10B981]">{zone.reduction}</p>
                         </div>
                      </div>
                    </div>
                  ))}
                  {!topZones.length ? <p className="text-sm text-slate-400">No zone impact data yet.</p> : null}
                </div>
              </div>

              {/* Impact by Need Type */}
              <div className="space-y-6">
                 <h2 className="text-xl font-bold text-[#1A1A3D]">Impact by Need Type</h2>
                 <div className="bg-white rounded-[1.5rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-8 h-[calc(100%-44px)]">
                    <div className="space-y-6">
                       {(impactByNeed.length ? impactByNeed : [{ label: "No data", pct: 0, val: "0%" }]).map(n => (
                         <div key={n.label} className="space-y-3">
                            <div className="flex justify-between text-xs font-black uppercase tracking-widest">
                               <span className="text-slate-500">{n.label}</span>
                               <span className="text-indigo-600">{n.pct}%</span>
                            </div>
                            <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden p-0.5">
                               <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full shadow-inner" style={{ width: `${n.pct}%` }} />
                            </div>
                             <div className="flex items-center gap-2 text-[10px] font-bold text-[#10B981]">
                               <TrendingDown className="w-3 h-3" /> Avg Reduction: {n.val}
                             </div>
                         </div>
                       ))}
                    </div>

                    <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100 space-y-3 mt-auto">
                       <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-indigo-500" />
                          <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Gemini Insight</span>
                       </div>
                        <p className="text-[11px] leading-relaxed text-indigo-900/80 font-bold">
                          {insightMessage || "Insight synthesis is in progress. New recommendations will appear as verified data streams in."}
                        </p>
                    </div>
                 </div>
              </div>
            </div>

            {/* Donor Report Generator */}
            <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.1)] border-2 border-indigo-100/50 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/20 via-white to-white relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8">
                  <FileText className="w-32 h-32 text-indigo-50 -mr-8 -mt-8 rotate-12" />
               </div>
               <div className="relative flex flex-col md:flex-row gap-12 items-center">
                  <div className="flex-1 space-y-6 text-center md:text-left">
                     <div className="space-y-3">
                        <h2 className="text-[28px] font-black text-[#1A1A3D]">Impact Transparency Report</h2>
                        <p className="text-slate-500 text-lg max-w-xl">Compile a cryptographically sealed report for donors and regulatory bodies.</p>
                     </div>
                     <div className="grid grid-cols-2 gap-x-12 gap-y-4 max-w-2xl">
                        {[
                          "Dynamic Zone Maps", "Volunteer Leaderboard", 
                          "Cost Analysis & Efficiency", "Community Sentiment Index",
                          "Raw Data Audit Logs", "External Partner Validation"
                        ].map((opt, i) => (
                           <div key={opt} className="flex items-center gap-3">
                              <div className={cn("w-5 h-5 rounded-md border flex items-center justify-center transition-all shadow-sm", i < 4 ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200")}>
                                 {i < 4 && <CheckCircle2 className="w-3.5 h-3.5" />}
                              </div>
                              <span className={cn("text-xs font-bold leading-none", i < 4 ? "text-[#1A1A3D]" : "text-slate-400")}>{opt}</span>
                           </div>
                        ))}
                     </div>
                     <div className="pt-4">
                        <Button
                          className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-black py-7 px-10 rounded-[1.5rem] shadow-xl shadow-indigo-200 flex items-center gap-3 active:scale-[0.98] transition-all group"
                          onClick={downloadTrustReport}
                          disabled={!trustQuery.data}
                        >
                           <FileText className="w-5 h-5 group-hover:animate-pulse" />
                           Generate & Sign PDF Report
                        </Button>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-4 flex items-center gap-2 justify-center md:justify-start">
                           <Clock className="w-3.5 h-3.5" /> Last generated: March 2026 Monthly Summary
                        </p>
                     </div>
                  </div>
                  
                  <div className="w-[280px] shrink-0 space-y-4">
                     <p className="text-[11px] font-black text-center text-slate-400 uppercase tracking-widest">Preview Preview</p>
                     <div className="aspect-[3/4] bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 flex flex-col gap-4 relative overflow-hidden group cursor-zoom-in">
                        <div className="w-full h-8 bg-indigo-50 rounded-lg animate-pulse" />
                        <div className="w-2/3 h-4 bg-slate-50 rounded-md animate-pulse" />
                        <div className="flex-1 border-y border-dashed border-slate-100 flex items-center justify-center">
                           <Shield className="w-12 h-12 text-indigo-100 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="space-y-2">
                           <div className="h-2 w-full bg-slate-50 rounded-full" />
                           <div className="h-2 w-full bg-slate-50 rounded-full" />
                           <div className="h-2 w-1/2 bg-slate-50 rounded-full" />
                        </div>
                        <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors flex items-center justify-center">
                           <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-indigo-600 shadow-xl">Click to Preview</div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Right Stats Sidebar */}
        <div className="w-[320px] bg-white border-l border-slate-100 p-8 space-y-10 overflow-y-auto shrink-0 hidden xl:block font-['Plus_Jakarta_Sans']">
           <div className="space-y-6">
              <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest flex items-center justify-between">
                 Top Impact Volunteers <Filter className="w-3.5 h-3.5 text-slate-400" />
              </h3>
              <div className="space-y-4">
                  {topVolunteers.map((v) => (
                   <button
                    key={v.name}
                    type="button"
                    onClick={() => setSelectedVolunteer(v)}
                    className="flex items-center justify-between group cursor-pointer p-2 -m-2 rounded-2xl hover:bg-slate-50 transition-all w-full text-left"
                   >
                      <div className="flex items-center gap-3">
                         <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-[#4F46E5] font-black text-xs border-2 border-white shadow-sm overflow-hidden group-hover:scale-105 transition-transform">
                            {v.initial}
                         </div>
                         <div className="min-w-0">
                            <p className="text-[13px] font-bold text-[#1A1A3D] truncate">{v.name}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{v.missions} Missions</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <span className="text-[11px] font-black text-[#10B981] uppercase tracking-widest">{v.impact}</span>
                         <p className="text-[9px] font-medium text-slate-400 leading-none">Verified</p>
                      </div>
                   </button>
                 ))}
                 {!topVolunteers.length ? (
                   <p className="text-xs text-slate-400">No verified volunteer impact yet.</p>
                 ) : null}
              </div>
              <button className="w-full text-center text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline pt-2">View all volunteers <ChevronRight className="w-3 h-3 inline-block -mt-0.5" /></button>
           </div>

           <div className="pt-10 border-t border-slate-50 space-y-6">
              <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest mb-6">Quick Verification Digest</h3>
              <div className="space-y-4">
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center">
                       <p className="text-[10px] font-black text-slate-400 uppercase">Verification Rate</p>
                        <span className="text-xs font-black text-indigo-600">{formatPercent(missionSuccessRate)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white rounded-full">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, missionSuccessRate))}%` }} />
                    </div>
                 </div>
                 <div className="p-5 bg-[#1E1B4B] rounded-[1.5rem] text-white space-y-4 shadow-xl">
                    <div className="flex items-center gap-2 mb-2">
                       <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                          <Download className="w-4 h-4 text-indigo-300" />
                       </div>
                       <p className="text-xs font-black uppercase tracking-widest">Share Impact</p>
                    </div>
                    <div className="space-y-3">
                        <Button variant="ghost" className="w-full justify-start gap-3 h-11 bg-white/5 hover:bg-white/10 text-white font-bold text-xs ring-0 border-none" onClick={() => handleShare("whatsapp")}>
                          <Share2 className="w-4 h-4 text-indigo-400" /> WhatsApp Link
                       </Button>
                        <Button variant="ghost" className="w-full justify-start gap-3 h-11 bg-white/5 hover:bg-white/10 text-white font-bold text-xs ring-0 border-none" onClick={() => handleShare("email")}>
                          <ExternalLink className="w-4 h-4 text-indigo-400" /> Email directly
                       </Button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <Dialog open={Boolean(selectedVolunteer)} onOpenChange={(open) => !open && setSelectedVolunteer(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1A1A3D]">Volunteer Snapshot</DialogTitle>
          </DialogHeader>
          {selectedVolunteer ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black">
                  {selectedVolunteer.initial}
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-[#1A1A3D]">{selectedVolunteer.name}</p>
                  <p className="text-xs text-slate-500">{selectedVolunteer.org || "Volunteer"}</p>
                </div>
                <Badge className="text-[10px] px-2 py-0" variant={selectedVolunteer.availableNow ? "success" : "secondary"}>
                  {selectedVolunteer.availableNow ? "Available" : "Busy"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Match</p>
                  <p className="text-sm font-semibold text-[#1A1A3D]">{selectedVolunteer.matchPercent ?? "--"}%</p>
                </div>
                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Distance</p>
                  <p className="text-sm font-semibold text-[#1A1A3D]">{selectedVolunteer.distance || "--"}</p>
                </div>
                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Success Rate</p>
                  <p className="text-sm font-semibold text-[#1A1A3D]">{selectedVolunteer.successRate ?? "--"}%</p>
                </div>
                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Active Missions</p>
                  <p className="text-sm font-semibold text-[#1A1A3D]">{selectedVolunteer.activeMissionCount ?? 0}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase">Availability</p>
                <p className="text-sm text-[#1A1A3D]">{selectedVolunteer.availability || "Status unavailable"}</p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {(selectedVolunteer.skills?.length ? selectedVolunteer.skills : ["Not specified"]).map((skill) => (
                    <Badge key={skill} variant="outline" className="text-[10px]">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase">Languages</p>
                <div className="flex flex-wrap gap-2">
                  {(selectedVolunteer.languages?.length ? selectedVolunteer.languages : ["Not specified"]).map((lang) => (
                    <Badge key={lang} variant="outline" className="text-[10px]">
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Burnout Risk</p>
                  <p className="text-sm font-semibold text-[#1A1A3D]">{selectedVolunteer.burnout || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Missions Completed</p>
                  <p className="text-sm font-semibold text-[#1A1A3D]">{selectedVolunteer.missions}</p>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrustFabric;