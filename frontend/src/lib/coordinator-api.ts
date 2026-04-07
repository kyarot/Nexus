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

export interface GeminiInsightSourceReport {
  id: string;
  needType?: string | null;
  severity?: string | null;
  familiesAffected?: number | null;
  personsAffected?: number | null;
  additionalNotes?: string | null;
  createdAt?: string | null;
}

export interface GeminiInsightItem {
  id: string;
  zoneId?: string | null;
  zoneName?: string | null;
  summary?: string | null;
  signals?: Array<{ label: string; variant: "danger" | "warning" | "info" | "success" }>;
  severity?: "critical" | "high" | "watch" | "resolved";
  status?: string | null;
  reportCount?: number;
  sourceNgoCount?: number;
  generatedAt?: string | null;
  sourceReports?: GeminiInsightSourceReport[];
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

export interface CoordinatorTerrainPoint {
  id: string;
  reportId?: string;
  zoneId: string;
  needType: string;
  severity: "low" | "medium" | "high" | "critical";
  riskLevel: CoordinatorZone["riskLevel"];
  lat: number;
  lng: number;
  weight: number;
  confidence: number;
  familiesAffected: number;
  personsAffected: number;
  minUrgencyWindowHours: number;
  riskFlags: string[];
  updatedAt?: string;
}

export interface CoordinatorTerrainZone {
  id: string;
  name: string;
  ward?: string;
  city?: string;
  lat: number;
  lng: number;
  riskLevel: CoordinatorZone["riskLevel"];
  currentScore: number;
  trendDirection: "up" | "down" | "stable";
  terrainConfidence: number;
  reportVolume7d: number;
  topNeeds: string[];
  signalCounts: Record<string, number>;
  geometry?: Record<string, unknown> | null;
  updatedAt?: string;
}

export interface CoordinatorTerrainSnapshotResponse {
  generatedAt: string;
  zones: CoordinatorTerrainZone[];
  points: CoordinatorTerrainPoint[];
  totalZones: number;
  totalPoints: number;
}

export interface CoordinatorTerrainNarrativeResponse {
  narrative: {
    summary?: string;
    highlights?: string[];
    actions?: string[];
    confidenceLabel?: string;
  };
  source: "cache" | "generated";
  updatedAt?: string;
}

export interface CoordinatorTerrainSidebarResponse {
  zone: {
    id: string;
    name: string;
    ward?: string;
    city?: string;
    riskLevel: "low" | "medium" | "high" | "critical";
    currentScore: number;
    updatedAt?: string;
    trendDirection?: "up" | "down" | "stable";
    signalCounts: Record<string, number>;
    activeMissions: number;
    safetyProfile?: {
      score?: number;
      level?: string;
      specificFlags?: string[];
    };
  };
  badges: {
    category: string;
    riskPercent: number;
    lastUpdateLabel: string;
  };
  narrative: {
    summary?: string;
    etaSignal?: string;
    highlights?: string[];
    actions?: string[];
  };
  activeResponders: Array<{
    id: string;
    name: string;
    initials: string;
    photoUrl?: string | null;
  }>;
  incidentFrequency: Array<{
    label: string;
    value: number;
  }>;
  recentReports: Array<{
    needType?: string;
    severity?: string;
    createdAt?: string;
  }>;
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

export interface CoordinatorMissionSourceReport {
  id: string;
  missionId?: string | null;
  submittedBy?: string | null;
  submittedByName?: string | null;
  zoneId?: string | null;
  needType?: string | null;
  severity?: string | null;
  familiesAffected?: number | null;
  personsAffected?: number | null;
  sourceType?: string | null;
  inputType?: string | null;
  verificationState?: string | null;
  visitType?: string | null;
  householdRef?: string | null;
  confidence?: number | null;
  location?: {
    lat?: number;
    lng?: number;
    address?: string;
    landmark?: string;
  } | null;
  safetySignals?: string[];
  fieldConfidences?: Record<string, number>;
  needIncidents?: Array<Record<string, unknown>>;
  assignmentRequirementProfile?: Record<string, unknown>;
  additionalNotes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CoordinatorVolunteerScoreDimensions {
  skillMatch: number;
  proximity: number;
  languageMatch: number;
  pastSuccess: number;
  emotionalCapacity: number;
  zoneFamiliarity: number;
  availability: number;
  burnoutRisk: number;
}

export interface CoordinatorVolunteerAIBreakdown {
  dimensions: CoordinatorVolunteerScoreDimensions;
  reasoning: string;
}

export interface CoordinatorVolunteerDecisionLogItem {
  date: string;
  missionType: string;
  score: number;
  outcome: string;
  status: string;
}

export interface CoordinatorVolunteerMissionHistoryItem {
  zone: string;
  type: string;
  outcome: string;
  date: string;
}

export interface CoordinatorVolunteerDnaProfile {
  skill: number;
  proximity: number;
  emotional: number;
  language: number;
  success: number;
  availability: number;
}

export interface CoordinatorVolunteerItem {
  id: string;
  name: string;
  initials: string;
  org: string;
  matchPercent: number;
  distance: string;
  distanceKm: number;
  skills: string[];
  burnout: "low" | "medium" | "high";
  missions: number;
  successRate: number;
  color: string;
  availability: string;
  aiBreakdown: CoordinatorVolunteerAIBreakdown;
  decisionLog: CoordinatorVolunteerDecisionLogItem[];
  missionHistory: CoordinatorVolunteerMissionHistoryItem[];
  dnaProfile: CoordinatorVolunteerDnaProfile;
  languages: string[];
  availableNow: boolean;
  activeMissionCount: number;
  hasThisWeekActivity: boolean;
}

export interface CoordinatorVolunteersResponse {
  summary: {
    totalVolunteers: number;
    availableNow: number;
    onMission: number;
    burnoutRisk: number;
  };
  filters: {
    skills: string[];
    languages: string[];
  };
  volunteers: CoordinatorVolunteerItem[];
  total: number;
}

export interface CoordinatorDriftAlertSignal {
  label: string;
  variant: "danger" | "warning" | "info" | "success";
}

export interface CoordinatorDriftAlertSourceReport {
  id: string;
  needType?: string | null;
  severity?: string | null;
  familiesAffected?: number | null;
  personsAffected?: number | null;
  additionalNotes?: string | null;
  createdAt?: string | null;
}

export interface CoordinatorDriftAlert {
  id: string;
  ngoId: string;
  zoneId: string;
  zoneName: string;
  ruleType: "rapid_score_rise" | "threshold_crossing" | "pattern_match" | "silence_high_score";
  severity: "watch" | "high" | "critical";
  status: "active" | "actioned" | "resolved" | "dismissed" | "expired";
  title: string;
  summary: string;
  predictionText?: string | null;
  recommendedAction?: string | null;
  etaToCriticalDays?: number | null;
  needType?: string;
  signals?: CoordinatorDriftAlertSignal[];
  sourceReportIds?: string[];
  sourceReports?: CoordinatorDriftAlertSourceReport[];
  evidence?: Record<string, unknown>;
  linkedMissionId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  triggeredAt?: string | null;
  actionedAt?: string | null;
  resolvedAt?: string | null;
  dismissedAt?: string | null;
  dismissedReason?: string | null;
  expiredAt?: string | null;
}

export interface CoordinatorDriftAlertsResponse {
  alerts: CoordinatorDriftAlert[];
  total: number;
  counts: {
    total: number;
    active: number;
    actioned: number;
    resolved: number;
    dismissed: number;
    expired: number;
    critical: number;
    high: number;
    watch: number;
  };
}

export interface CoordinatorCreateMissionFromAlertResponse {
  alert?: CoordinatorDriftAlert;
  mission?: CoordinatorMissionCreateResponse;
  created: boolean;
  autoAssigned: boolean;
}

export interface VolunteerSkillDetail {
  name: string;
  level: 1 | 2 | 3;
}

export interface VolunteerAvailabilitySlot {
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
}

export interface VolunteerProfileSettings {
  skillDetails?: VolunteerSkillDetail[];
  availabilityWindows?: {
    monFri?: VolunteerAvailabilitySlot;
    satSun?: VolunteerAvailabilitySlot;
  };
  maxMissionsPerWeek?: number;
  travelPreferences?: {
    transportModes?: string[];
  };
  emotionalPreferences?: {
    preferredMissionIntensity?: "light" | "moderate" | "intensive";
  };
  notificationPreferences?: {
    pushNotifications?: boolean;
    emailDigest?: boolean;
    smsAlerts?: boolean;
  };
  accountMeta?: {
    passwordLastChangedAt?: string | null;
    connectedProvider?: string | null;
    connectedEmail?: string | null;
  };
  profileMeta?: {
    city?: string | null;
    zoneLabel?: string | null;
  };
}

export interface VolunteerProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: "volunteer" | "fieldworker" | "coordinator";
  zones: string[];
  profilePhoto?: string | null;
  availability?: string;
  travelRadius?: number;
  skills?: string[];
  additionalLanguages?: string[];
  emotionalCapacity?: number;
  avoidCategories?: string[];
  impactPoints?: number;
  missionsCompleted?: number;
  successRate?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  primaryLanguage?: string;
  volunteerProfileSettings?: VolunteerProfileSettings;
}

export interface VolunteerDashboardHero {
  greeting: string;
  weeklyImpactFamilies: number;
  subtitle: string;
}

export interface VolunteerDashboardMissionCard {
  id: string;
  title: string;
  zoneName: string;
  distanceLabel: string;
  durationLabel: string;
  relativeTime: string;
  status: string;
  locationAddress: string;
}

export interface VolunteerDashboardImpactItem {
  id: string;
  title: string;
  locationLabel: string;
  status: string;
  quote?: string | null;
  needType: string;
  completedAt?: string | null;
}

export interface VolunteerDashboardSidebar {
  missionsPerMonth: number;
  percentileText: string;
  burnoutRisk: string;
  burnoutScore: number;
  burnoutInsight: string;
  dnaProfile: Record<string, number>;
  badges: string[];
}

export interface VolunteerDashboardResponse {
  availability: string;
  hero: VolunteerDashboardHero;
  priorityMission?: VolunteerDashboardMissionCard | null;
  activeMission?: VolunteerDashboardMissionCard | null;
  recentImpactHistory: VolunteerDashboardImpactItem[];
  sidebar: VolunteerDashboardSidebar;
}

export interface VolunteerImpactSummaryCard {
  label: string;
  value: string;
  delta: string;
}

export interface VolunteerImpactTimelinePoint {
  month: string;
  points: number;
  avg: number;
}

export interface VolunteerImpactLedgerItem {
  missionId: string;
  name: string;
  zone: string;
  beforeScore: number;
  afterScore: number;
  deltaScore: number;
  type: "pos" | "neg";
  date: string;
}

export interface VolunteerImpactZoneItem {
  zoneId: string;
  name: string;
  missionCount: number;
  lat: number;
  lng: number;
}

export interface VolunteerImpactWellbeing {
  risk: string;
  score: number;
  activity30d: {
    missions: number;
    avgDurationMinutes: number;
    restDays: number;
  };
  advice: string;
}

export interface VolunteerImpactRank {
  globalRank: number;
  level: number;
  xp: number;
  xpTarget: number;
  title: string;
}

export interface VolunteerImpactShare {
  headline: string;
  missions: number;
  level: number;
  shareText: string;
  shareUrl: string;
}

export interface VolunteerImpactResponse {
  range: string;
  summaryCards: {
    familiesHelped: VolunteerImpactSummaryCard;
    needScoreReduced: VolunteerImpactSummaryCard;
    totalHours: VolunteerImpactSummaryCard;
    impactPoints: VolunteerImpactSummaryCard;
  };
  timeline: VolunteerImpactTimelinePoint[];
  ledger: VolunteerImpactLedgerItem[];
  zones: VolunteerImpactZoneItem[];
  wellbeing: VolunteerImpactWellbeing;
  dna: Record<string, number>;
  badges: string[];
  rank: VolunteerImpactRank;
  share: VolunteerImpactShare;
}

export type VolunteerProfilePatchPayload = Partial<{
  name: string;
  phone: string | null;
  profilePhoto: string | null;
  availability: string;
  travelRadius: number;
  skills: string[];
  additionalLanguages: string[];
  emotionalCapacity: number;
  avoidCategories: string[];
  volunteerProfileSettings: VolunteerProfileSettings;
}>;

export const getCoordinatorDashboard = () => request<CoordinatorDashboardResponse>("/coordinator/dashboard");

export const getCoordinatorInsights = () => request<{ insights: GeminiInsightItem[]; total: number }>("/coordinator/insights");

export const synthesizeCoordinatorInsights = () => request<{ updated: boolean; zonesUpdated: number; reportsAdded: number }>("/coordinator/insights/synthesize", {
  method: "POST",
});

export const getCoordinatorZones = (riskFilter?: string) => {
  const query = riskFilter ? `?risk_filter=${encodeURIComponent(riskFilter)}` : "";
  return request<{ zones: CoordinatorZone[]; total: number }>(`/coordinator/zones${query}`);
};

export const getCoordinatorZoneDetail = (zoneId: string) =>
  request<CoordinatorZoneDetailResponse>(`/coordinator/zones/${zoneId}`);

export const getCoordinatorHeatmap = () => request<CoordinatorHeatmapPoint[]>("/coordinator/zones/heatmap");

export const getCoordinatorTerrainSnapshot = (params?: {
  needType?: string;
  severity?: string;
  confidenceMin?: number;
  sinceHours?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.needType) {
    query.set("need_type", params.needType);
  }
  if (params?.severity) {
    query.set("severity", params.severity);
  }
  if (typeof params?.confidenceMin === "number") {
    query.set("confidence_min", String(params.confidenceMin));
  }
  if (typeof params?.sinceHours === "number") {
    query.set("since_hours", String(params.sinceHours));
  }

  const suffix = query.toString();
  return request<CoordinatorTerrainSnapshotResponse>(`/coordinator/terrain/snapshot${suffix ? `?${suffix}` : ""}`);
};

export const getCoordinatorTerrainNarrative = (zoneId: string, forceRefresh = false) =>
  request<CoordinatorTerrainNarrativeResponse>(`/coordinator/terrain/zones/${zoneId}/narrative${forceRefresh ? "?force_refresh=true" : ""}`);

export const getCoordinatorTerrainSidebar = (zoneId: string, forceRefresh = false) =>
  request<CoordinatorTerrainSidebarResponse>(`/coordinator/terrain/zones/${zoneId}/sidebar${forceRefresh ? "?force_refresh=true" : ""}`);

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

export const assignCoordinatorMission = (missionId: string, volunteerId: string) =>
  request<CoordinatorMissionCreateResponse>(`/coordinator/missions/${missionId}/assign`, {
    method: "PATCH",
    body: JSON.stringify({ volunteerId }),
  });

export const getCoordinatorMissionSourceReports = (missionId: string) =>
  request<{ reports: CoordinatorMissionSourceReport[]; total: number }>(`/coordinator/missions/${missionId}/source-reports`);

export const getCoordinatorVolunteers = (params?: {
  search?: string;
  availability?: "available_now" | "this_week" | "anytime";
  skills?: string[];
  languages?: string[];
  minMatch?: number;
  maxDistanceKm?: number;
  sortBy?: "match" | "distance" | "missions";
}) => {
  const query = new URLSearchParams();
  if (params?.search) {
    query.set("search", params.search);
  }
  if (params?.availability) {
    query.set("availability", params.availability);
  }
  if (params?.skills?.length) {
    query.set("skills", params.skills.join(","));
  }
  if (params?.languages?.length) {
    query.set("languages", params.languages.join(","));
  }
  if (typeof params?.minMatch === "number") {
    query.set("minMatch", String(params.minMatch));
  }
  if (typeof params?.maxDistanceKm === "number") {
    query.set("maxDistanceKm", String(params.maxDistanceKm));
  }
  if (params?.sortBy) {
    query.set("sortBy", params.sortBy);
  }
  const suffix = query.toString();
  return request<CoordinatorVolunteersResponse>(`/coordinator/volunteers${suffix ? `?${suffix}` : ""}`);
};

export const getCoordinatorDriftAlerts = (params?: {
  status?: string;
  severity?: string;
  zoneId?: string;
}) => {
  const query = new URLSearchParams();
  if (params?.status) {
    query.set("status", params.status);
  }
  if (params?.severity) {
    query.set("severity", params.severity);
  }
  if (params?.zoneId) {
    query.set("zoneId", params.zoneId);
  }
  const suffix = query.toString();
  return request<CoordinatorDriftAlertsResponse>(`/coordinator/drift-alerts${suffix ? `?${suffix}` : ""}`);
};

export const evaluateCoordinatorDriftAlerts = (zoneId?: string) =>
  request<{ updated: number; triggered: number }>(`/coordinator/drift-alerts/evaluate${zoneId ? `?zoneId=${encodeURIComponent(zoneId)}` : ""}`, {
    method: "POST",
  });

export const createMissionFromDriftAlert = (alertId: string) =>
  request<CoordinatorCreateMissionFromAlertResponse>(`/coordinator/drift-alerts/${alertId}/create-mission`, {
    method: "POST",
  });

export const dismissCoordinatorDriftAlert = (alertId: string, reason: string) =>
  request<{ alert: CoordinatorDriftAlert }>(`/coordinator/drift-alerts/${alertId}/dismiss`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });

export const getVolunteerMissions = (status?: string) => {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<CoordinatorMissionListResponse>(`/volunteer/missions${query}`);
};

export const getVolunteerDashboard = () => request<VolunteerDashboardResponse>("/volunteer/dashboard");

export const getVolunteerImpact = (range: "month" | "3m" | "6m" | "all") =>
  request<VolunteerImpactResponse>(`/volunteer/impact?range=${encodeURIComponent(range)}`);

export const getVolunteerProfile = () => request<VolunteerProfile>("/auth/me");

export const updateVolunteerProfile = (payload: VolunteerProfilePatchPayload) =>
  request<{ updated: boolean; fields: string[] }>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });