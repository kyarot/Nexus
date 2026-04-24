export interface TerrainMapExportZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  currentScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
}

export interface TerrainMapExportPoint {
  zoneId: string;
  lat: number;
  lng: number;
  weight: number;
  needType?: string;
  riskLevel?: string;
}

interface TerrainMapExportOptions {
  fileName: string;
  title: string;
  subtitle?: string;
  filterLabel?: string;
  zones: TerrainMapExportZone[];
  points: TerrainMapExportPoint[];
}

const riskColors: Record<string, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#22c55e",
};

const riskLabels: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const computeBounds = (zones: TerrainMapExportZone[], points: TerrainMapExportPoint[]) => {
  const coords = [
    ...zones.map((zone) => ({ lat: zone.lat, lng: zone.lng })),
    ...points.map((point) => ({ lat: point.lat, lng: point.lng })),
  ].filter((coord) => Number.isFinite(coord.lat) && Number.isFinite(coord.lng));

  if (!coords.length) {
    return {
      minLat: 12.8,
      maxLat: 13.2,
      minLng: 77.4,
      maxLng: 77.8,
    };
  }

  return coords.reduce(
    (bounds, coord) => ({
      minLat: Math.min(bounds.minLat, coord.lat),
      maxLat: Math.max(bounds.maxLat, coord.lat),
      minLng: Math.min(bounds.minLng, coord.lng),
      maxLng: Math.max(bounds.maxLng, coord.lng),
    }),
    {
      minLat: coords[0].lat,
      maxLat: coords[0].lat,
      minLng: coords[0].lng,
      maxLng: coords[0].lng,
    }
  );
};

const projectPoint = (
  lat: number,
  lng: number,
  bounds: ReturnType<typeof computeBounds>,
  width: number,
  height: number,
  padding: number,
) => {
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const latSpan = Math.max(0.0001, bounds.maxLat - bounds.minLat);
  const lngSpan = Math.max(0.0001, bounds.maxLng - bounds.minLng);
  const x = padding + ((lng - bounds.minLng) / lngSpan) * usableWidth;
  const y = padding + (1 - (lat - bounds.minLat) / latSpan) * usableHeight;
  return { x, y };
};

const drawSoftCircle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
) => {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);
  glow.addColorStop(1, `${color}00`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
};

