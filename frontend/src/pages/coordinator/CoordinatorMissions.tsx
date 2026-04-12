import React, { useEffect, useMemo, useRef, useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { MissionResponderLiveMap } from "@/components/coordinator/MissionResponderLiveMap";
import { MissionsLiveMap } from "@/components/coordinator/MissionsLiveMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  Activity,
  Bell,
  Box,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  GitMerge,
  MapPin,
  MoreHorizontal,
  Navigation,
  Plus,
  Repeat,
  Search,
  Send,
  Shield,
  Sparkles,
  X,
  MessageSquare,
} from "lucide-react";
import {
  assignCoordinatorMission,
  createCoordinatorMission,
  createCoordinatorZone,
  getCoordinatorMissionCandidatesForAudience,
  getCoordinatorMissionTracking,
  getCoordinatorMissionSourceReports,
  getCoordinatorMissions,
  getCoordinatorZones,
  type CoordinatorMission,
  type CoordinatorMissionCandidate,
  type CoordinatorMissionCreatePayload,
  type CoordinatorMissionSourceReport,
  type CoordinatorZone,
} from "@/lib/coordinator-api";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

const statusLabel = (status: CoordinatorMission["status"]) => {
  switch (status) {
    case "dispatched":
      return "In Progress";
    case "en_route":
      return "On Route";
    case "on_ground":
      return "On Ground";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Awaiting Dispatch";
  }
};

const statusBadgeClasses: Record<CoordinatorMission["status"], string> = {
  pending: "bg-[#FFF7ED] text-[#9A3412]",
  dispatched: "bg-[#F0FDF4] text-[#166534]",
  en_route: "bg-[#F0FDF4] text-[#166534]",
  on_ground: "bg-[#ECFEFF] text-[#155E75]",
  completed: "bg-[#DCFCE7] text-[#166534]",
  failed: "bg-[#FEF2F2] text-[#991B1B]",
  cancelled: "bg-[#F1F5F9] text-[#475569]",
};

const priorityBadgeClasses: Record<CoordinatorMission["priority"], string> = {
  low: "bg-slate-50 text-slate-500",
  medium: "bg-blue-50 text-blue-600",
  high: "bg-amber-50 text-amber-600",
  critical: "bg-red-50 text-red-600",
};

const getAssigneeLabel = (targetAudience: CoordinatorMission["targetAudience"]) =>
  targetAudience === "volunteer" ? "Assigned Volunteer" : "Assigned Field Worker";

const getAssigneeRoleText = (targetAudience: CoordinatorMission["targetAudience"]) =>
  targetAudience === "volunteer" ? "Volunteer" : "Field Worker";

const defaultMissionForm: CoordinatorMissionCreatePayload = {
  title: "",
  description: "",
  zoneId: "",
  needType: "Food Distribution",
  targetAudience: "fieldworker",
  priority: "high",
  resources: [],
  sourceReportIds: [],
  sourceNgoIds: [],
  estimatedDurationMinutes: 45,
  allowAutoAssign: true,
};

const defaultNewZoneForm = {
  name: "",
  ward: "",
  city: "",
};

