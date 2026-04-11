export type CopilotVoiceState = "idle" | "listening" | "thinking" | "speaking";

export type CopilotScenario = {
  id: string;
  prompt: string;
  analystTitle: string;
  analystSubtitle: string;
  narrative: string;
  confidence: number;
  chartBars: number[];
  operations: Array<{
    id: string;
    title: string;
    status: string;
    level: "normal" | "high" | "critical";
    path: string;
  }>;
  volunteers: Array<{
    name: string;
    role: string;
    score: number;
  }>;
  chips: string[];
};