export const downloadTerrainMapSnapshotPng = async (options: TerrainMapExportOptions) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1800;
  canvas.height = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create map export canvas");
  }

  const { zones, points } = options;
  const bounds = computeBounds(zones, points);

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(0.55, "#1e1b4b");
  gradient.addColorStop(1, "#312e81");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 14; i += 1) {
    ctx.beginPath();
    ctx.arc(140 + i * 120, 120 + (i % 3) * 70, 48 + (i % 4) * 10, 0, Math.PI * 2);
    ctx.fill();
  }

  const backdrop = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  backdrop.addColorStop(0, "rgba(255,255,255,0.05)");
  backdrop.addColorStop(0.5, "rgba(255,255,255,0.02)");
  backdrop.addColorStop(1, "rgba(255,255,255,0.08)");
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fillRect(70, 70, canvas.width - 140, 120);
  ctx.fillStyle = "#4f46e5";
  ctx.beginPath();
  ctx.arc(128, 130, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("N", 118, 139);
  ctx.fillStyle = "#1a1a3d";
  ctx.font = "700 30px sans-serif";
  ctx.fillText("NEXUS", 176, 120);
  ctx.font = "500 18px sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(options.subtitle || "Need terrain snapshot export", 176, 150);
  ctx.textAlign = "right";
  ctx.fillText(new Date().toLocaleString(), canvas.width - 92, 120);
  ctx.fillStyle = "#334155";
  ctx.font = "600 16px sans-serif";
  ctx.fillText(options.filterLabel || "All Needs", canvas.width - 92, 148);
  ctx.textAlign = "left";

  const mapLeft = 90;
  const mapTop = 220;
  const mapWidth = canvas.width - 180;
  const mapHeight = 720;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillRect(mapLeft, mapTop, mapWidth, mapHeight);
  ctx.strokeStyle = "rgba(148,163,184,0.3)";
  ctx.lineWidth = 2;
  ctx.strokeRect(mapLeft, mapTop, mapWidth, mapHeight);

  ctx.strokeStyle = "rgba(148,163,184,0.18)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i += 1) {
    const x = mapLeft + (mapWidth / 10) * i;
    const y = mapTop + (mapHeight / 10) * i;
    ctx.beginPath();
    ctx.moveTo(x, mapTop);
    ctx.lineTo(x, mapTop + mapHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mapLeft, y);
    ctx.lineTo(mapLeft + mapWidth, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#1a1a3d";
  ctx.font = "700 26px sans-serif";
  ctx.fillText(options.title, mapLeft, 196);

  const terrainSwirlCount = 16;
  for (let i = 0; i < terrainSwirlCount; i += 1) {
    const t = (i + 1) / terrainSwirlCount;
    const swirlX = mapLeft + mapWidth * (0.15 + ((i * 0.19) % 0.7));
    const swirlY = mapTop + mapHeight * (0.12 + ((i * 0.11) % 0.72));
    drawSoftCircle(ctx, swirlX, swirlY, 90 + t * 70, "#64748b", 0.06);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(mapLeft, mapTop, mapWidth, mapHeight);
  ctx.clip();
  ctx.strokeStyle = "rgba(148,163,184,0.14)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i += 1) {
    ctx.beginPath();
    ctx.moveTo(mapLeft - 40, mapTop + 90 + i * 96);
    ctx.bezierCurveTo(
      mapLeft + mapWidth * 0.2,
      mapTop + 40 + i * 96,
      mapLeft + mapWidth * 0.5,
      mapTop + 160 + i * 82,
      mapLeft + mapWidth + 40,
      mapTop + 120 + i * 96,
    );
    ctx.stroke();
  }
  ctx.restore();

  for (const point of points) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
      continue;
    }
    const { x, y } = projectPoint(point.lat, point.lng, bounds, mapWidth, mapHeight, mapLeft);
    const pointColor = riskColors[String(point.riskLevel || "medium").toLowerCase()] || "#4f46e5";
    const radius = clamp(20 + Math.sqrt(Math.max(0, point.weight)) * 9, 20, 72);
    drawSoftCircle(ctx, x, y, radius, pointColor, 0.22);
  }

  zones.forEach((zone) => {
    if (!Number.isFinite(zone.lat) || !Number.isFinite(zone.lng)) {
      return;
    }
    const { x, y } = projectPoint(zone.lat, zone.lng, bounds, mapWidth, mapHeight, mapLeft);
    const radius = clamp(24 + zone.currentScore * 0.35, 26, 58);
    const color = riskColors[zone.riskLevel] || riskColors.low;

    drawSoftCircle(ctx, x, y, radius * 2.8, color, 0.09);

    ctx.beginPath();
    ctx.fillStyle = `${color}28`;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();

    const labelPadding = 14;
    const cardWidth = 250;
    const cardHeight = 64;
    const labelOnLeft = x + radius + labelPadding + cardWidth > mapLeft + mapWidth - 18;
    const cardX = labelOnLeft ? x - radius - labelPadding - cardWidth : x + radius + labelPadding;
    const cardY = clamp(y - cardHeight / 2, mapTop + 16, mapTop + mapHeight - cardHeight - 16);
    const safeCardX = clamp(cardX, mapLeft + 16, mapLeft + mapWidth - cardWidth - 16);

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(safeCardX, cardY, cardWidth, cardHeight, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = "700 17px sans-serif";
    ctx.fillText(zone.name, safeCardX + 14, cardY + 24);
    ctx.font = "600 13px sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(`${riskLabels[zone.riskLevel] || zone.riskLevel} risk`, safeCardX + 14, cardY + 44);

    ctx.fillStyle = "#475569";
    ctx.font = "500 12px sans-serif";
    ctx.fillText(`Score ${Math.round(zone.currentScore)} · ${Math.max(0, Math.round((zone.currentScore / 100) * 10))} signals`, safeCardX + 122, cardY + 44);
  });

  points.forEach((point) => {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
      return;
    }
    const { x, y } = projectPoint(point.lat, point.lng, bounds, mapWidth, mapHeight, mapLeft);
    const size = clamp(6 + Math.sqrt(Math.max(0, point.weight)) * 2.2, 6, 22);
    const pointColor = riskColors[String(point.riskLevel || "medium").toLowerCase()] || "#4f46e5";

    ctx.beginPath();
    ctx.fillStyle = `${pointColor}44`;
    ctx.arc(x, y, size * 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = `${pointColor}CC`;
    ctx.lineWidth = 1.5;
    ctx.arc(x, y, size * 1.4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = pointColor;
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  });

  const legendY = 1010;
  const legendItems = ["critical", "high", "medium", "low"];
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fillRect(70, legendY - 24, canvas.width - 140, 108);
  ctx.fillStyle = "#1a1a3d";
  ctx.font = "700 18px sans-serif";
  ctx.fillText("Legend", 100, legendY + 4);
  legendItems.forEach((risk, index) => {
    const x = 220 + index * 180;
    ctx.fillStyle = riskColors[risk];
    ctx.beginPath();
    ctx.arc(x, legendY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#334155";
    ctx.font = "600 15px sans-serif";
    ctx.fillText(riskLabels[risk], x + 16, legendY + 5);
  });

  ctx.fillStyle = "#475569";
  ctx.font = "500 13px sans-serif";
  ctx.fillText(`${zones.length} zones · ${points.length} active signals · refreshed ${new Date().toLocaleTimeString()}`, 100, legendY + 34);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = options.fileName;
  link.click();
};