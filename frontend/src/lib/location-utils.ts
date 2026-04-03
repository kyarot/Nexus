export interface PickedLocation {
  lat: number;
  lng: number;
  address?: string;
  pincode?: string;
  areaName?: string;
}

interface ZoneInfo {
  zoneId: string;
  zoneLabel: string;
}

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

export const deriveZoneInfo = (location: PickedLocation): ZoneInfo => {
  const address = (location.address || "").trim();
  const pincode = (location.pincode || "").trim();
  const areaName = (location.areaName || "").trim();

  const addressParts = address
    ? address.split(",").map((part) => part.trim()).filter(Boolean)
    : [];

  const primaryArea = areaName || (addressParts.length > 1 ? addressParts[1] : addressParts[0]) || "mapped-area";
  const secondaryArea = addressParts.length > 2 ? addressParts[2] : (addressParts.length > 0 ? addressParts[0] : "sector");

  // Use coarse geohash-like key (~1.1km at 2 decimals) to keep nearby streets in same area cluster.
  const latBucket = location.lat.toFixed(2);
  const lngBucket = location.lng.toFixed(2);

  const zoneLabel = pincode
    ? `${primaryArea} (${pincode})`
    : primaryArea;

  const zoneBase = primaryArea
    ? `${primaryArea}`
    : `${secondaryArea}-${latBucket}-${lngBucket}`;
  const zoneId = toSlug(zoneBase || `${location.lat.toFixed(3)}-${location.lng.toFixed(3)}`);

  return {
    zoneId: zoneId || "mapped-zone",
    zoneLabel,
  };
};
