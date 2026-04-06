const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const getAuthToken = () => localStorage.getItem("nexus_access_token");

const buildHeaders = (json = false) => {
  const headers: HeadersInit = {};
  if (json) {
    headers["Content-Type"] = "application/json";
  }

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const wantsJson = Boolean(init.body) && !(init.body instanceof FormData);
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...buildHeaders(wantsJson),
      ...(init.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const message = payload?.detail || payload?.message || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export interface CoordinatorInsight {
  title?: string;
  summary?: string;
  severity?: string;
  status?: string;
  generatedAt?: string;
  recommendedAction?: string;
}

export interface CoordinatorDashboardResponse {
  avgZoneScore: number;
  zonesAtRisk: number;
  activeMissions: number;
  availableVolunteers: number;
  recentInsights: CoordinatorInsight[];
  zoneCount: number;
  criticalZones: Array<{
    id?: string;
    name?: string;
    score?: number;
    riskLevel?: string;
  }>;
}

export interface CoordinatorSignalCounts {
  food: number;
  education: number;
  health: number;
  substance: number;
  shelter: number;
  safety: number;
}

export interface CoordinatorSafetyProfile {
  score: number;
  level: "safe" | "moderate" | "caution";
  interactions: Array<{
    timestamp?: string;
    type?: string;
    notes?: string;
    sentiment?: string;
  }>;
  timeOfDayFlags: Record<string, boolean>;
  specificFlags: string[];
}

export interface CoordinatorZone {
  id: string;
  name: string;
  ward?: string;
  city?: string;
  ngoIds: string[];
  currentScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  scoreHistory: Array<{
    week: number;
    score: number;
    actual?: number | null;
  }>;
  signalCounts: CoordinatorSignalCounts;
  activeMissions: number;
  lastIntervention?: string | null;
  forecastScore: number;
  forecastConfidence: number;
  generationalCohort?: string;
  safetyProfile: CoordinatorSafetyProfile;
  geometry?: Record<string, unknown> | null;
  lat: number;
  lng: number;
  updatedAt?: string;
}

export interface CoordinatorHeatmapPoint {
  lat: number;
  lng: number;
  weight: number;
  zoneId: string;
  name: string;
  riskLevel: CoordinatorZone["riskLevel"];
}

export interface CoordinatorZoneDetailResponse {
  zone: CoordinatorZone;
  recentReports: Array<{
    id: string;
    zoneId: string;
    needType?: string;
    severity?: string;
    familiesAffected?: number;
    createdAt?: string;
    sourceType?: string;
  }>;
}

export interface CoordinatorZoneHistoryResponse {
  zoneId: string;
  history: Array<{
    week: number;
    score: number;
    actual?: number | null;
  }>;
}

export interface CoordinatorZoneCreatePayload {
  name: string;
  ward?: string;
  city?: string;
  lat?: number;
  lng?: number;
  currentScore?: number;
  riskLevel?: CoordinatorZone["riskLevel"];
  generationalCohort?: string;
  geometry?: Record<string, unknown> | null;
}

export interface CoordinatorMissionResource {
  name: string;
  quantity?: string | number | null;
  status?: string | null;
}

export interface CoordinatorMissionCandidate {
  id: string;
  name: string;
  initials: string;
  matchPercent: number;
  distance: string;
  skills: string[];
  availability: string;
  burnoutRisk: string;
  successRate: number;
  reason: string;
  zoneFamiliarity: boolean;
  travelRadius: number;
}

export interface CoordinatorMissionLocation {
  lat: number;
  lng: number;
  address: string;
  landmark?: string | null;
}

export interface CoordinatorMission {
  id: string;
  ngoId: string;
  creatorId: string;
  creatorName?: string;
  title: string;
  description: string;
  zoneId: string;
  zoneName: string;
  ward?: string;
  city?: string;
  needType: string;
  targetAudience: "fieldworker" | "volunteer";
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "dispatched" | "en_route" | "on_ground" | "completed" | "failed" | "cancelled";
  assignedTo?: string | null;
  assignedToName?: string | null;
  assignedVolunteerMatch?: number;
  assignedVolunteerDistance?: string | null;
  assignedVolunteerReason?: string | null;
  resources: CoordinatorMissionResource[];
  sourceReportIds: string[];
  sourceNgoIds: string[];
  location: CoordinatorMissionLocation;
  instructions?: string | null;
  notes?: string | null;
  estimatedDurationMinutes: number;
  progress: number;
  statusText?: string | null;
  familiesHelped: number;
  outcomeNotes?: string | null;
  mergedFrom?: {
    reports?: number;
    ngos?: number;
  } | null;
  newUpdates?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  dispatchedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  autoAssigned?: boolean;
}

export interface CoordinatorMissionListResponse {
  missions: CoordinatorMission[];
  total: number;
  active: number;
  pending: number;
  completed: number;
}

export interface CoordinatorMissionCreatePayload {
  title: string;
  description: string;
  zoneId: string;
  needType: string;
  targetAudience: "fieldworker" | "volunteer";
  priority: CoordinatorMission["priority"];
  assignedTo?: string | null;
  assignedVolunteerName?: string | null;
  resources?: CoordinatorMissionResource[];
  sourceReportIds?: string[];
  sourceNgoIds?: string[];
  instructions?: string | null;
  estimatedDurationMinutes?: number;
  allowAutoAssign?: boolean;
  notes?: string | null;
}

export interface CoordinatorMissionCreateResponse {
  mission: CoordinatorMission;
  matchedCandidate?: CoordinatorMissionCandidate | null;
}

export const getCoordinatorDashboard = () => request<CoordinatorDashboardResponse>("/coordinator/dashboard");

export const getCoordinatorZones = (riskFilter?: string) => {
  const query = riskFilter ? `?risk_filter=${encodeURIComponent(riskFilter)}` : "";
  return request<{ zones: CoordinatorZone[]; total: number }>(`/coordinator/zones${query}`);
};

export const getCoordinatorZoneDetail = (zoneId: string) =>
  request<CoordinatorZoneDetailResponse>(`/coordinator/zones/${zoneId}`);

export const getCoordinatorHeatmap = () => request<CoordinatorHeatmapPoint[]>("/coordinator/zones/heatmap");

export const getCoordinatorZoneHistory = (zoneId: string) =>
  request<CoordinatorZoneHistoryResponse>(`/coordinator/zones/${zoneId}/history`);

export const createCoordinatorZone = (payload: CoordinatorZoneCreatePayload) =>
  request<CoordinatorZone>("/coordinator/zones", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getCoordinatorMissions = (status?: string, zoneId?: string) => {
  const params = new URLSearchParams();
  if (status) {
    params.set("status", status);
  }
  if (zoneId) {
    params.set("zoneId", zoneId);
  }
  const query = params.toString();
  return request<CoordinatorMissionListResponse>(`/coordinator/missions${query ? `?${query}` : ""}`);
};

export const getCoordinatorMissionCandidatesForAudience = (zoneId: string, needType: string, targetAudience: "fieldworker" | "volunteer") =>
  request<CoordinatorMissionCandidate[]>(`/coordinator/missions/candidates?zoneId=${encodeURIComponent(zoneId)}&needType=${encodeURIComponent(needType)}&targetAudience=${encodeURIComponent(targetAudience)}`);

export const getCoordinatorMissionCandidates = (zoneId: string, needType: string) =>
  getCoordinatorMissionCandidatesForAudience(zoneId, needType, "fieldworker");

export const createCoordinatorMission = (payload: CoordinatorMissionCreatePayload) =>
  request<CoordinatorMissionCreateResponse>("/coordinator/missions", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getCoordinatorMissionDetail = (missionId: string) =>
  request<CoordinatorMissionCreateResponse>(`/coordinator/missions/${missionId}`);

export const getVolunteerMissions = (status?: string) => {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<CoordinatorMissionListResponse>(`/volunteer/missions${query}`);
};