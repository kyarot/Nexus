import type {
  CoordinatorMission,
  CoordinatorTerrainPoint,
  CoordinatorTerrainZone,
  CoordinatorVolunteerItem,
  CoordinatorZone,
} from "@/lib/coordinator-api";
import type { ElementType } from "react";

export type CopilotVoiceState = "idle" | "listening" | "thinking" | "speaking";

export type CopilotUiBlock =
  | {
      component: "gemini_insight_card";
      props: {
        variant?: "critical" | "high" | "watch" | "resolved";
        zone: string;
        signals?: Array<{ label: string; variant: "danger" | "warning" | "info" | "success" }>;
        description: string;
        sourceCount?: string;
        timestamp?: string;
        sourceReports?: Array<{
          id: string;
          needType?: string | null;
          severity?: string | null;
          familiesAffected?: number | null;
          personsAffected?: number | null;
          additionalNotes?: string | null;
          createdAt?: string | null;
        }>;
      };
    }
  | {
      component: "stat_metric_card";
      props: {
        label: string;
        value: string | number;
        delta?: string;
        deltaDirection?: "up" | "down";
        accent?: "indigo" | "amber" | "green" | "purple" | "red";
      };
    }
  | {
      component: "empty_state";
      props: {
        heading: string;
        subtext?: string;
        actionLabel?: string;
        icon?: ElementType;
      };
    }
  | {
      component: "community_pulse_donut";
      props: {
        score: number;
        label?: string;
        trend?: "up" | "down";
      };
    }
  | {
      component: "need_terrain_map";
      props: {
        zones?: CoordinatorTerrainZone[] | CoordinatorZone[];
        heatmapPoints?: CoordinatorTerrainPoint[];
        opacity?: number;
        showLegend?: boolean;
        className?: string;
      };
    }
  | {
      component: "missions_live_map";
      props: {
        missions: CoordinatorMission[];
        zones: CoordinatorZone[];
        className?: string;
      };
    }
  | {
      component: "volunteer_avatar_card";
      props: CoordinatorVolunteerItem & {
        compact?: boolean;
        className?: string;
      };
    }
  | {
      component: "action_card";
      props: {
        actionId: string;
        title: string;
        summary: string;
        impact?: string;
        confirmLabel?: string;
        cancelLabel?: string;
        severity?: "low" | "medium" | "high";
      };
    }
;

export interface CopilotQueryResponse {
  session_id: string;
  request_id?: string;
  text: string;
  ui_blocks: CopilotUiBlock[];
  suggestions: string[];
  degraded?: boolean;
}

export interface CopilotVoiceResponse extends CopilotQueryResponse {
  transcript: string;
  audio_base64: string;
  audio_mime_type: string;
  voice_name: string;
}
