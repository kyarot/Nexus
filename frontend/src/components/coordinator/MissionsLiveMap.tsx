import { useEffect, useMemo, useRef, useState } from "react";
import { CircleF, GoogleMap, InfoWindowF, MarkerClustererF, MarkerF, useJsApiLoader } from "@react-google-maps/api";

import { cn } from "@/lib/utils";
import type { CoordinatorMission, CoordinatorZone } from "@/lib/coordinator-api";

interface MissionsLiveMapProps {
  missions: CoordinatorMission[];
  zones: CoordinatorZone[];
  selectedMissionId?: string | null;
  onMissionSelect?: (mission: CoordinatorMission) => void;
  className?: string;
}

const defaultCenter = { lat: 12.9716, lng: 77.5946 };

const statusColor: Record<CoordinatorMission["status"], string> = {
  pending: "#f59e0b",
  dispatched: "#4f46e5",
  en_route: "#0ea5e9",
  on_ground: "#10b981",
  completed: "#22c55e",
  failed: "#ef4444",
  cancelled: "#94a3b8",
};

const priorityStroke: Record<CoordinatorMission["priority"], string> = {
  low: "#94a3b8",
  medium: "#3b82f6",
  high: "#f59e0b",
  critical: "#ef4444",
};

const libraries: ("visualization")[] = ["visualization"];

const activeStatuses = new Set<CoordinatorMission["status"]>(["dispatched", "en_route", "on_ground"]);

const zoneStroke: Record<CoordinatorZone["riskLevel"], string> = {
  low: "#22c55e",
  medium: "#3b82f6",
  high: "#f59e0b",
  critical: "#ef4444",
};

const zoneFill: Record<CoordinatorZone["riskLevel"], string> = {
  low: "rgba(34,197,94,0.12)",
  medium: "rgba(59,130,246,0.12)",
  high: "rgba(245,158,11,0.14)",
  critical: "rgba(239,68,68,0.16)",
};

