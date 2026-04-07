import { useMemo } from "react";
import { CircleF, GoogleMap, HeatmapLayerF, PolygonF, useJsApiLoader } from "@react-google-maps/api";

import { cn } from "@/lib/utils";

export interface TerrainZoneMapItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  currentScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  geometry?: {
    type?: string;
    coordinates?: number[][][] | number[][][][];
  } | null;
}

export interface TerrainHeatmapPoint {
  id?: string;
  zoneId: string;
  lat: number;
  lng: number;
  weight: number;
  riskLevel?: string;
  needType?: string;
}

interface NeedTerrainMapProps {
  zones?: TerrainZoneMapItem[];
  heatmapPoints?: TerrainHeatmapPoint[];
  opacity?: number;
  onZoneClick?: (zone: TerrainZoneMapItem) => void;
  className?: string;
  showLegend?: boolean;
}

const libraries: ("visualization")[] = ["visualization"];
const defaultCenter = { lat: 12.9716, lng: 77.5946 };

const zoneStroke: Record<string, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#22c55e",
};

const zoneFill: Record<string, string> = {
  critical: "#ef444440",
  high: "#f59e0b40",
  medium: "#3b82f640",
  low: "#22c55e40",
};

const getGeometryPaths = (geometry?: TerrainZoneMapItem["geometry"]): google.maps.LatLngLiteral[][] => {
  if (!geometry?.type || !geometry.coordinates) {
    return [];
  }

  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
    return (geometry.coordinates as number[][][])
      .filter((ring) => Array.isArray(ring))
      .map((ring) =>
        ring
          .filter((point) => Array.isArray(point) && point.length >= 2)
          .map((point) => ({ lat: Number(point[1]), lng: Number(point[0]) }))
      )
      .filter((ring) => ring.length >= 3);
  }

  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    return (geometry.coordinates as number[][][][])
      .flatMap((polygon) =>
        polygon.map((ring) =>
          ring
            .filter((point) => Array.isArray(point) && point.length >= 2)
            .map((point) => ({ lat: Number(point[1]), lng: Number(point[0]) }))
        )
      )
      .filter((ring) => ring.length >= 3);
  }

  return [];
};

export function NeedTerrainMap({ zones = [], heatmapPoints = [], opacity = 0.7, onZoneClick, className, showLegend = true }: NeedTerrainMapProps) {
  const apiKey = import.meta.env.VITE_GMAPS_KEY || "";
  const { isLoaded } = useJsApiLoader({
    id: "terrain-map-script",
    googleMapsApiKey: apiKey,
    libraries,
  });

  const center = useMemo(() => {
    if (zones.length > 0) {
      const avgLat = zones.reduce((sum, zone) => sum + zone.lat, 0) / zones.length;
      const avgLng = zones.reduce((sum, zone) => sum + zone.lng, 0) / zones.length;
      return { lat: avgLat, lng: avgLng };
    }
    if (heatmapPoints.length > 0) {
      const avgLat = heatmapPoints.reduce((sum, point) => sum + point.lat, 0) / heatmapPoints.length;
      const avgLng = heatmapPoints.reduce((sum, point) => sum + point.lng, 0) / heatmapPoints.length;
      return { lat: avgLat, lng: avgLng };
    }
    return defaultCenter;
  }, [zones, heatmapPoints]);

  const weightedPoints = useMemo(() => {
    if (!(globalThis as any).google?.maps) {
      return [];
    }
    const maxWeight = Math.max(...heatmapPoints.map((point) => Number(point.weight) || 0), 0);
    const safeMax = maxWeight > 0 ? maxWeight : 1;

    return heatmapPoints.map((point) => ({
      location: new google.maps.LatLng(point.lat, point.lng),
      // Normalize to improve visibility when live point weights are very small.
      weight: Math.max(0.8, Math.min(5, ((Number(point.weight) || 0) / safeMax) * 5)),
    }));
  }, [heatmapPoints]);

  if (!apiKey) {
    return (
      <div className={cn("relative overflow-hidden rounded-card bg-[#10132a] p-6 text-slate-200", className)}>
        <p className="text-sm font-semibold">Google Maps key missing</p>
        <p className="mt-2 text-xs text-slate-400">Set VITE_GMAPS_KEY in frontend environment to render live terrain heatmap.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return <div className={cn("relative overflow-hidden rounded-card bg-[#10132a]", className)} />;
  }

  return (
    <div className={cn("relative overflow-hidden rounded-card bg-[#10132a]", className)}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={11}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: true,
          streetViewControl: false,
        }}
      >
        {weightedPoints.length > 0 ? (
          <HeatmapLayerF
            data={weightedPoints}
            options={{
              radius: 50,
              opacity: Math.max(0.1, Math.min(1, opacity)),
              gradient: [
                "rgba(34,197,94,0)",
                "rgba(34,197,94,0.6)",
                "rgba(59,130,246,0.7)",
                "rgba(245,158,11,0.8)",
                "rgba(239,68,68,0.9)",
              ],
            }}
          />
        ) : null}

        {zones.map((zone) => (
          <CircleF
            key={`${zone.id}-risk`}
            center={{ lat: zone.lat, lng: zone.lng }}
            radius={Math.max(120, zone.currentScore * 12)}
            options={{
              strokeColor: zoneStroke[zone.riskLevel] || zoneStroke.low,
              fillColor: zoneFill[zone.riskLevel] || zoneFill.low,
              strokeOpacity: 0.8,
              fillOpacity: 0.35,
              strokeWeight: 2,
              clickable: true,
            }}
            onClick={() => onZoneClick?.(zone)}
          />
        ))}

        {zones.flatMap((zone) => {
          const paths = getGeometryPaths(zone.geometry);
          return paths.map((path, index) => (
            <PolygonF
              key={`${zone.id}-poly-${index}`}
              paths={path}
              options={{
                strokeColor: zoneStroke[zone.riskLevel] || zoneStroke.low,
                fillColor: zoneFill[zone.riskLevel] || zoneFill.low,
                strokeOpacity: 0.9,
                fillOpacity: 0.2,
                strokeWeight: 2,
                clickable: true,
              }}
              onClick={() => onZoneClick?.(zone)}
            />
          ));
        })}

      </GoogleMap>

      {showLegend ? (
        <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg bg-card/90 px-3 py-2 text-[10px] font-medium backdrop-blur-sm">
          {[{ c: "bg-destructive", l: "Critical" }, { c: "bg-warning", l: "High" }, { c: "bg-primary", l: "Medium" }, { c: "bg-success", l: "Low" }].map((item) => (
            <span key={item.l} className="flex items-center gap-1">
              <span className={cn("h-2 w-2 rounded-full", item.c)} />
              {item.l}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
