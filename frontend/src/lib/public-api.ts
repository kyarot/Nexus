const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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

export interface PublicReportSubmitPayload {
  phoneNumber: string;
  problemText: string;
  category: string;
  urgencyLevel: string;
  language?: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
    landmark?: string;
  };
}

export interface PublicReportSubmitResponse {
  reportId: string;
  referenceNumber: string;
  trackingToken: string;
  ngo: {
    id: string;
    name: string;
  };
  zone: {
    id: string;
    name: string;
  };
  acceptedAt: string;
}

export interface PublicTrackTimelineEvent {
  event: string;
  description: string;
  timestamp?: string | null;
  state: "completed" | "active" | "pending";
}

export interface PublicTrackResponse {
  referenceNumber: string;
  ngo: {
    id: string;
    name: string;
  };
  report: {
    id: string;
    category: string;
    urgency: string;
    description: string;
    zoneId: string;
    submittedAt?: string | null;
    status: string;
  };
  mission: {
    id?: string | null;
    title?: string | null;
    status: string;
    progress: number;
    statusText?: string | null;
    familiesHelped: number;
    trackingAvailable: boolean;
    tracking?: {
      status?: string | null;
      lastUpdate?: string | null;
      location?: {
        lat?: number;
        lng?: number;
        address?: string;
        landmark?: string;
      } | null;
    };
  };
  timeline: PublicTrackTimelineEvent[];
  verifiedWithPhone: boolean;
  requires: {
    referenceNumber: boolean;
    phoneNumber: boolean;
  };
}

export interface PublicFeedbackSubmitPayload {
  referenceNumber: string;
  phoneNumber: string;
  message: string;
}

export interface PublicFeedbackSubmitResponse {
  feedbackId: string;
  accepted: boolean;
  sentiment: "positive" | "neutral" | "negative";
  retentionWeeks: number;
}

export const submitCommunityVoiceReport = (payload: PublicReportSubmitPayload) =>
  request<PublicReportSubmitResponse>("/public/community-voice/reports", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const trackCommunityVoiceReport = (referenceNumber: string, phoneNumber: string) =>
  request<PublicTrackResponse>("/public/community-voice/track", {
    method: "POST",
    body: JSON.stringify({ referenceNumber, phoneNumber }),
  });

export const submitCommunityVoiceFeedback = (payload: PublicFeedbackSubmitPayload) =>
  request<PublicFeedbackSubmitResponse>("/public/community-voice/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
