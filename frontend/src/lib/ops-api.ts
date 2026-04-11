const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

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

export interface WarehouseItem {
  id: string;
  ngoId: string;
  zoneId: string;
  name: string;
  address?: string;
  managerName?: string;
  phone?: string;
  lat?: number;
  lng?: number;
  active: boolean;
}

export interface InventoryItem {
  id: string;
  ngoId: string;
  warehouseId: string;
  zoneId: string;
  name: string;
  category: string;
  unit: string;
  availableQty: number;
  thresholdQty: number;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  missionId?: string | null;
  requestId?: string | null;
  timestamp?: string | null;
  read: boolean;
  metadata?: Record<string, unknown>;
}

export interface EmpathyBriefPayload {
  missionContext: {
    zone?: string;
    status?: string;
    language?: string;
    triggerSummary?: string;
  };
  trust: number;
  pulse: number[];
  zoneSafety: {
    score?: number;
    level?: string;
    timeline?: Array<{ date?: string; note?: string; status?: string }>;
    visitTip?: string;
    specificNotes?: string[];
  };
  sayFirst: string;
  sayTags: string[];
  avoid: Array<{ title?: string; note?: string }>;
  decisionTree: Array<{ id?: string; if?: string; response?: string }>;
}

export interface VolunteerEmpathyResponse {
  mission: Record<string, unknown>;
  empathy: EmpathyBriefPayload;
  resources: Array<Record<string, unknown>>;
  pendingResourceRequests: Array<Record<string, unknown>>;
}

export const listWarehouses = () => request<{ warehouses: WarehouseItem[]; total: number }>("/coordinator/warehouses");

export const listInventoryItems = (warehouseId?: string) =>
  request<{ items: InventoryItem[]; total: number }>(`/coordinator/inventory/items${warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : ""}`);

export const createInventoryItem = (payload: {
  warehouseId: string;
  zoneId: string;
  name: string;
  category: string;
  unit: string;
  availableQty: number;
  thresholdQty: number;
}) =>
  request<InventoryItem>("/coordinator/inventory/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const patchInventoryItem = (
  itemId: string,
  payload: Partial<Pick<InventoryItem, "category" | "unit" | "availableQty" | "thresholdQty">>
) =>
  request<InventoryItem>(`/coordinator/inventory/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const listCoordinatorResourceRequests = (status?: string) =>
  request<{ requests: Array<Record<string, unknown>>; total: number }>(`/coordinator/resource-requests${status ? `?status=${encodeURIComponent(status)}` : ""}`);

export const decideCoordinatorResourceRequest = (requestId: string, decision: "approved" | "rejected", note = "") =>
  request<{ updated: boolean; decision: string }>(`/coordinator/resource-requests/${requestId}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision, note }),
  });

export const getVolunteerEmpathyBrief = (missionId?: string, regenerate = false) =>
  request<VolunteerEmpathyResponse>(
    `/volunteer/empathy-brief${missionId || regenerate ? `?${new URLSearchParams({ ...(missionId ? { missionId } : {}), ...(regenerate ? { regenerate: "true" } : {}) }).toString()}` : ""}`
  );

export const claimMissionResources = (missionId: string) =>
  request<{ claimed: boolean; itemsUpdated: number }>(`/volunteer/missions/${missionId}/claim-resources`, {
    method: "POST",
  });

export const requestExtraMissionResources = (
  missionId: string,
  payload: {
    warehouseId: string;
    reason: string;
    items: Array<{ itemId: string; name: string; requestedQty: number; unit: string }>;
  }
) =>
  request<{ created: boolean; requestId: string }>(`/volunteer/missions/${missionId}/resource-requests`, {
    method: "POST",
    body: JSON.stringify({ missionId, ...payload }),
  });

export const listNotifications = (unreadOnly = false) =>
  request<{ notifications: NotificationItem[]; unread: number; total: number }>(`/notifications${unreadOnly ? "?unreadOnly=true" : ""}`);

export const markNotificationRead = (id: string) =>
  request<{ updated: boolean }>(`/notifications/${id}/read`, { method: "PATCH" });

export const markAllNotificationsRead = () =>
  request<{ updated: number }>("/notifications/read-all", { method: "POST" });

export const getNotificationStreamUrl = () => {
  const token = getAuthToken();
  return `${apiBaseUrl}/notifications/stream?token=${encodeURIComponent(token)}`;
};