export function MissionsLiveMap({ missions, zones, selectedMissionId, onMissionSelect, className }: MissionsLiveMapProps) {
  const apiKey = import.meta.env.VITE_GMAPS_KEY || "";
  const { isLoaded } = useJsApiLoader({
    id: "missions-live-map-script",
    googleMapsApiKey: apiKey,
    libraries,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [focusedMissionId, setFocusedMissionId] = useState<string | null>(null);
  const [hoveredMissionId, setHoveredMissionId] = useState<string | null>(null);

  const missionsWithCoordinates = useMemo(
    () =>
      missions.filter(
        (mission) =>
          Number.isFinite(mission.location?.lat) &&
          Number.isFinite(mission.location?.lng) &&
          Math.abs(mission.location.lat) <= 90 &&
          Math.abs(mission.location.lng) <= 180,
      ),
    [missions],
  );

  const selectedMission = useMemo(
    () => missionsWithCoordinates.find((mission) => mission.id === (selectedMissionId || focusedMissionId)) ?? null,
    [missionsWithCoordinates, selectedMissionId, focusedMissionId],
  );

  const hoveredMission = useMemo(
    () => missionsWithCoordinates.find((mission) => mission.id === hoveredMissionId) ?? null,
    [hoveredMissionId, missionsWithCoordinates],
  );

  useEffect(() => {
    if (!isLoaded || !mapRef.current) {
      return;
    }

    if (selectedMission) {
      mapRef.current.panTo({ lat: selectedMission.location.lat, lng: selectedMission.location.lng });
      mapRef.current.setZoom(Math.max(12, mapRef.current.getZoom() || 12));
      return;
    }

    if (!missionsWithCoordinates.length) {
      mapRef.current.setCenter(defaultCenter);
      mapRef.current.setZoom(11);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    missionsWithCoordinates.forEach((mission) => {
      bounds.extend({ lat: mission.location.lat, lng: mission.location.lng });
    });

    mapRef.current.fitBounds(bounds, 40);
  }, [isLoaded, missionsWithCoordinates, selectedMission]);

  if (!apiKey) {
    return (
      <div className={cn("rounded-2xl bg-slate-100 p-4 text-center text-xs text-slate-500", className)}>
        Set VITE_GMAPS_KEY to render the live mission map.
      </div>
    );
  }

  if (!isLoaded) {
    return <div className={cn("rounded-2xl bg-[#E0E7FF]", className)} />;
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-slate-100", className)}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={defaultCenter}
        zoom={11}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        onUnmount={() => {
          mapRef.current = null;
        }}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            {
              featureType: "poi",
              stylers: [{ visibility: "off" }],
            },
            {
              featureType: "transit",
              stylers: [{ visibility: "off" }],
            },
          ],
        }}
      >
        {zones.map((zone) => (
          <CircleF
            key={`${zone.id}-risk-zone`}
            center={{ lat: zone.lat, lng: zone.lng }}
            radius={Math.max(140, Math.min(750, Math.round(zone.currentScore) * 7))}
            options={{
              strokeColor: zoneStroke[zone.riskLevel],
              strokeOpacity: 0.8,
              strokeWeight: 1,
              fillColor: zoneFill[zone.riskLevel],
              fillOpacity: 0.32,
              clickable: false,
              zIndex: 1,
            }}
          />
        ))}

        <MarkerClustererF
          options={{
            minimumClusterSize: 3,
            gridSize: 54,
            maxZoom: 14,
          }}
        >
          {(clusterer) =>
            <>
              {missionsWithCoordinates.map((mission) => {
                const isSelected = selectedMission?.id === mission.id;
                const roleGlyph = mission.targetAudience === "volunteer" ? "V" : "F";

                return (
                  <MarkerF
                    key={mission.id}
                    clusterer={clusterer}
                    position={{ lat: mission.location.lat, lng: mission.location.lng }}
                    onClick={() => {
                      setFocusedMissionId(mission.id);
                      onMissionSelect?.(mission);
                    }}
                    onMouseOver={() => {
                      setHoveredMissionId(mission.id);
                    }}
                    onMouseOut={() => {
                      setHoveredMissionId((current) => (current === mission.id ? null : current));
                    }}
                    options={{
                      zIndex: isSelected ? 90 : 20,
                      icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: statusColor[mission.status],
                        fillOpacity: 1,
                        strokeColor: priorityStroke[mission.priority],
                        strokeWeight: isSelected ? 4 : 3,
                        scale: isSelected ? 12 : 10,
                      },
                      label: {
                        text: roleGlyph,
                        color: "#ffffff",
                        fontWeight: "900",
                        fontSize: isSelected ? "11px" : "10px",
                      },
                    }}
                  />
                );
              })}
            </>
          }
        </MarkerClustererF>

        {selectedMission ? (
          <InfoWindowF
            position={{ lat: selectedMission.location.lat, lng: selectedMission.location.lng }}
            onCloseClick={() => setFocusedMissionId(null)}
          >
            <div className="max-w-[220px] p-1 text-xs text-slate-700">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {selectedMission.targetAudience === "volunteer" ? "Volunteer Mission" : "Field Worker Mission"}
              </p>
              <p className="font-bold text-[#1A1A3D]">{selectedMission.title}</p>
              <p className="mt-1 text-[11px] text-slate-500">{selectedMission.zoneName}</p>
              <p className="mt-2 text-[11px] font-semibold">
                {selectedMission.status.replace("_", " ")} · {selectedMission.priority}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                Assigned: {selectedMission.assignedToName || (selectedMission.targetAudience === "volunteer" ? "Unassigned Volunteer" : "Unassigned Field Worker")}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">ETA: {selectedMission.estimatedDurationMinutes} min</p>
              <p className="mt-1 text-[11px] text-slate-500">{selectedMission.location.address || "Location available"}</p>
              <p className="mt-2 text-[10px] font-bold text-[#4F46E5]">Click marker to open full mission sheet</p>
            </div>
          </InfoWindowF>
        ) : null}
      </GoogleMap>

      {hoveredMission ? (
        <div className="pointer-events-none absolute left-2 top-2 max-w-[220px] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {hoveredMission.targetAudience === "volunteer" ? "Volunteer Mission" : "Field Worker Mission"}
          </p>
          <p className="mt-0.5 text-xs font-bold text-[#1A1A3D] truncate">{hoveredMission.title}</p>
          <p className="mt-1 text-[11px] text-slate-600 truncate">{hoveredMission.assignedToName || "Unassigned"}</p>
          <p className="mt-1 text-[10px] text-slate-500 truncate">{hoveredMission.zoneName}</p>
          <p className="mt-1 text-[10px] font-semibold text-[#4F46E5]">{hoveredMission.status.replace("_", " ")} · ETA {hoveredMission.estimatedDurationMinutes}m</p>
        </div>
      ) : null}

      <div className="absolute bottom-2 left-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 backdrop-blur-sm">
        <span className="mr-3 inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#4f46e5]" />Active</span>
        <span className="mr-3 inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f59e0b]" />Pending</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#ef4444]" />Failed</span>
      </div>

      <div className="absolute bottom-2 right-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 backdrop-blur-sm">
        <span className="mr-3">V = Volunteer</span>
        <span>F = Field Worker</span>
      </div>

      <div className="absolute top-2 right-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 backdrop-blur-sm">
        {missionsWithCoordinates.filter((mission) => activeStatuses.has(mission.status)).length} live · {missionsWithCoordinates.length} plotted
      </div>
    </div>
  );
}
