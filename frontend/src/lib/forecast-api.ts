import { API_BASE_URL } from "./config";

const apiBaseUrl = API_BASE_URL;

const getAuthToken = () => localStorage.getItem("nexus_access_token") || "";

const buildHeaders = (json = false): HeadersInit => {
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

export interface CommunityForecastChartPoint {
  weekLabel: string;
  weekStart: string;
  score: number;
  confidence: number;
  isForecast: boolean;
}

export interface CommunityForecastSummary {
  generatedAt: string;
  modelVersion: string;
  windowWeeks: number;
  mainChart: {
    points: CommunityForecastChartPoint[];
    peakWeek: string;
    peakScore: number;
    peakConfidence: number;
    driftRatio: number;
  };
  performance: {
    accuracyScore: number;
    trendBars: number[];
    note: string;
  };
  riskAssessmentRows: Array<{
    zoneId: string;
    zone: string;
    atRisk: number;
    need: string;
    riskLevel: string;
  }>;
  telemetry: {
    qualityScore: number;
    dataFreshnessMinutes: number;
    lastComputeDurationMs: number;
    uptimePercent: number;
    modelVersion: string;
    calibrationVersion: string;
  };
  overview: {
    totalZones: number;
    highRiskZones: number;
    criticalZones: number;
    improvingZones: number;
  };
}

export interface CommunityForecastZoneCard {
  zoneId: string;
  zone: string;
  peakLabel: string;
  color: string;
  trend: number[];
  status: string;
  badgeTone: string;
  confidence: number;
  predictedPeakScore: number;
  riskLevel: string;
  recommendedAction: string;
  dominantNeed: string;
  needsAtRisk: number;
  dataQualityFlags: string[];
}

export interface CommunityForecastZonesResponse {
  zones: CommunityForecastZoneCard[];
  total: number;
}

export interface CommunityForecastZoneDetail {
  zone: CommunityForecastZoneCard;
  detail: {
    zoneId: string;
    zone: string;
    currentScore: number;
    trendDirection: string;
    driftRatio: number;
    velocity: number;
    acceleration: number;
    seasonalLabel: string;
    seasonalScore: number;
    missionRelief: number;
    completedMissionsRecent: number;
    signalPressure: number;
    signalPressureDelta: number;
    predictions: Array<{
      weekLabel: string;
      weekStart: string;
      score: number;
      confidence: number;
      horizon: number;
      direction: string;
      targetWeekStart: string;
    }>;
    dominantNeed: string;
    recommendedAction: string;
    dataQualityFlags: string[];
  };
}

export interface CommunityForecastSettings {
  ngoId: string;
  threshold: number;
  minConfidence: number;
  lookbackWeeks: number;
  seasonalEnabled: boolean;
  notificationMethods: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  updatedAt?: string;
}

export interface CommunityForecastBacktesting {
  accuracyScore: number;
  mae: number;
  rmse: number;
  directionalAccuracy: number;
  within5: number;
  totalEvaluated: number;
  series: Array<{
    label: string;
    accuracy: number;
    mae: number;
  }>;
  zoneLeaderboard: Array<{
    zoneId: string;
    zone: string;
    mae: number;
    accuracy: number;
    samples: number;
  }>;
}

export interface CommunityForecastRecomputeResult {
  updated: boolean;
  runId: string;
  generatedAt: string;
  zonesUpdated: number;
  qualityScore: number;
}

export interface CommunityForecastCalibrationResult {
  updated: boolean;
  generatedAt: string;
  calibrationVersion: string;
  zoneBiasCount: number;
  sampleCount: number;
}

export const getCommunityForecastSummary = (forceRefresh = false) =>
  request<CommunityForecastSummary>(`/coordinator/forecast/summary${forceRefresh ? "?force_refresh=true" : ""}`);

export const getCommunityForecastZones = (forceRefresh = false, limit = 12) => {
  const query = new URLSearchParams();
  if (forceRefresh) {
    query.set("force_refresh", "true");
  }
  query.set("limit", String(limit));
  return request<CommunityForecastZonesResponse>(`/coordinator/forecast/zones?${query.toString()}`);
};

export const getCommunityForecastZoneDetail = (zoneId: string, forceRefresh = false) =>
  request<CommunityForecastZoneDetail>(`/coordinator/forecast/zones/${encodeURIComponent(zoneId)}${forceRefresh ? "?force_refresh=true" : ""}`);

export const getCommunityForecastBacktesting = (windowWeeks = 12) =>
  request<CommunityForecastBacktesting>(`/coordinator/forecast/backtesting/dashboard?window_weeks=${encodeURIComponent(String(windowWeeks))}`);

export const getCommunityForecastSettings = () =>
  request<CommunityForecastSettings>("/coordinator/forecast/settings");

export const patchCommunityForecastSettings = (payload: Partial<CommunityForecastSettings>) =>
  request<CommunityForecastSettings>("/coordinator/forecast/settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const recomputeCommunityForecast = () =>
  request<CommunityForecastRecomputeResult>("/coordinator/forecast/recompute", {
    method: "POST",
  });

export const calibrateCommunityForecastMonthly = () =>
  request<CommunityForecastCalibrationResult>("/coordinator/forecast/calibration/monthly", {
    method: "POST",
  });

export const getCommunityForecastStreamUrl = () => {
  const token = getAuthToken();
  return `${apiBaseUrl}/coordinator/forecast/stream?token=${encodeURIComponent(token)}`;
};
