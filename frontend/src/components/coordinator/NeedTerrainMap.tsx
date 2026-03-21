import { cn } from "@/lib/utils";

interface Zone {
  name: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  level: string;
}

interface NeedTerrainMapProps {
  zones?: Zone[];
  onZoneClick?: (zone: Zone) => void;
  className?: string;
  showLegend?: boolean;
}

const defaultZones: Zone[] = [
  { name: "Hebbal", x: 55, y: 30, radius: 50, color: "rgba(239,68,68,0.35)", level: "critical" },
  { name: "Yelahanka", x: 35, y: 50, radius: 35, color: "rgba(245,158,11,0.35)", level: "high" },
  { name: "Jalahalli", x: 70, y: 65, radius: 25, color: "rgba(59,130,246,0.35)", level: "medium" },
  { name: "Malleswaram", x: 45, y: 75, radius: 20, color: "rgba(16,185,129,0.3)", level: "low" },
];

export function NeedTerrainMap({ zones = defaultZones, onZoneClick, className, showLegend = true }: NeedTerrainMapProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-card bg-[#1a1a2e]", className)}>
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(hsl(var(--primary)/0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.3) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      {/* Zones */}
      <svg className="relative h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        {zones.map((z, i) => (
          <g key={i} onClick={() => onZoneClick?.(z)} className="cursor-pointer">
            <circle cx={z.x} cy={z.y} r={z.radius / 3} fill={z.color} />
            <circle cx={z.x} cy={z.y} r={z.radius / 5} fill={z.color} opacity={0.6} />
            <text x={z.x} y={z.y + z.radius / 3 + 4} textAnchor="middle" fill="white" fontSize="3" fontFamily="var(--font-sans)" fontWeight="600">{z.name}</text>
          </g>
        ))}
      </svg>
      {showLegend && (
        <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg bg-card/90 px-3 py-2 text-[10px] font-medium backdrop-blur-sm">
          {[{ c: "bg-destructive", l: "Critical" }, { c: "bg-warning", l: "High" }, { c: "bg-primary", l: "Medium" }, { c: "bg-success", l: "Low" }].map(i => (
            <span key={i.l} className="flex items-center gap-1"><span className={cn("h-2 w-2 rounded-full", i.c)} />{i.l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
