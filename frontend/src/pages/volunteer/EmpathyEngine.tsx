import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { DirectionsRenderer, GoogleMap, MarkerF } from "@react-google-maps/api";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Info,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Shield,
  Clock,
  Box,
  Truck,
  Wind,
  Activity,
  Mic,
  Navigation,
  ChevronDown,
  Loader2,
  ExternalLink,
  LocateFixed,
  Route,
  X,
  ListFilter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNexusGoogleMapsLoader } from "@/lib/google-maps";
import {
  claimMissionResources,
  getVolunteerEmpathyBrief,
  requestExtraMissionResources,
  type VolunteerEmpathyResponse,
} from "@/lib/ops-api";
import { getVolunteerMissions, type CoordinatorMission } from "@/lib/coordinator-api";
import { useToast } from "@/hooks/use-toast";

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toString = (value: unknown, fallback = "") => {
  return typeof value === "string" ? value : fallback;
};

const prettyStatus = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const missionStatusTone = (status: string) => {
  const normalized = status.toLowerCase();
  if (["dispatched", "en_route", "on_ground"].includes(normalized)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (normalized === "pending") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (["completed"].includes(normalized)) {
    return "bg-slate-100 text-slate-700 border-slate-200";
  }
  return "bg-rose-50 text-rose-700 border-rose-200";
};

const isValidCoordinate = (value: number) => Number.isFinite(value) && Math.abs(value) <= 180;
export default function EmpathyEngine() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [audioAssist, setAudioAssist] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeMeta, setRouteMeta] = useState<{ distance: string; duration: string } | null>(null);
  const missionIdFromQuery = searchParams.get("missionId") || undefined;
  const mapsApiKey = import.meta.env.VITE_GMAPS_KEY || "";

  const { isLoaded: isMapLoaded } = useNexusGoogleMapsLoader();

  const missionsQuery = useQuery({
    queryKey: ["volunteer-missions-brief-selector"],
    queryFn: () => getVolunteerMissions(),
    staleTime: 30_000,
  });

  const missionOptions = useMemo(
    () => (Array.isArray(missionsQuery.data?.missions) ? missionsQuery.data.missions : []) as CoordinatorMission[],
    [missionsQuery.data?.missions]
  );

  const selectedMissionId = missionIdFromQuery || missionOptions[0]?.id;

  useEffect(() => {
    if (missionIdFromQuery) {
      const exists = missionOptions.some((mission) => mission.id === missionIdFromQuery);
      if (!exists && missionOptions[0]?.id) {
        setSearchParams({ missionId: missionOptions[0].id }, { replace: true });
      }
      return;
    }
    if (missionOptions[0]?.id) {
      setSearchParams({ missionId: missionOptions[0].id }, { replace: true });
    }
  }, [missionIdFromQuery, missionOptions, setSearchParams]);

  const empathyQuery = useQuery<VolunteerEmpathyResponse>({
    queryKey: ["volunteer-empathy-brief", selectedMissionId],
    queryFn: () => getVolunteerEmpathyBrief(selectedMissionId, false),
    refetchInterval: 15000,
    enabled: Boolean(selectedMissionId),
  });

  const payload = empathyQuery.data;
  const mission = payload?.mission || {};
  const empathy = payload?.empathy;
  const resources = useMemo(
    () => (Array.isArray(payload?.resources) ? payload?.resources : []).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")),
    [payload?.resources]
  );

  const missionId = toString(mission.id, "");
  const missionTitle = toString(mission.title, "Untitled Mission");
  const missionCode = missionId ? `#${missionId.slice(0, 8).toUpperCase()}` : "#PENDING";
  const selectedMissionMeta = missionOptions.find((item) => item.id === selectedMissionId);
  const missionLocation = (mission.location && typeof mission.location === "object" ? mission.location : {}) as Record<string, unknown>;
  const destination = {
    lat: toNumber(missionLocation.lat, NaN),
    lng: toNumber(missionLocation.lng, NaN),
  };
  const hasDestination = isValidCoordinate(destination.lat) && isValidCoordinate(destination.lng);

  const missionContext = empathy?.missionContext || {};
  const liveMissionStatus = toString(mission.status, "");
  const liveMissionZone = toString(mission.zoneName, "") || toString((missionLocation as Record<string, unknown>).address, "");
  const contextZoneLabel = liveMissionZone || toString(missionContext.zone, "Assigned Zone");
  const contextStatusLabel = liveMissionStatus ? prettyStatus(liveMissionStatus) : toString(missionContext.status, "Dispatched");
  const destinationAddress = toString(missionLocation.address, toString(missionContext.zone, "Mission area"));
  const zoneSafety = empathy?.zoneSafety || {};
  const trust = toNumber(empathy?.trust, 72);
  const pulseBars = Array.isArray(empathy?.pulse) && empathy.pulse.length ? empathy.pulse.slice(0, 7).map((v) => toNumber(v, 40)) : [30, 45, 60, 40, 75, 55, 45];

  useEffect(() => {
    if (!isNavOpen || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        toast({
          title: "Live location unavailable",
          description: "Please allow location access to preview route navigation.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isNavOpen, toast]);

  useEffect(() => {
    if (!isNavOpen || !isMapLoaded || !currentPosition || !hasDestination || !window.google?.maps) return;

    setIsRouteLoading(true);
    const service = new window.google.maps.DirectionsService();
    service.route(
      {
        origin: currentPosition,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      },
      (result, status) => {
        setIsRouteLoading(false);
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          const leg = result.routes[0]?.legs?.[0];
          setRouteMeta({
            distance: leg?.distance?.text || "-",
            duration: leg?.duration?.text || "-",
          });
          return;
        }
        setDirections(null);
        setRouteMeta(null);
      }
    );
  }, [isNavOpen, isMapLoaded, currentPosition, hasDestination, destination.lat, destination.lng]);

  const openInGoogleMaps = () => {
    if (!hasDestination) {
      toast({ title: "Mission location missing", description: "No mission coordinates available yet.", variant: "destructive" });
      return;
    }

    const origin = currentPosition ? `${currentPosition.lat},${currentPosition.lng}` : "Current+Location";
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(`${destination.lat},${destination.lng}`)}&travelmode=driving`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const startNavigation = () => {
    if (!hasDestination) {
      toast({ title: "Mission location missing", description: "No mission coordinates available yet.", variant: "destructive" });
      return;
    }
    setIsNavOpen(true);
  };

  const claimResourcesNow = async () => {
    if (!missionId) return;
    setIsClaiming(true);
    try {
      const result = await claimMissionResources(missionId);
      toast({
        title: "Resources claimed",
        description: `Updated ${result.itemsUpdated} inventory item(s).`,
      });
      await empathyQuery.refetch();
    } catch (error) {
      toast({ title: "Claim failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsClaiming(false);
    }
  };

  const requestMore = async () => {
    if (!missionId || resources.length === 0) return;
    const candidateItems = resources
      .slice(0, 3)
      .map((item) => ({
        itemId: toString(item.itemId, ""),
        name: toString(item.name, "Resource"),
        requestedQty: 1,
        unit: toString(item.unit, "units"),
      }))
      .filter((item) => item.itemId);

    if (!candidateItems.length) {
      toast({ title: "No linked inventory items", description: "Resources must be linked to inventory item IDs to request extras.", variant: "destructive" });
      return;
    }

    const warehouseId = toString(resources[0]?.warehouseId, "");
    if (!warehouseId) {
      toast({ title: "Warehouse missing", description: "No warehouse is attached to this mission resource plan.", variant: "destructive" });
      return;
    }

    setIsRequesting(true);
    try {
      await requestExtraMissionResources(missionId, {
        warehouseId,
        reason: "Additional quantity needed after on-ground assessment.",
        items: candidateItems,
      });
      toast({ title: "Request sent", description: "Coordinator will receive this in realtime notifications." });
      await empathyQuery.refetch();
    } catch (error) {
      toast({ title: "Request failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsRequesting(false);
    }
  };

  if (missionsQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FE]">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your assigned missions...
        </div>
      </div>
    );
  }

  if (!selectedMissionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FE] px-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700 max-w-lg text-center">
          No assigned missions found for briefing. Once a mission is assigned to you, it will appear here.
        </div>
      </div>
    );
  }

  if (empathyQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FE]">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Generating mission empathy brief...
        </div>
      </div>
    );
  }

  if (empathyQuery.isError || !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FE]">
        <div className="rounded-xl border border-rose-200 bg-white p-6 text-sm text-rose-700">
          Unable to load empathy briefing right now.
          <Button className="ml-3" onClick={() => empathyQuery.refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FE]">
      <DashboardTopBar breadcrumb="Mission / Briefing" />

      <div className="flex-1 p-6 space-y-6 flex flex-col">
        <header className="mb-0">
          <h1 className="text-[2rem] font-bold text-[#1A1A3D] tracking-tight">Pre-Mission Briefing</h1>
          <p className="text-slate-500 font-medium text-base">Cognitive readiness assessment for {missionTitle} ({missionCode})</p>
          <div className="mt-4 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <ListFilter className="h-3.5 w-3.5" />
              Select Assigned Mission
            </div>
            <Select
              value={selectedMissionId || ""}
              onValueChange={(nextMissionId) => {
                if (!nextMissionId) return;
                setSearchParams({ missionId: nextMissionId }, { replace: true });
              }}
            >
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50 text-[#1A1A3D] font-semibold">
                <SelectValue placeholder="Choose mission" />
              </SelectTrigger>
              <SelectContent>
                {missionOptions.map((missionOption) => (
                  <SelectItem key={missionOption.id} value={missionOption.id}>
                    {missionOption.title} • {prettyStatus(missionOption.status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedMissionMeta ? (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className={cn("rounded-full border px-2 py-0.5 font-semibold", missionStatusTone(selectedMissionMeta.status))}>
                  {prettyStatus(selectedMissionMeta.status)}
                </span>
                <span className="text-slate-500">
                  {selectedMissionMeta.zoneName || selectedMissionMeta.zoneId || "Assigned zone"}
                </span>
              </div>
            ) : null}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
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
                <p className="text-base font-bold text-[#1A1A3D]">{contextZoneLabel}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</p>
                <p className="text-base font-bold text-[#1A1A3D]">{contextStatusLabel}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Language</p>
                <p className="text-base font-bold text-[#1A1A3D]">{toString(missionContext.language, "English")}</p>
              </div>
            </div>

            <div className="bg-[#FBFBFF] rounded-xl p-4 border border-slate-50 relative">
              <h3 className="text-sm font-bold text-[#1A1A3D] mb-1">Recent Trigger Events</h3>
              <p className="text-slate-500 text-xs font-medium leading-relaxed">{toString(missionContext.triggerSummary, "Recent field updates indicate urgent need in this zone.")}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
            <div className="bg-[#9AF7C9] rounded-[2rem] p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#1A1A3D]/60">Trust</p>
                  <p className="text-[2rem] font-black text-[#1A1A3D]">{trust}%</p>
                </div>
                <ShieldCheck className="w-6 h-6 text-[#1A1A3D] opacity-40" />
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Pulse</p>
              <div className="flex items-end gap-1 h-12">
                {pulseBars.map((h, i) => (
                  <div
                    key={i}
                    className={cn("w-2 rounded-full", i === 4 ? "bg-[#4F46E5] h-full" : "bg-[#C7D2FE] h-[var(--height)]")}
                    style={{ "--height": `${h}%` } as React.CSSProperties}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-card border border-slate-50 space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-[#14532D]" />
              <h2 className="text-sm font-semibold text-[#1A1A3D]">Zone safety profile</h2>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-[#F0FDF4] rounded-full">
              <div className="w-2 h-2 rounded-full bg-[#14532D]" />
              <span className="text-xs font-medium text-[#14532D]">Safety {toNumber(zoneSafety.score, 64)}/100 • {toString(zoneSafety.level, "moderate")}</span>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Past Interactions Timeline</p>
            <div className="space-y-3">
              {(Array.isArray(zoneSafety.timeline) ? zoneSafety.timeline : []).slice(0, 4).map((row, i) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="text-[10px] font-bold text-slate-400 w-12">{toString(row.date, "Recent")}</span>
                  <div className="flex-1 bg-[#F8F7FF] rounded-xl p-3 flex justify-between items-center">
                    <span className="text-xs font-medium text-[#1A1A3D]">{toString(row.note, "Community interaction update")}</span>
                    <div className={cn("w-2 h-2 rounded-full", toString(row.status) === "success" ? "bg-green-500" : "bg-amber-500")} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#F0FDF4] rounded-xl text-[#14532D]">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold">{toString(zoneSafety.visitTip, "Prefer daytime engagement and clear communication.")}</span>
            </div>
          </div>

          <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl space-y-2">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Specific notes for this visit</p>
            <ul className="space-y-1.5">
              {(Array.isArray(zoneSafety.specificNotes) ? zoneSafety.specificNotes : []).slice(0, 4).map((note, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-amber-900 font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {String(note)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-card border border-slate-50 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Box className="w-5 h-5 text-[#4F46E5]" />
              </div>
              <h2 className="text-sm font-semibold text-[#1A1A3D]">Resources available near this zone</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button disabled={!missionId || isClaiming} onClick={claimResourcesNow} className="rounded-xl bg-[#4F46E5] hover:bg-[#3f37c9]">
                {isClaiming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Claim Resources
              </Button>
              <Button disabled={!missionId || isRequesting} variant="outline" onClick={requestMore} className="rounded-xl">
                {isRequesting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Request Extra
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-2">
            {resources.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No resources are attached to this mission yet.
              </div>
            ) : (
              resources.map((res, i) => (
                <div key={i} className="min-w-[240px] bg-white border border-slate-100 rounded-[1.25rem] p-5 space-y-4 relative shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", i % 4 === 0 ? "bg-amber-100" : i % 4 === 1 ? "bg-red-100" : i % 4 === 2 ? "bg-blue-100" : "bg-green-100")}>
                      {i % 4 === 0 ? <Activity className="w-5 h-5 text-amber-600" /> : i % 4 === 1 ? <Wind className="w-5 h-5 text-red-600" /> : i % 4 === 2 ? <Box className="w-5 h-5 text-blue-600" /> : <Truck className="w-5 h-5 text-green-600" />}
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold border-none px-2 py-0.5 rounded-full text-green-600 bg-green-50">
                      {toString(res.status, "Planned")}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-[#1A1A3D] mb-0.5">{toString(res.name, "Resource")}</p>
                    <p className="text-sm font-black text-[#4F46E5]">{toNumber(res.quantity, 0)} {toString(res.unit, "units")}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <MapPin className="w-3 h-3" />
                      <span className="text-[10px] font-medium">{toString(res.warehouseName, "Assigned warehouse")}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Info className="w-3 h-3" />
                      <span className="text-[10px] font-medium">ID: {toString(res.itemId, "N/A")}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-400 pt-2">
            <Info className="w-4 h-4" />
            <p className="text-[11px] font-medium tracking-tight">Gemini selected this resource set from nearest available warehouse stock.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 shrink-0">
          <div className="bg-[#4F46E5] rounded-[2rem] p-6 text-white shadow-md relative overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 opacity-70" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Say First</span>
            </div>
            <p className="text-base font-bold leading-tight mb-4 relative z-10">"{toString(empathy?.sayFirst, "I am here to listen first and support safely.")}"</p>
            <div className="flex gap-2 flex-wrap">
              {(Array.isArray(empathy?.sayTags) ? empathy.sayTags : ["Supportive", "Low Pressure"]).map((tag, i) => (
                <Badge key={i} className="bg-white/10 text-white border-none py-1 px-3 rounded-full text-[10px] font-bold">{String(tag)}</Badge>
              ))}
            </div>
          </div>

          <div className="bg-orange-50 rounded-[2rem] p-6 shadow-sm border border-orange-100">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-5 h-5 text-orange-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">Avoid</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(Array.isArray(empathy?.avoid) ? empathy.avoid : []).slice(0, 4).map((item, i) => (
                <div key={i} className="p-3 bg-white rounded-xl">
                  <p className="text-xs font-bold text-[#1A1A3D]">{toString(item.title, "Avoid this")}</p>
                  <p className="text-[10px] text-slate-500 whitespace-nowrap overflow-hidden">{toString(item.note, "Keep language simple and supportive")}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="flex flex-col space-y-4">
          <header className="flex justify-between items-end">
            <div>
              <h2 className="text-xl font-bold text-[#1A1A3D]">Decision Tree</h2>
              <p className="text-slate-500 text-xs">Dynamic sentiment mapping.</p>
            </div>
          </header>

          <div className="space-y-4 pb-4">
            {(Array.isArray(empathy?.decisionTree) ? empathy.decisionTree : []).slice(0, 6).map((item, i) => (
              <div key={i} className="bg-white rounded-[1.5rem] p-6 border border-slate-100 flex gap-4 shadow-sm">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center font-black text-slate-300 text-sm shrink-0">{toString(item.id, String(i + 1).padStart(2, "0"))}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-bold text-[#1A1A3D] truncate">If: <span className="text-[#4F46E5] italic">"{toString(item.if, "Community response changes")}"</span></p>
                    <ChevronDown className="w-4 h-4 text-slate-300" />
                  </div>
                  <div className="pl-4 border-l-2 border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 mb-1 uppercase">RESPONSE:</p>
                    <p className="text-xs text-slate-500 font-medium italic leading-relaxed">{toString(item.response, "Acknowledge concern and provide the next practical support step.")}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-center justify-between gap-4 py-8 px-1 mt-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between flex-1">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#94A3B8]">Audio Assistance</span>
              <p className="text-sm font-bold text-[#1A1A3D]">Activate In-Ear Mode</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch className="data-[state=checked]:bg-[#3730A3] h-6 w-10 scale-90" checked={audioAssist} onCheckedChange={setAudioAssist} />
              <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-[#3730A3] border border-slate-100 shadow-sm">
                <Mic className="w-4 h-4" />
              </div>
            </div>
          </div>

          <Button
            onClick={startNavigation}
            className="h-16 px-8 rounded-2xl bg-gradient-to-r from-[#4F46E5] to-[#5A57FF] text-white font-bold text-base flex gap-3 shadow-lg shadow-indigo-100 hover:opacity-90 transition-opacity"
          >
            I'm ready — Navigate to mission <Navigation className="w-5 h-5" />
          </Button>
        </div>

        {isNavOpen ? (
          <div className="fixed right-5 bottom-5 z-50 w-[min(92vw,420px)] rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-[#4F46E5]" />
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">Live Navigation</p>
                  <p className="text-sm font-bold text-[#1A1A3D] truncate max-w-[220px]">{destinationAddress || "Mission destination"}</p>
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsNavOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="h-60 bg-slate-100">
              {!mapsApiKey ? (
                <div className="h-full w-full flex items-center justify-center px-4 text-center text-sm text-slate-500">
                  Add VITE_GMAPS_KEY to enable in-app map preview.
                </div>
              ) : !isMapLoaded ? (
                <div className="h-full w-full flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading map...
                </div>
              ) : !hasDestination ? (
                <div className="h-full w-full flex items-center justify-center px-4 text-center text-sm text-slate-500">
                  Mission location coordinates are unavailable.
                </div>
              ) : (
                <GoogleMap
                  mapContainerStyle={{ width: "100%", height: "100%" }}
                  center={currentPosition || destination}
                  zoom={14}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    fullscreenControl: false,
                    streetViewControl: false,
                  }}
                >
                  <MarkerF position={destination} />
                  {currentPosition ? (
                    <MarkerF
                      position={currentPosition}
                      options={{
                        icon: {
                          path: google.maps.SymbolPath.CIRCLE,
                          fillColor: "#2563eb",
                          fillOpacity: 1,
                          strokeColor: "#ffffff",
                          strokeWeight: 2,
                          scale: 7,
                        },
                      }}
                    />
                  ) : null}
                  {directions ? (
                    <DirectionsRenderer
                      directions={directions}
                      options={{
                        suppressMarkers: true,
                        polylineOptions: { strokeColor: "#4F46E5", strokeWeight: 5, strokeOpacity: 0.9 },
                      }}
                    />
                  ) : null}
                </GoogleMap>
              )}
            </div>

            <div className="px-4 py-3 space-y-3 bg-white">
              <div className="flex items-center gap-3 text-xs">
                <div className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 text-indigo-700 px-2 py-1 font-bold">
                  <LocateFixed className="w-3.5 h-3.5" /> Live
                </div>
                <span className="text-slate-500 font-medium">
                  {isRouteLoading ? "Calculating best route..." : routeMeta ? `${routeMeta.distance} • ${routeMeta.duration}` : "Waiting for GPS route"}
                </span>
              </div>

              <div className="flex gap-2">
                <Button onClick={openInGoogleMaps} className="flex-1 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA]">
                  <ExternalLink className="w-4 h-4 mr-2" /> Open in GMaps
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => setDirections(null)}>
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
