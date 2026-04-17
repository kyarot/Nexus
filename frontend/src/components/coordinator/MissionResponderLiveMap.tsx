import { useMemo, useState } from "react";
import { GoogleMap, InfoWindowF, MarkerF } from "@react-google-maps/api";

import { cn } from "@/lib/utils";
import { useNexusGoogleMapsLoader } from "@/lib/google-maps";
import type { CoordinatorMissionLocation, CoordinatorMissionTrackedResponder } from "@/lib/coordinator-api";

interface MissionResponderLiveMapProps {
  responders: CoordinatorMissionTrackedResponder[];
  missionLocation: CoordinatorMissionLocation;
  onResponderClick?: (responder: CoordinatorMissionTrackedResponder) => void;
  className?: string;
}

const defaultCenter = { lat: 12.9716, lng: 77.5946 };
const statusColor = {
  online: "#10b981",
  offline: "#94a3b8",
};

export function MissionResponderLiveMap({ responders, missionLocation, onResponderClick, className }: MissionResponderLiveMapProps) {
  const apiKey = import.meta.env.VITE_GMAPS_KEY || "";
  const { isLoaded } = useNexusGoogleMapsLoader();

  const [activeResponderId, setActiveResponderId] = useState<string | null>(null);

  const center = useMemo(() => {
    const validResponder = responders.find(
      (responder) => Number.isFinite(responder.location?.lat) && Number.isFinite(responder.location?.lng),
    );

    if (validResponder) {
      return { lat: validResponder.location.lat, lng: validResponder.location.lng };
    }

    if (Number.isFinite(missionLocation.lat) && Number.isFinite(missionLocation.lng)) {
      return { lat: missionLocation.lat, lng: missionLocation.lng };
    }

    return defaultCenter;
  }, [missionLocation.lat, missionLocation.lng, responders]);

  const selectedResponder = responders.find((responder) => responder.id === activeResponderId) || null;

  if (!apiKey) {
    return (
      <div className={cn("rounded-3xl border border-slate-100 bg-slate-100 p-4 text-center text-xs text-slate-500", className)}>
        Set VITE_GMAPS_KEY to render live responder map.
      </div>
    );
  }

  if (!isLoaded) {
    return <div className={cn("rounded-3xl border border-slate-100 bg-[#E0E7FF]", className)} />;
  }

  return (
    <div className={cn("relative overflow-hidden rounded-3xl border border-slate-100", className)}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={14}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: true,
          fullscreenControl: false,
          streetViewControl: false,
        }}
      >
        <MarkerF
          position={{ lat: missionLocation.lat || center.lat, lng: missionLocation.lng || center.lng }}
          options={{
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: "#4f46e5",
              fillOpacity: 0.75,
              strokeColor: "#ffffff",
              strokeWeight: 2,
              scale: 7,
            },
            label: {
              text: "M",
              color: "#ffffff",
              fontWeight: "900",
              fontSize: "9px",
            },
            zIndex: 30,
          }}
        />

        {responders.map((responder) => {
          const roleGlyph = responder.role === "volunteer" ? "V" : "F";
          return (
            <MarkerF
              key={responder.id}
              position={{ lat: responder.location.lat, lng: responder.location.lng }}
              onClick={() => {
                setActiveResponderId(responder.id);
                onResponderClick?.(responder);
              }}
              onMouseOver={() => setActiveResponderId(responder.id)}
              options={{
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  fillColor: responder.online ? statusColor.online : statusColor.offline,
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                  scale: 10,
                },
                label: {
                  text: roleGlyph,
                  color: "#ffffff",
                  fontWeight: "900",
                  fontSize: "10px",
                },
                zIndex: 50,
              }}
            />
          );
        })}

        {selectedResponder ? (
          <InfoWindowF
            position={{ lat: selectedResponder.location.lat, lng: selectedResponder.location.lng }}
            onCloseClick={() => setActiveResponderId(null)}
          >
            <div className="max-w-[220px] p-1 text-xs text-slate-700">
              <p className="font-bold text-[#1A1A3D]">{selectedResponder.name}</p>
              <p className="mt-1 text-[11px] text-slate-500 uppercase">{selectedResponder.role}</p>
              <p className="mt-1 text-[11px] text-slate-600">{selectedResponder.online ? "Online now" : "Offline"}</p>
              <p className="mt-1 text-[11px] text-slate-500">{selectedResponder.location.address || "Live location"}</p>
              <p className="mt-2 text-[10px] font-bold text-[#4F46E5]">Click marker to open profile</p>
            </div>
          </InfoWindowF>
        ) : null}
      </GoogleMap>

      <div className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-3 py-1.5 text-[10px] font-semibold text-slate-600 backdrop-blur-sm">
        <span className="mr-3">M = Mission</span>
        <span className="mr-3">V = Volunteer</span>
        <span>F = Field Worker</span>
      </div>
    </div>
  );
}