const CoordinatorMissions = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [showCreateMission, setShowCreateMission] = useState(false);
  const [creationStep, setCreationStep] = useState(1);
  const [selectedVolunteerForMission, setSelectedVolunteerForMission] = useState<CoordinatorMissionCandidate | null>(null);
  const [selectedMission, setSelectedMission] = useState<CoordinatorMission | null>(null);
  const [assignMission, setAssignMission] = useState<CoordinatorMission | null>(null);
  const [selectedAssignCandidate, setSelectedAssignCandidate] = useState<CoordinatorMissionCandidate | null>(null);
  const [isScoringExpanded, setIsScoringExpanded] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("Overview");
  const [selectedSourceReport, setSelectedSourceReport] = useState<CoordinatorMissionSourceReport | null>(null);
  const [missionForm, setMissionForm] = useState<CoordinatorMissionCreatePayload>(defaultMissionForm);
  const [newZoneForm, setNewZoneForm] = useState(defaultNewZoneForm);
  const [showNewZoneForm, setShowNewZoneForm] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(() => (typeof document === "undefined" ? true : !document.hidden));
  const [liveMapSync, setLiveMapSync] = useState<{ connected: boolean; lastEventAt: number | null; lastRefetchAt: number | null }>({
    connected: false,
    lastEventAt: null,
    lastRefetchAt: null,
  });
  const sseRefetchTimerRef = useRef<number | null>(null);
  const token = localStorage.getItem("nexus_access_token");
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const zonesQuery = useQuery({
    queryKey: ["coordinator-zones"],
    queryFn: () => getCoordinatorZones(),
    refetchInterval: isPageVisible ? 15_000 : 30_000,
    refetchIntervalInBackground: true,
  });

  const missionsQuery = useQuery({
    queryKey: ["coordinator-missions"],
    queryFn: () => getCoordinatorMissions(),
    staleTime: 3_000,
    refetchInterval: isPageVisible ? 6_000 : 20_000,
    refetchIntervalInBackground: true,
  });

  const refetchMissions = missionsQuery.refetch;
  const refetchZones = zonesQuery.refetch;

  useEffect(() => {
    if (!token) {
      return;
    }

    const streamUrl = `${apiBaseUrl}/coordinator/terrain/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(streamUrl);

    const scheduleLiveRefetch = () => {
      if (sseRefetchTimerRef.current !== null) {
        return;
      }

      sseRefetchTimerRef.current = window.setTimeout(async () => {
        sseRefetchTimerRef.current = null;
        await Promise.all([refetchMissions(), refetchZones()]);
        setLiveMapSync((current) => ({ ...current, lastRefetchAt: Date.now() }));
      }, 300);
    };

    source.onopen = () => {
      setLiveMapSync((current) => ({ ...current, connected: true }));
    };

    source.onmessage = (event) => {
      setLiveMapSync((current) => ({ ...current, connected: true, lastEventAt: Date.now() }));

      try {
        const payload = JSON.parse(event.data || "{}");
        if (payload?.type === "terrain_update") {
          scheduleLiveRefetch();
        }
      } catch {
        // Ignore malformed SSE payloads.
      }
    };

    source.onerror = () => {
      setLiveMapSync((current) => ({ ...current, connected: false }));
    };

    return () => {
      source.close();
      if (sseRefetchTimerRef.current !== null) {
        window.clearTimeout(sseRefetchTimerRef.current);
        sseRefetchTimerRef.current = null;
      }
    };
  }, [apiBaseUrl, refetchMissions, refetchZones, token]);

  const selectedZone = useMemo(
    () => zonesQuery.data?.zones.find((zone) => zone.id === missionForm.zoneId) ?? null,
    [zonesQuery.data?.zones, missionForm.zoneId],
  );

  const zoneOptions = useMemo(() => {
    const zones = zonesQuery.data?.zones ?? [];
    const currentZones = zones.filter((zone) => zone.activeMissions > 0);
    const newZones = zones.filter((zone) => zone.activeMissions === 0);
    const preferredZones = missionForm.targetAudience === "volunteer" ? currentZones : newZones;
    return preferredZones.length ? preferredZones : zones;
  }, [missionForm.targetAudience, zonesQuery.data?.zones]);

  useEffect(() => {
    if (!missionForm.zoneId && zoneOptions.length) {
      setMissionForm((current) => ({ ...current, zoneId: zoneOptions[0].id }));
    }
  }, [missionForm.zoneId, zoneOptions]);

  useEffect(() => {
    if (missionForm.targetAudience === "volunteer") {
      setShowNewZoneForm(false);
      setNewZoneForm(defaultNewZoneForm);
    }
  }, [missionForm.targetAudience]);

  const candidatesQuery = useQuery({
    queryKey: ["coordinator-mission-candidates", missionForm.zoneId, missionForm.needType, missionForm.targetAudience],
    queryFn: () => getCoordinatorMissionCandidatesForAudience(missionForm.zoneId, missionForm.needType, missionForm.targetAudience),
    enabled: Boolean(missionForm.zoneId && missionForm.needType),
  });

  const assignCandidatesQuery = useQuery({
    queryKey: ["coordinator-mission-assign-candidates", assignMission?.id],
    queryFn: () => getCoordinatorMissionCandidatesForAudience(assignMission!.zoneId, assignMission!.needType, "volunteer"),
    enabled: Boolean(assignMission?.zoneId && assignMission?.needType),
  });

  const sourceReportsQuery = useQuery({
    queryKey: ["coordinator-mission-source-reports", selectedMission?.id],
    queryFn: () => getCoordinatorMissionSourceReports(selectedMission!.id),
    enabled: Boolean(selectedMission?.id),
  });

  const missionTrackingQuery = useQuery({
    queryKey: ["coordinator-mission-tracking", selectedMission?.id],
    queryFn: () => getCoordinatorMissionTracking(selectedMission!.id),
    enabled: Boolean(selectedMission?.id),
    refetchInterval: selectedMission?.id ? 5_000 : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!selectedVolunteerForMission && candidatesQuery.data?.length) {
      setSelectedVolunteerForMission(candidatesQuery.data[0]);
    }
  }, [candidatesQuery.data, selectedVolunteerForMission]);

  useEffect(() => {
    if (!assignMission) {
      setSelectedAssignCandidate(null);
      return;
    }
    if (assignCandidatesQuery.data?.length) {
      setSelectedAssignCandidate(assignCandidatesQuery.data[0]);
    }
  }, [assignCandidatesQuery.data, assignMission]);

  const createMissionMutation = useMutation({
    mutationFn: (payload: CoordinatorMissionCreatePayload) => createCoordinatorMission(payload),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["coordinator-missions"] });
      await queryClient.invalidateQueries({ queryKey: ["coordinator-dashboard"] });
      setSelectedMission(response.mission);
      setShowCreateMission(false);
      setCreationStep(1);
      setSelectedVolunteerForMission(null);
      setMissionForm(defaultMissionForm);
      toast.success("Mission dispatched successfully!");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to dispatch mission");
    },
  });

  const assignVolunteerMutation = useMutation({
    mutationFn: (candidateId: string) => assignCoordinatorMission(assignMission!.id, candidateId),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["coordinator-missions"] });
      await queryClient.invalidateQueries({ queryKey: ["coordinator-dashboard"] });
      setSelectedMission(response.mission);
      setAssignMission(null);
      setSelectedAssignCandidate(null);
      toast.success("Volunteer assigned to mission");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to assign volunteer");
    },
  });

  const missions = missionsQuery.data?.missions ?? [];
  const filteredMissions = missions.filter((mission) => {
    if (activeTab === "all") {
      return true;
    }
    if (activeTab === "active") {
      return ["dispatched", "en_route", "on_ground"].includes(mission.status);
    }
    if (activeTab === "pending") {
      return mission.status === "pending";
    }
    if (activeTab === "completed") {
      return mission.status === "completed";
    }
    if (activeTab === "failed") {
      return mission.status === "failed";
    }
    return true;
  });

  const pendingVolunteerMissions = filteredMissions.filter(
    (mission) => mission.status === "pending" && mission.targetAudience === "volunteer" && !mission.assignedTo,
  );

  const bestMatchQueries = useQueries({
    queries: pendingVolunteerMissions.map((mission) => ({
      queryKey: ["coordinator-mission-best-match", mission.id],
      queryFn: () => getCoordinatorMissionCandidatesForAudience(mission.zoneId, mission.needType, "volunteer"),
      staleTime: 60_000,
    })),
  });

  const bestMatchByMission = useMemo(() => {
    const map = new Map<string, CoordinatorMissionCandidate | null>();
    pendingVolunteerMissions.forEach((mission, index) => {
      const bestCandidate = bestMatchQueries[index]?.data?.[0] ?? null;
      map.set(mission.id, bestCandidate);
    });
    return map;
  }, [bestMatchQueries, pendingVolunteerMissions]);

  const stats = [
    { label: "Active Missions", value: String(missionsQuery.data?.active ?? 0).padStart(2, "0"), delta: "Live from backend", color: "border-[#4F46E5]", icon: "bg-[#10B981]" },
    { label: "Pending Dispatch", value: String(missionsQuery.data?.pending ?? 0).padStart(2, "0"), delta: "Needs assignment", color: "border-[#F59E0B]" },
    { label: "Completed Week", value: String(missionsQuery.data?.completed ?? 0).padStart(2, "0"), delta: "Backend synced", color: "border-[#10B981]" },
    { label: "On Ground", value: String(missions.filter((mission) => mission.status === "on_ground").length).padStart(2, "0"), delta: "Across your zones", color: "border-[#7C3AED]" },
  ];

  const mapMissions = useMemo(() => {
    if (activeTab === "all") {
      return missions;
    }
    return filteredMissions;
  }, [activeTab, filteredMissions, missions]);

  const liveMapSyncLabel = useMemo(() => {
    const reference = liveMapSync.lastRefetchAt ?? liveMapSync.lastEventAt;
    if (!reference) {
      return "Waiting for first live event";
    }

    const diffSeconds = Math.max(0, Math.floor((Date.now() - reference) / 1000));
    if (diffSeconds < 5) {
      return "Updated just now";
    }
    if (diffSeconds < 60) {
      return `Updated ${diffSeconds}s ago`;
    }
    return `Updated ${Math.floor(diffSeconds / 60)}m ago`;
  }, [liveMapSync.lastEventAt, liveMapSync.lastRefetchAt]);

  const createMission = async () => {
    let zoneId = missionForm.zoneId;

    if (missionForm.targetAudience === "fieldworker" && showNewZoneForm) {
      if (!newZoneForm.name.trim()) {
        toast.error("Add a zone name before creating the mission");
        return;
      }

      const createdZone = await createCoordinatorZone({
        name: newZoneForm.name.trim(),
        ward: newZoneForm.ward.trim(),
        city: newZoneForm.city.trim(),
      });
      zoneId = createdZone.id;
      await queryClient.invalidateQueries({ queryKey: ["coordinator-zones"] });
    }

    if (!zoneId) {
      toast.error("Select or create a zone before dispatching");
      return;
    }

    const payload: CoordinatorMissionCreatePayload = {
      ...missionForm,
      zoneId,
      assignedTo: selectedVolunteerForMission?.id,
      assignedVolunteerName: selectedVolunteerForMission?.name,
      resources: missionForm.resources?.length
        ? missionForm.resources
        : [
            { name: "Food packets" },
            { name: "First aid kit" },
            { name: "Vehicle support" },
          ],
    };

    await createMissionMutation.mutateAsync(payload);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7FF] font-['Plus_Jakarta_Sans']">
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-y-auto">
          <DashboardTopBar breadcrumb="Operations / Missions" />

          <div className="p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-1">
                <h1 className="text-[32px] font-bold text-[#1A1A3D]">Missions</h1>
                <p className="text-[#64748B] font-medium text-base">Create, monitor, and close all field missions across your zones</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input placeholder="Search missions..." className="pl-10 h-11 bg-white border-slate-200 rounded-xl" />
                </div>
                <div className="relative w-11 h-11 bg-white rounded-xl border border-slate-200 flex items-center justify-center cursor-pointer">
                  <Bell className="w-5 h-5 text-slate-600" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">3</span>
                </div>
                <Button
                  onClick={() => setShowCreateMission(true)}
                  className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] hover:opacity-90 text-white font-bold h-11 px-6 rounded-xl flex gap-2"
                >
                  <Plus className="w-4 h-4" /> Create Mission
                </Button>
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              {["All", "Active", "Pending", "Completed", "Failed"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab.toLowerCase())}
                  className={cn(
                    "px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all border",
                    activeTab === tab.toLowerCase()
                      ? "bg-[#4F46E5] text-white border-[#4F46E5] shadow-md"
                      : "bg-transparent text-[#64748B] border-slate-200 hover:border-slate-300",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className={cn(
                    "bg-white rounded-[1.25rem] p-6 shadow-[0_4px_24px_rgba(79,70,229,0.04)] border-l-[3px] border-slate-100 flex flex-col justify-between h-32",
                    stat.color,
                  )}
                >
                  <div className="flex items-center gap-2">
                    {stat.icon && <div className={cn("w-2 h-2 rounded-full animate-pulse", stat.icon)} />}
                    <span className="text-[11px] font-black text-[#64748B] uppercase tracking-widest">{stat.label}</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-[28px] font-bold text-[#1A1A3D]">{stat.value}</span>
                    <span className="text-[10px] font-bold text-[#64748B] opacity-60 uppercase">{stat.delta}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-[#1A1A3D]">Recent Activity <span className="text-slate-300 ml-2 font-medium text-sm">• Updated live</span></h3>
                </div>

                {filteredMissions.map((mission) => {
                  const volunteerName = mission.assignedToName || "Unassigned";
                  const mergedReports = mission.mergedFrom?.reports ?? mission.sourceReportIds.length;
                  const mergedNGOs = mission.mergedFrom?.ngos ?? (mission.sourceNgoIds.length || 1);
                  const missionZone = zonesQuery.data?.zones.find((zone) => zone.id === mission.zoneId);

                  return (
                    <div
                      key={mission.id}
                      className={cn(
                        "bg-white rounded-[1.25rem] border-l-[3px] border border-slate-100 shadow-[0_4px_24px_rgba(79,70,229,0.06)] p-6 space-y-6 transition-all hover:shadow-lg",
                        mission.status === "completed"
                          ? "border-l-[#10B981]"
                          : mission.status === "pending"
                            ? "border-l-[#F59E0B]"
                            : "border-l-[#4F46E5]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <Badge variant="outline" className="bg-slate-50 text-slate-500 border-none font-mono text-[11px] px-2 py-0.5">{mission.id}</Badge>
                          <h4 className="text-lg font-bold text-[#1A1A3D] truncate">{mission.title}</h4>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={cn("rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-wider", statusBadgeClasses[mission.status])}>
                            <div className={cn("w-1.5 h-1.5 rounded-full mr-1.5 inline-block", mission.status === "pending" ? "bg-amber-500" : mission.status === "completed" ? "bg-green-500" : "bg-green-500 animate-pulse")} />
                            {statusLabel(mission.status)}
                          </Badge>
                          <Badge className={cn("border-none font-bold text-[10px] uppercase tracking-wider", priorityBadgeClasses[mission.priority])}>{mission.priority}</Badge>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-indigo-50 text-[#4F46E5] border-none font-bold text-[11px] px-3 py-1 rounded-full">
                          {missionZone ? `${missionZone.name}${missionZone.ward ? ` · ${missionZone.ward}` : ""}` : mission.zoneName || mission.zoneId}
                        </Badge>
                        <Badge className="bg-[#FFF7ED] text-[#9A3412] border-none font-bold text-[11px] px-3 py-1 rounded-full">
                          {mission.needType}
                        </Badge>
                        <Badge className="bg-slate-50 text-slate-500 border-none font-bold text-[11px] px-3 py-1 rounded-full uppercase tracking-widest">
                          {mission.targetAudience === "volunteer" ? "Volunteer Mission" : "Field Worker Mission"}
                        </Badge>
                      </div>

                      {(mergedReports > 0 || mergedNGOs > 0) && (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 bg-[#EEF2FF] text-[#3730A3] px-3 py-1.5 rounded-full w-fit">
                            <GitMerge className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-bold">Merged from {mergedReports} reports · {mergedNGOs} NGOs</span>
                          </div>
                          {(mission.newUpdates ?? 0) > 0 && (
                            <div className="flex items-center justify-between bg-[#FFF7ED] text-[#92400E] px-3 py-1.5 rounded-full border border-amber-100">
                              <span className="text-[11px] font-bold">{mission.newUpdates} new reports added while mission is active</span>
                              <button
                                className="text-[11px] font-black underline hover:opacity-80"
                                onClick={() => {
                                  setSelectedMission(mission);
                                  setDetailTab("Live Updates");
                                }}
                              >
                                View updates →
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {mission.status === "pending" ? (
                        <div className="space-y-4 pt-2">
                          <div className="p-4 bg-[#FFFBEB] rounded-xl border border-[#FEF3C7] flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                              <span className="text-sm font-bold text-[#92400E] truncate">No volunteer assigned yet</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/60 px-3 py-1.5 rounded-lg text-[10px] font-black text-[#4F46E5] uppercase tracking-widest border border-indigo-100 whitespace-nowrap">
                              <Sparkles className="w-3 h-3" /> Best match: {bestMatchByMission.get(mission.id)?.name || "Auto assign ready"}
                            </div>
                          </div>
                          <div className="flex gap-4 flex-wrap">
                            <Button
                              className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white font-bold rounded-xl px-6"
                              onClick={() => setAssignMission(mission)}
                            >
                              Assign Volunteer →
                            </Button>
                            <Button
                              variant="outline"
                              className="border-slate-200 text-[#4F46E5] font-bold px-6"
                              onClick={() => {
                                setSelectedMission(mission);
                                setDetailTab("Source Reports");
                              }}
                            >
                              View Reports
                            </Button>
                            <div className="flex-1" />
                            <Button variant="ghost" className="text-slate-400 font-bold">Edit Details</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50 gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-[#4F46E5] font-black text-xs border-2 border-white shadow-sm overflow-hidden shrink-0">
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${volunteerName}`} alt="volunteer avatar" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{getAssigneeLabel(mission.targetAudience)}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-[#1A1A3D] truncate">{volunteerName}</span>
                                  {mission.assignedVolunteerMatch ? <span className="text-[#10B981] text-sm ml-1">{mission.assignedVolunteerMatch}% Match</span> : null}
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                </div>
                                <span className="text-[11px] font-medium text-slate-400">{mission.assignedVolunteerDistance || "Nearby"} · On Route</span>
                              </div>
                            </div>

                            <div className="flex-1 max-w-xs mx-12 hidden lg:block">
                              <div className="flex justify-between items-end mb-2">
                                <span className="text-[10px] font-black text-[#4F46E5] uppercase tracking-widest">DISPATCH PROGRESS</span>
                                <span className="text-[10px] font-black text-[#4F46E5] uppercase tracking-widest">{statusLabel(mission.status).toUpperCase()}</span>
                              </div>
                              <Progress value={mission.progress || 0} className="h-2" />
                            </div>

                            <div className="flex gap-2">
                              <Button variant="ghost" className="h-10 w-10 p-0 rounded-xl hover:bg-white hover:shadow-sm text-slate-400 hover:text-[#4F46E5]"><MessageSquare className="w-4 h-4" /></Button>
                              <Button variant="ghost" className="h-10 w-10 p-0 rounded-xl hover:bg-white hover:shadow-sm text-slate-400 hover:text-[#4F46E5]"><Repeat className="w-4 h-4" /></Button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-50 gap-4 flex-wrap">
                            <div className="flex items-center gap-4 font-medium text-[13px] text-slate-400 flex-wrap">
                              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Dispatched: {mission.dispatchedAt ? new Date(mission.dispatchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Now"}</span>
                              <span className="flex items-center gap-1.5"><Navigation className="w-3.5 h-3.5" /> Est. Completion: {mission.estimatedDurationMinutes} min</span>
                            </div>
                            <div className="flex gap-4">
                              <Button onClick={() => setSelectedMission(mission)} variant="ghost" className="text-[#4F46E5] font-bold flex gap-2 hover:bg-indigo-50">
                                <Eye className="w-4 h-4" /> View Live
                              </Button>
                              <Button
                                onClick={() => {
                                  setSelectedMission(mission);
                                  setDetailTab("Source Reports");
                                }}
                                variant="ghost"
                                className="text-[#4F46E5] font-bold flex gap-2 hover:bg-indigo-50"
                              >
                                <FileText className="w-4 h-4" /> View Reports
                              </Button>
                              <Button variant="outline" className="border-red-100 text-red-500 hover:bg-red-50 font-bold px-6">Close Mission</Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!filteredMissions.length && (
                  <div className="bg-white rounded-[1.25rem] border border-slate-100 shadow-[0_4px_24px_rgba(79,70,229,0.06)] p-8 text-center text-slate-500">
                    No missions found for the current filter.
                  </div>
                )}

                <div className="pt-8 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/50 rounded-xl border border-slate-100 text-xs font-bold text-slate-400 group cursor-pointer hover:bg-white hover:shadow-sm transition-all">
                    <div className="flex items-center gap-4 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      <span className="text-[#1A1A3D] truncate">Live mission records now come from backend data</span>
                      <span>SYNCED</span>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <Badge className="bg-[#DCFCE7] text-[#166534] border-none uppercase text-[10px] tracking-widest font-black">SYNCED</Badge>
                      <ChevronRight className="w-4 h-4 opacity-40 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-white rounded-[2rem] p-6 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest">LIVE MISSION MAP</h3>
                    <div className={cn("h-2 w-2 rounded-full", liveMapSync.connected ? "bg-green-500 animate-pulse" : "bg-amber-500")} />
                  </div>
                  <MissionsLiveMap
                    className="aspect-square mb-4"
                    missions={mapMissions}
                    zones={zonesQuery.data?.zones ?? []}
                    selectedMissionId={selectedMission?.id}
                    onMissionSelect={(mission) => {
                      setSelectedMission(mission);
                      setDetailTab("Overview");
                    }}
                  />
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className={cn(liveMapSync.connected ? "text-[#166534]" : "text-[#92400E]")}>{liveMapSync.connected ? "Live stream connected" : "Live stream reconnecting"}</span>
                    <span className="text-slate-500">{liveMapSyncLabel}</span>
                  </div>
                  <button
                    className="mt-2 text-xs font-bold text-[#4F46E5] hover:underline flex items-center gap-1 w-full justify-center"
                    onClick={() => {
                      const missionToOpen = mapMissions.find((mission) => ["dispatched", "en_route", "on_ground"].includes(mission.status)) || mapMissions[0];
                      if (!missionToOpen) {
                        return;
                      }
                      setSelectedMission(missionToOpen);
                      setDetailTab("Overview");
                    }}
                  >
                    View live mission details <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="bg-white rounded-[2rem] p-6 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100">
                  <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest mb-8">STATUS BREAKDOWN</h3>
                  <div className="flex items-center justify-between mb-8">
                    <div className="relative w-24 h-24">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F1F5F9" strokeWidth="12" />
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#4F46E5" strokeWidth="12" strokeDasharray="251.2" strokeDashoffset="125.6" strokeLinecap="round" />
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F59E0B" strokeWidth="12" strokeDasharray="251.2" strokeDashoffset="200.6" strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[20px] font-black text-[#1A1A3D] leading-none">{missionsQuery.data?.total ?? 0}</span>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">TOTAL</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: "Active", val: missionsQuery.data?.active ?? 0, color: "bg-[#4F46E5]" },
                        { label: "Pending", val: missionsQuery.data?.pending ?? 0, color: "bg-amber-500" },
                        { label: "Done", val: missionsQuery.data?.completed ?? 0, color: "bg-[#10B981]" },
                        { label: "Failed", val: missions.filter((mission) => mission.status === "failed").length, color: "bg-red-500" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-4">
                          <div className="flex items-center gap-2 min-w-[70px]">
                            <div className={cn("w-2 h-2 rounded-full", item.color)} />
                            <span className="text-[11px] font-bold text-slate-500">{item.label}</span>
                          </div>
                          <span className="text-xs font-black text-[#1A1A3D]">{String(item.val).padStart(2, "0")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[2rem] p-6 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100">
                  <h3 className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-widest mb-6">ZONE DENSITY</h3>
                  <div className="space-y-5">
                    {(zonesQuery.data?.zones ?? []).slice(0, 4).map((zone: CoordinatorZone) => (
                      <div key={zone.id} className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-600 font-black">{zone.name}</span>
                          <span className="text-[#1A1A3D]">{zone.activeMissions}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-50 rounded-full">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, zone.activeMissions * 12.5)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Button className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold py-6 rounded-2xl flex justify-between items-center group">
                    <div className="flex items-center gap-3"><Repeat className="w-4 h-4" /> Auto-assign all pending</div>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                  </Button>
                  <Button variant="ghost" className="w-full bg-white border border-slate-100 text-slate-500 font-bold py-6 rounded-2xl flex justify-between items-center group hover:bg-slate-50">
                    <div className="flex items-center gap-3"><FileText className="w-4 h-4" /> Export Weekly Report</div>
                    <ChevronRight className="w-4 h-4 opacity-40 group-hover:translate-x-1 transition-all" />
                  </Button>
                  <Button variant="ghost" className="w-full bg-[#1E1B4B] text-white font-bold py-6 rounded-2xl flex justify-between items-center group hover:bg-[#1A1A3D]">
                    <div className="flex items-center gap-3"><Send className="w-4 h-4" /> Send Field Broadcast</div>
                    <Send className="w-4 h-4 opacity-40 -translate-y-1 translate-x-1 scale-75" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Sheet open={!!selectedMission} onOpenChange={(open) => !open && setSelectedMission(null)}>
          <SheetContent className="sm:max-w-xl p-0 flex flex-col bg-white border-l border-slate-100 font-['Plus_Jakarta_Sans']">
            {selectedMission && (
              <div className="flex flex-col h-full overflow-hidden">
                <SheetHeader className="p-8 border-b border-slate-50 space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400 font-mono tracking-tighter">{selectedMission.id}</span>
                        <Badge className={cn("rounded-full px-2 py-0.5 font-bold text-[9px] uppercase tracking-wider", statusBadgeClasses[selectedMission.status])}>
                          {statusLabel(selectedMission.status)}
                        </Badge>
                      </div>
                      <SheetTitle className="text-2xl font-bold text-[#1A1A3D]">{selectedMission.title}</SheetTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" className="w-10 h-10 p-0 rounded-xl hover:bg-slate-50"><MoreHorizontal className="w-5 h-5" /></Button>
                    </div>
                  </div>
                </SheetHeader>

                <div className="flex px-8 border-b border-slate-50 overflow-x-auto scrollbar-none">
                  {["Overview", "Source Reports", "Live Updates", "Volunteer", "Outcome", "History"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab)}
                      className={cn(
                        "py-4 px-4 text-[10px] font-black uppercase tracking-widest relative transition-all whitespace-nowrap",
                        detailTab === tab ? "text-[#4F46E5]" : "text-slate-400",
                      )}
                    >
                      {tab}
                      {detailTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4F46E5] rounded-t-full" />}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="p-8 space-y-8 pb-24">
                    {detailTab === "Overview" && (
                      <>
                        <div className="space-y-3">
                          <MissionResponderLiveMap
                            className="h-[240px]"
                            missionLocation={selectedMission.location}
                            responders={missionTrackingQuery.data?.responders ?? []}
                            onResponderClick={(responder) => {
                              if (responder.role === "volunteer") {
                                navigate(`/dashboard/volunteers?selected=${encodeURIComponent(responder.id)}`);
                                return;
                              }
                              navigate(`/fieldworker?selected=${encodeURIComponent(responder.id)}`);
                            }}
                          />
                          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold">
                            <span className="text-slate-600">
                              {missionTrackingQuery.data?.trackingAvailable
                                ? `${missionTrackingQuery.data.responders.filter((responder) => responder.online).length} responder(s) online now`
                                : "Live tracking pending from assigned responder"}
                            </span>
                            <span className="text-[#4F46E5]">{selectedMission.location.address || selectedMission.zoneName}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-6">
                            <div className="space-y-4">
                              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">MISSION DETAILS</h4>
                              <div className="space-y-4">
                                <div>
                                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Need Type</p>
                                  <Badge className="bg-[#FFF7ED] text-[#9A3412] border-none font-bold text-[11px]">{selectedMission.needType}</Badge>
                                </div>
                                  <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Audience</p>
                                    <Badge className="bg-slate-50 text-slate-500 border-none font-bold text-[11px] uppercase tracking-widest">
                                      {selectedMission.targetAudience === "volunteer" ? "Volunteer" : "Field Worker"}
                                    </Badge>
                                  </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Zone</p>
                                    <p className="text-sm font-bold text-[#1A1A3D]">{selectedMission.zoneName}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Est. Finish</p>
                                    <p className="text-sm font-bold text-[#1A1A3D]">{selectedMission.estimatedDurationMinutes} min</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div className="space-y-4">
                              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">{getAssigneeLabel(selectedMission.targetAudience)}</h4>
                              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-[#4F46E5] font-black text-xs border-2 border-white shadow-sm overflow-hidden">
                                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedMission.assignedToName || selectedMission.assignedTo || "FieldWorker"}`} alt="avatar" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-bold text-[#1A1A3D] truncate">
                                    {selectedMission.assignedToName || (selectedMission.targetAudience === "volunteer" ? "No volunteer selected" : "No field worker selected")}
                                  </p>
                                  <p className="text-[11px] font-medium text-slate-400">{selectedMission.assignedVolunteerMatch || 0}% Match · {selectedMission.assignedVolunteerDistance || "Nearby"}</p>
                                </div>
                                <Button variant="outline" className="h-8 w-8 p-0 rounded-lg border-slate-200 text-[#4F46E5] hover:bg-white"><MessageSquare className="w-3.5 h-3.5" /></Button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">RECENT LOGS</h4>
                          <div className="space-y-6">
                            <div className="flex gap-4 group">
                              <div className="flex flex-col items-center">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] mt-1.5 ring-4 ring-green-50 animate-pulse" />
                                <div className="w-px flex-1 bg-slate-100 my-2" />
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-baseline mb-2">
                                  <h4 className="text-sm font-black text-[#1A1A3D]">{statusLabel(selectedMission.status)}</h4>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Live</span>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[13px] font-medium text-slate-600 italic">
                                  {selectedMission.statusText || selectedMission.description}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {detailTab === "Source Reports" && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[13px] text-slate-500 font-medium">Source inputs used to create this mission</p>
                          <Badge className="bg-[#EEF2FF] text-[#3730A3] border-none font-bold text-[11px] px-3 py-1 rounded-full">
                            {(sourceReportsQuery.data?.total ?? selectedMission.sourceReportIds.length ?? 0)} reports · {(selectedMission.sourceNgoIds.length || 1)} NGOs
                          </Badge>
                        </div>

                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                          {sourceReportsQuery.isLoading && (
                            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 text-sm font-medium text-slate-500">Loading source reports...</div>
                          )}

                          {!sourceReportsQuery.isLoading && !(sourceReportsQuery.data?.reports?.length) && (
                            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 text-sm font-medium text-slate-500">
                              No source reports found for this mission.
                            </div>
                          )}

                          {(sourceReportsQuery.data?.reports || []).map((report: CoordinatorMissionSourceReport) => (
                            <div key={report.id} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4 hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-mono font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{report.id}</span>
                                    <Badge className="bg-[#FFF7ED] text-[#9A3412] border-none text-[10px] font-black uppercase tracking-widest">{report.needType || "Unknown Need"}</Badge>
                                    <Badge className="bg-slate-50 text-slate-500 border-none text-[10px] font-black uppercase tracking-widest">{report.severity || "unknown"}</Badge>
                                  </div>
                                  <p className="text-xs text-slate-500 font-medium">
                                    {report.location?.address || selectedMission.zoneName} • {report.sourceType || report.inputType || "source"}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confidence</p>
                                  <p className="text-sm font-bold text-[#1A1A3D]">{report.confidence ?? 0}%</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                <div className="bg-slate-50 rounded-xl p-3">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Families</p>
                                  <p className="text-sm font-bold text-[#1A1A3D]">{report.familiesAffected ?? 0}</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Persons</p>
                                  <p className="text-sm font-bold text-[#1A1A3D]">{report.personsAffected ?? 0}</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Verification</p>
                                  <p className="text-sm font-bold text-[#1A1A3D]">{report.verificationState || "unverified"}</p>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Need Incidents</p>
                                {report.needIncidents?.length ? (
                                  <div className="space-y-2">
                                    {report.needIncidents.map((incident: any, index: number) => (
                                      <div key={`${report.id}-incident-${index}`} className="text-xs text-slate-600 font-medium bg-slate-50 rounded-lg p-2 border border-slate-100">
                                        <span className="font-bold text-[#1A1A3D]">{incident.needType || "need"}</span>
                                        {" · "}
                                        <span className="uppercase">{incident.severity || "medium"}</span>
                                        {" · "}
                                        {incident.familiesAffected ?? 0} families
                                        {" · "}
                                        {incident.personsAffected ?? 0} persons
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-600 font-medium break-words">No incident details attached.</p>
                                )}
                              </div>

                              <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assignment Requirement Profile</p>
                                {report.assignmentRequirementProfile ? (
                                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 font-medium">
                                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">Responder: {String((report.assignmentRequirementProfile as any).preferredResponderType || "volunteer")}</div>
                                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">Effort: {String((report.assignmentRequirementProfile as any).estimatedEffortMinutes || 60)} min</div>
                                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 col-span-2">Skills: {((report.assignmentRequirementProfile as any).requiredSkills || []).join(", ") || "-"}</div>
                                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 col-span-2">Languages: {((report.assignmentRequirementProfile as any).languageNeeds || []).join(", ") || "-"}</div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-600 font-medium break-words">No assignment profile attached.</p>
                                )}
                              </div>

                              {report.additionalNotes && (
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Additional Notes</p>
                                  <p className="text-xs text-slate-600 font-medium">{report.additionalNotes}</p>
                                </div>
                              )}

                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                <span>Visit: {report.visitType || "first_visit"}</span>
                                <span>Submitted: {report.createdAt ? new Date(report.createdAt).toLocaleString() : "N/A"}</span>
                              </div>

                              <div className="pt-1">
                                <Button
                                  variant="outline"
                                  className="w-full rounded-xl border-slate-200 text-[#4F46E5] font-bold"
                                  onClick={() => setSelectedSourceReport(report)}
                                >
                                  View full report
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {detailTab === "Live Updates" && (
                      <div className="space-y-4">
                        <p className="text-[13px] text-slate-500 font-medium">Latest mission update is driven by the fieldworker status endpoint.</p>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex justify-between items-baseline mb-2">
                            <h4 className="text-sm font-black text-[#1A1A3D]">Current status</h4>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Live</span>
                          </div>
                          <div className="text-[13px] font-medium text-slate-600 italic">{selectedMission.statusText || "Waiting for fieldworker update."}</div>
                        </div>
                      </div>
                    )}

                    {detailTab === "Volunteer" && (
                      <div className="space-y-4">
                        <p className="text-[13px] text-slate-500 font-medium">{getAssigneeRoleText(selectedMission.targetAudience)} assignment and proximity details.</p>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-[#4F46E5] font-black text-xs border-2 border-white shadow-sm overflow-hidden">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedMission.assignedToName || selectedMission.assignedTo || "FieldWorker"}`} alt="avatar" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-[#1A1A3D] truncate">
                              {selectedMission.assignedToName || (selectedMission.targetAudience === "volunteer" ? "No volunteer selected" : "No field worker selected")}
                            </p>
                            <p className="text-[11px] font-medium text-slate-400">{selectedMission.assignedVolunteerReason || "Auto-assigned by zone and skill match."}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {detailTab === "Outcome" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 bg-white rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Outcome Projections</p>
                          <p className="text-2xl font-black text-center text-[#10B981]">{selectedMission.assignedVolunteerMatch || 92}%</p>
                          <p className="text-[10px] font-bold text-center text-slate-400 uppercase">Success Prob.</p>
                        </div>
                        <div className="p-5 bg-white rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Risk Assessment</p>
                          <p className="text-2xl font-black text-center text-[#10B981]">Low</p>
                          <p className="text-[10px] font-bold text-center text-slate-400 uppercase">Risk Level</p>
                        </div>
                      </div>
                    )}

                    {detailTab === "History" && (
                      <div className="space-y-4">
                        <p className="text-[13px] text-slate-500 font-medium">Mission history is persisted in Firestore and reused by the fieldworker view.</p>
                        <div className="flex gap-3 text-xs">
                          <span className="font-bold text-[#4F46E5] w-14 shrink-0">Now</span>
                          <span className="text-slate-600 font-medium">Mission created from coordinator dispatch</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-8 border-t border-slate-50 bg-white absolute bottom-0 left-0 right-0 flex gap-4">
                  <Button variant="outline" className="flex-1 border-slate-200 text-[#1A1A3D] font-bold py-7 rounded-2xl">Flag for Review</Button>
                  <Button className="flex-1 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:opacity-90 text-white font-bold py-7 rounded-2xl shadow-lg">Close Mission & Finalize</Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>

      <Sheet open={showCreateMission} onOpenChange={setShowCreateMission}>
        <SheetContent className="sm:max-w-lg p-0 flex flex-col bg-white border-l border-slate-100 font-['Plus_Jakarta_Sans']">
          <div className="p-8 border-b border-slate-50">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#1A1A3D]">
                {creationStep === 1 ? "Create New Mission" : creationStep === 2 ? "Audience Assignment" : "Review and Dispatch"}
              </h2>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className={cn("flex-1 h-1.5 rounded-full transition-all", step <= creationStep ? "bg-[#4F46E5]" : "bg-slate-100")} />
              ))}
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">
              STEP {creationStep} OF 3 — {creationStep === 1 ? "MISSION DETAILS" : creationStep === 2 ? "AUDIENCE + ASSIGNMENT" : "FINAL REVIEW"}
            </p>
          </div>

          <div className="p-0 flex-1 overflow-y-auto space-y-0">
            {creationStep === 1 && (
              <div className="p-8 space-y-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">MISSION TITLE</label>
                    <Input
                      placeholder="Enter mission title..."
                      className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-bold placeholder:font-normal"
                      value={missionForm.title}
                      onChange={(event) => setMissionForm((current) => ({ ...current, title: event.target.value }))}
                    />
                    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-indigo-50/50 rounded-lg text-xs text-[#4F46E5] font-bold cursor-pointer hover:bg-indigo-50 transition-colors">
                      <Sparkles className="w-3.5 h-3.5" /> Suggestion: {selectedZone ? `${selectedZone.name} urgent relief` : "Mission title suggestion"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">MISSION AUDIENCE</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: "fieldworker", label: "Field Worker", helper: "Select new zones" },
                        { id: "volunteer", label: "Volunteer", helper: "Show current zones" },
                      ].map((audience) => (
                        <button
                          key={audience.id}
                          type="button"
                          onClick={() => setMissionForm((current) => ({
                            ...current,
                            targetAudience: audience.id as CoordinatorMissionCreatePayload["targetAudience"],
                            zoneId: "",
                          }))}
                          className={cn(
                            "p-4 rounded-xl border-2 text-left transition-all",
                            missionForm.targetAudience === audience.id ? "border-[#4F46E5] bg-indigo-50/40" : "border-slate-100 bg-white hover:border-indigo-200",
                          )}
                        >
                          <div className="text-sm font-black uppercase tracking-widest text-[#1A1A3D]">{audience.label}</div>
                          <div className="text-[11px] font-medium text-slate-400 mt-1">{audience.helper}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">NEED TYPE</label>
                      <select
                        className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 text-sm font-bold appearance-none"
                        value={missionForm.needType}
                        onChange={(event) => setMissionForm((current) => ({ ...current, needType: event.target.value }))}
                      >
                        <option>Food Distribution</option>
                        <option>Medical Support</option>
                        <option>Education Support</option>
                        <option>Safety Patrol</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        {missionForm.targetAudience === "volunteer" ? "CURRENT ZONES" : "NEW ZONES"}
                      </label>
                      <select
                        className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 text-sm font-bold appearance-none text-slate-900"
                        value={missionForm.zoneId}
                        onChange={(event) => setMissionForm((current) => ({ ...current, zoneId: event.target.value }))}
                        disabled={zonesQuery.isLoading}
                      >
                        <option value="" disabled>
                          {zonesQuery.isLoading
                            ? "Loading zones..."
                            : zoneOptions.length
                              ? missionForm.targetAudience === "volunteer"
                                ? "Select a current zone"
                                : "Select a new zone"
                              : "No zones available"}
                        </option>
                        {zoneOptions.map((zone: CoordinatorZone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.name}{zone.ward ? ` · ${zone.ward}` : ""}
                          </option>
                        ))}
                      </select>
                      {!zonesQuery.isLoading && !zonesQuery.data?.zones.length && (
                        <p className="text-[11px] font-medium text-amber-600">No zones were returned for this NGO. Check zone seed data or the zones API.</p>
                      )}
                      {!zonesQuery.isLoading && zonesQuery.data?.zones.length > 0 && !zoneOptions.length && (
                        <p className="text-[11px] font-medium text-slate-500">No {missionForm.targetAudience === "volunteer" ? "current" : "new"} zones found. Falling back to all zones.</p>
                      )}

                      {missionForm.targetAudience === "fieldworker" && (
                        <div className="mt-3 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-widest text-[#4F46E5]">Need a new zone?</p>
                              <p className="text-[11px] text-slate-500">Create a fresh zone and dispatch the mission into it.</p>
                            </div>
                            <Button type="button" variant="outline" className="h-9 rounded-full text-[#4F46E5] border-indigo-200 bg-white" onClick={() => setShowNewZoneForm((value) => !value)}>
                              {showNewZoneForm ? "Use Existing Zone" : "Add New Zone"}
                            </Button>
                          </div>

                          {showNewZoneForm && (
                            <div className="grid grid-cols-1 gap-3">
                              <Input
                                placeholder="New zone name"
                                value={newZoneForm.name}
                                onChange={(event) => setNewZoneForm((current) => ({ ...current, name: event.target.value }))}
                                className="h-11 rounded-xl bg-white"
                              />
                              <div className="grid grid-cols-2 gap-3">
                                <Input
                                  placeholder="Ward"
                                  value={newZoneForm.ward}
                                  onChange={(event) => setNewZoneForm((current) => ({ ...current, ward: event.target.value }))}
                                  className="h-11 rounded-xl bg-white"
                                />
                                <Input
                                  placeholder="City"
                                  value={newZoneForm.city}
                                  onChange={(event) => setNewZoneForm((current) => ({ ...current, city: event.target.value }))}
                                  className="h-11 rounded-xl bg-white"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">PRIORITY</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: "low", label: "Low", color: "bg-blue-50 text-blue-600 border-blue-100" },
                        { id: "high", label: "High", color: "bg-amber-50 text-amber-600 border-amber-100" },
                        { id: "critical", label: "Critical", color: "bg-red-50 text-red-600 border-red-100" },
                      ].map((priority) => (
                        <button
                          type="button"
                          key={priority.id}
                          onClick={() => setMissionForm((current) => ({ ...current, priority: priority.id as CoordinatorMission["priority"] }))}
                          className={cn(
                            "p-4 rounded-xl border-2 text-center cursor-pointer font-black text-xs uppercase tracking-widest transition-all",
                            missionForm.priority === priority.id ? `${priority.color} border-current` : "border-slate-100 text-slate-400",
                          )}
                        >
                          {priority.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">DESCRIPTION</label>
                    <textarea
                      className="w-full h-32 bg-slate-50/50 border border-slate-100 rounded-2xl p-4 text-sm font-medium resize-none placeholder:text-slate-300"
                      placeholder="Add field context for the volunteer..."
                      value={missionForm.description}
                      onChange={(event) => setMissionForm((current) => ({ ...current, description: event.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {creationStep === 2 && (
              <div className="p-8 space-y-6">
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-[#4F46E5]" />
                  <p className="text-sm font-bold text-[#3730A3]">Backend candidate scoring based on zone familiarity, skills, and availability.</p>
                </div>

                <div className="space-y-4">
                  {(candidatesQuery.data ?? []).map((candidate) => (
                    <div
                      key={candidate.id}
                      className={cn(
                        "rounded-[1.5rem] border p-5 transition-all cursor-pointer",
                        selectedVolunteerForMission?.id === candidate.id ? "border-[#4F46E5] bg-indigo-50/30 ring-1 ring-[#4F46E5]" : "border-slate-100 bg-white hover:border-indigo-200",
                      )}
                      onClick={() => {
                        setSelectedVolunteerForMission(candidate);
                        setMissionForm((current) => ({ ...current, assignedTo: candidate.id, assignedVolunteerName: candidate.name }));
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[#4F46E5] border-2 border-white shadow-sm overflow-hidden shrink-0">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${candidate.name}`} alt="avatar" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <p className="text-base font-bold text-[#1A1A3D] truncate">{candidate.name}</p>
                            <span className="text-sm font-black text-[#4F46E5]">{candidate.matchPercent}% match</span>
                          </div>
                          {candidate.isPartnerSupport && (
                            <div className="mt-1">
                              <Badge className="bg-amber-100 text-amber-800 border-none text-[10px] font-bold uppercase">
                                Partner Support · {candidate.sourceNgoName || "Partner NGO"}
                              </Badge>
                            </div>
                          )}
                          <div className="h-1.5 w-full bg-indigo-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#4F46E5] rounded-full" style={{ width: `${candidate.matchPercent}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg">
                          <Activity className="w-3 h-3 text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-600">{candidate.skills.length} skills</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-600">{candidate.distance}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg">
                          <CheckCircle2 className="w-3 h-3 text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-600">{candidate.successRate}% success</span>
                        </div>
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setIsScoringExpanded(isScoringExpanded === candidate.name ? null : candidate.name);
                          }}
                          className="text-xs font-bold text-[#4F46E5] hover:underline"
                        >
                          Full breakdown →
                        </button>
                      </div>

                      {isScoringExpanded === candidate.name && (
                        <div className="mt-4 bg-[#EEF2FF] border border-indigo-100 rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                          <div className="flex items-center gap-2 text-[#3730A3]">
                            <Sparkles className="h-3.5 w-3.5 fill-[#3730A3]/20" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">Match breakdown</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { label: "Skill Match", val: Math.min(100, candidate.matchPercent) },
                              { label: "Proximity", val: candidate.zoneFamiliarity ? 98 : 72 },
                              { label: "Availability", val: candidate.availability === "available" ? 100 : 60 },
                              { label: "Past Success", val: Math.round(candidate.successRate) },
                            ].map((item) => (
                              <div key={item.label} className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                  <span>{item.label}</span>
                                  <span className="text-[#4F46E5]">{item.val}%</span>
                                </div>
                                <div className="h-1 w-full bg-indigo-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#4F46E5] rounded-full" style={{ width: `${item.val}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-[11px] leading-relaxed text-slate-500 italic border-t border-indigo-100/50 pt-2">{candidate.reason}</p>
                        </div>
                      )}
                    </div>
                  ))}

                  {!candidatesQuery.data?.length && (
                    <div className="rounded-[1.5rem] border border-dashed border-slate-200 p-6 text-sm text-slate-500 bg-slate-50">
                      Select a zone and need type to fetch recommended fieldworkers.
                    </div>
                  )}
                </div>
              </div>
            )}

            {creationStep === 3 && (
              <div className="space-y-0">
                <div className="bg-amber-50 border-y border-amber-100 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-[#92400E]">Ready to dispatch this mission.</p>
                      <p className="text-xs text-[#92400E]/70 font-medium">The created mission will immediately appear in the assigned fieldworker&apos;s active mission view.</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-8">
                  <div className="bg-[#4F46E5] rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4 opacity-70">
                      <Shield className="w-5 h-5" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Deployment Review</span>
                    </div>
                    <h3 className="text-xl font-bold mb-1">{missionForm.title || "Untitled Mission"}</h3>
                    <p className="text-indigo-100/70 text-sm font-medium">{missionForm.needType} · {selectedZone ? selectedZone.name : "No zone selected"}</p>
                    <div className="mt-6 flex items-center gap-3 pt-6 border-t border-white/10">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs ring-2 ring-white/20 overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedVolunteerForMission?.name || "AutoAssign"}`} alt="avatar" />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">{getAssigneeLabel(missionForm.targetAudience)}</p>
                        <p className="text-sm font-bold text-white">{selectedVolunteerForMission?.name || "Auto assign if a best match exists"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-slate-400" />
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Resources available for this mission</h4>
                      </div>
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                      {[
                        { name: "Food packets", qty: "24 available", dist: "1.2km" },
                        { name: "First aid kit", qty: "3 kits", dist: "2.4km" },
                        { name: "NGO vehicle", qty: "1 available", dist: "call" },
                        { name: "Blankets", qty: "8 available", dist: "0.8km" },
                      ].map((resource) => (
                        <div key={resource.name} className="flex items-center gap-3 bg-white border border-slate-100 rounded-full px-4 py-2.5 whitespace-nowrap shadow-sm">
                          <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-[#1A1A3D] leading-none mb-0.5">{resource.name}</span>
                            <div className="flex items-center gap-1 opacity-60">
                              <span className="text-[9px] font-bold text-slate-400">{resource.qty}</span>
                              <span className="text-[9px] font-bold text-slate-400">•</span>
                              <span className="text-[9px] font-bold text-slate-400">{resource.dist}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[#4F46E5] border border-slate-100">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-slate-600">Pre-assign resources to volunteer</span>
                      </div>
                      <Switch className="data-[state=checked]:bg-[#4F46E5]" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Intelligence Brief Preview</h4>
                    <div className="p-6 bg-slate-50 rounded-[2rem] border-l-4 border-[#4F46E5] relative">
                      <Sparkles className="absolute top-4 right-4 w-5 h-5 text-[#4F46E5]/20" />
                      <p className="text-[15px] leading-relaxed text-slate-600 italic font-medium">
                        "Target zone requires ground response coordination. Dispatch {selectedVolunteerForMission?.name || "the assigned fieldworker"} to cover the selected mission area."
                      </p>
                      <div className="mt-4 flex items-center gap-2 text-[#4F46E5] text-[10px] font-black uppercase tracking-widest">
                        <Sparkles className="w-3.5 h-3.5" /> Generated from mission form
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-white rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Outcome Projections</p>
                      <p className="text-2xl font-black text-center text-[#10B981]">{selectedVolunteerForMission?.matchPercent || 92}%</p>
                      <p className="text-[10px] font-bold text-center text-slate-400 uppercase">Success Prob.</p>
                    </div>
                    <div className="p-5 bg-white rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Risk Assessment</p>
                      <p className="text-2xl font-black text-center text-[#10B981]">Low</p>
                      <p className="text-[10px] font-bold text-center text-slate-400 uppercase">Risk Level</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-8 border-t border-slate-50 flex gap-4 bg-white/80 backdrop-blur-md">
            {creationStep > 1 && (
              <Button onClick={() => setCreationStep((step) => step - 1)} variant="outline" className="w-1/3 border-slate-200 text-slate-500 font-bold py-7 rounded-2xl">
                Back
              </Button>
            )}
            <Button
              onClick={async () => {
                if (creationStep < 3) {
                  setCreationStep((step) => step + 1);
                  return;
                }
                await createMission();
              }}
              disabled={createMissionMutation.isPending}
              className={cn(
                "flex-1 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:opacity-90 text-white font-bold py-7 rounded-2xl shadow-lg flex items-center justify-center gap-3",
                creationStep === 3 && "from-blue-600 to-indigo-700",
              )}
            >
              {createMissionMutation.isPending ? "Dispatching..." : creationStep === 3 ? "Dispatch Mission Now" : "Next Step →"}
              {creationStep === 3 && <Send className="w-5 h-5" />}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!selectedSourceReport} onOpenChange={(open) => !open && setSelectedSourceReport(null)}>
        <DialogContent className="sm:max-w-5xl w-[95vw] h-[90vh] overflow-hidden rounded-2xl p-0">
          {selectedSourceReport && (
            <div className="h-full flex flex-col bg-white">
              <DialogHeader className="p-6 border-b border-slate-100">
                <DialogTitle className="text-xl font-bold text-[#1A1A3D] flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">{selectedSourceReport.id}</span>
                  <span>{selectedSourceReport.needType || "Unknown Need"}</span>
                  <Badge className="bg-[#FFF7ED] text-[#9A3412] border-none uppercase">{selectedSourceReport.severity || "unknown"}</Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="text-sm text-slate-500 font-medium">
                  {selectedSourceReport.location?.address || "Unknown location"} • {selectedSourceReport.sourceType || selectedSourceReport.inputType || "source"}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confidence</p>
                    <p className="text-2xl font-black text-[#1A1A3D]">{selectedSourceReport.confidence ?? 0}%</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Families</p>
                    <p className="text-2xl font-black text-[#1A1A3D]">{selectedSourceReport.familiesAffected ?? 0}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Persons</p>
                    <p className="text-2xl font-black text-[#1A1A3D]">{selectedSourceReport.personsAffected ?? 0}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verification</p>
                    <p className="text-2xl font-black text-[#1A1A3D] lowercase">{selectedSourceReport.verificationState || "unverified"}</p>
                  </div>
                </div>

                <section className="space-y-2">
                  <h4 className="text-[13px] font-black text-slate-400 uppercase tracking-widest">Need Incidents</h4>
                  {selectedSourceReport.needIncidents?.length ? (
                    <div className="space-y-3">
                      {selectedSourceReport.needIncidents.map((incident: any, index: number) => (
                        <div key={`dialog-incident-${index}`} className="p-4 rounded-xl border border-slate-100 bg-white">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge className="bg-indigo-50 text-[#4F46E5] border-none">{incident.needType || "Need"}</Badge>
                            <Badge className="bg-slate-50 text-slate-600 border-none uppercase">{incident.severity || "medium"}</Badge>
                            <span className="text-xs text-slate-500 font-bold">Urgency: {incident.urgencyWindowHours ?? 24}h</span>
                          </div>
                          <p className="text-sm text-slate-600">Families: {incident.familiesAffected ?? 0} • Persons: {incident.personsAffected ?? 0}</p>
                          <p className="text-sm text-slate-600">Vulnerable Groups: {(incident.vulnerableGroups || []).join(", ") || "-"}</p>
                          <p className="text-sm text-slate-600">Risk Flags: {(incident.riskFlags || []).join(", ") || "-"}</p>
                          <div className="mt-2">
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Required Resources</p>
                            {(incident.requiredResources || []).length ? (
                              <div className="space-y-1">
                                {(incident.requiredResources || []).map((res: any, resourceIndex: number) => (
                                  <p key={`res-${resourceIndex}`} className="text-sm text-slate-600">
                                    {res.name || "resource"} • qty {res.quantity ?? 0} • {res.priority || "medium"}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">No resources listed.</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No incident details attached.</p>
                  )}
                </section>

                <section className="space-y-2">
                  <h4 className="text-[13px] font-black text-slate-400 uppercase tracking-widest">Assignment Requirement Profile</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-600">Preferred Responder: {String((selectedSourceReport.assignmentRequirementProfile as any)?.preferredResponderType || "volunteer")}</div>
                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-600">Estimated Effort: {String((selectedSourceReport.assignmentRequirementProfile as any)?.estimatedEffortMinutes || 60)} minutes</div>
                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-600">Required Skills: {(((selectedSourceReport.assignmentRequirementProfile as any)?.requiredSkills) || []).join(", ") || "-"}</div>
                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-600">Language Needs: {(((selectedSourceReport.assignmentRequirementProfile as any)?.languageNeeds) || []).join(", ") || "-"}</div>
                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-600">Safe Visit Windows: {(((selectedSourceReport.assignmentRequirementProfile as any)?.safeVisitTimeWindows) || []).join(", ") || "-"}</div>
                    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-600">Revisit Recommended At: {String((selectedSourceReport.assignmentRequirementProfile as any)?.revisitRecommendedAt || "-")}</div>
                  </div>
                </section>

                {selectedSourceReport.additionalNotes && (
                  <section className="space-y-2">
                    <h4 className="text-[13px] font-black text-slate-400 uppercase tracking-widest">Additional Notes</h4>
                    <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-4">{selectedSourceReport.additionalNotes}</p>
                  </section>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold uppercase tracking-widest pt-2 border-t border-slate-100">
                  <span>Visit: {selectedSourceReport.visitType || "first_visit"}</span>
                  <span>Submitted: {selectedSourceReport.createdAt ? new Date(selectedSourceReport.createdAt).toLocaleString() : "N/A"}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignMission} onOpenChange={(open) => !open && setAssignMission(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign volunteer to mission</DialogTitle>
          </DialogHeader>

          {assignMission && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <span className="font-bold text-[#1A1A3D]">{assignMission.title}</span>
                <span className="text-slate-500"> · {assignMission.zoneName || assignMission.zoneId}</span>
                <span className="text-slate-500"> · {assignMission.needType}</span>
              </div>

              {assignCandidatesQuery.isLoading && (
                <div className="rounded-xl border border-slate-100 bg-white px-4 py-6 text-sm text-slate-500">
                  Loading volunteer recommendations...
                </div>
              )}

              {!assignCandidatesQuery.isLoading && !(assignCandidatesQuery.data?.length) && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-6 text-sm text-amber-700">
                  No volunteer candidates available for this mission.
                </div>
              )}

              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {(assignCandidatesQuery.data || []).map((candidate, index) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => setSelectedAssignCandidate(candidate)}
                    className={cn(
                      "w-full text-left rounded-xl border px-4 py-3 transition-all",
                      selectedAssignCandidate?.id === candidate.id
                        ? "border-[#4F46E5] bg-indigo-50"
                        : "border-slate-100 bg-white hover:border-indigo-200",
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#1A1A3D]">{candidate.name}</span>
                          {index === 0 && (
                            <Badge className="bg-[#EEF2FF] text-[#3730A3] border-none text-[10px] font-bold">BEST MATCH</Badge>
                          )}
                          {candidate.isPartnerSupport && (
                            <Badge className="bg-amber-100 text-amber-800 border-none text-[10px] font-bold">PARTNER SUPPORT</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">{candidate.reason}</p>
                        <p className="text-[11px] text-slate-400 font-medium">Skills: {candidate.skills.join(", ") || "-"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-[#1A1A3D]">{candidate.matchPercent}%</p>
                        <p className="text-[11px] text-slate-400">{candidate.distance}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setAssignMission(null)}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  disabled={!assignCandidatesQuery.data?.length || assignVolunteerMutation.isPending}
                  onClick={() => {
                    const candidates = assignCandidatesQuery.data || [];
                    const pool = candidates.slice(0, 3);
                    const pick = pool[Math.floor(Math.random() * pool.length)];
                    if (pick) {
                      setSelectedAssignCandidate(pick);
                      assignVolunteerMutation.mutate(pick.id);
                    }
                  }}
                >
                  Auto-assign
                </Button>
                <Button
                  disabled={!selectedAssignCandidate || assignVolunteerMutation.isPending}
                  onClick={() => selectedAssignCandidate && assignVolunteerMutation.mutate(selectedAssignCandidate.id)}
                >
                  {assignVolunteerMutation.isPending ? "Assigning..." : "Confirm assignment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CoordinatorMissions;
