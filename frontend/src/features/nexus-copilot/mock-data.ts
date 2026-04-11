import type { CopilotScenario } from "./types";

export const COPILOT_SCENARIOS: CopilotScenario[] = [
  {
    id: "volunteer-surge",
    prompt: "Analyze today's volunteer surge in Hebbal.",
    analystTitle: "Volunteer Velocity Signal",
    analystSubtitle: "Hebbal sector correlation",
    narrative:
      "I've identified a 42% surge in volunteer arrivals at Hebbal North node. This correlates with the emergency shelter expansion project that started today. Recommend dispatching a logistics coordinator to absorb the spike and avoid idle allocation.",
    confidence: 94,
    chartBars: [36, 48, 44, 63, 78, 70, 58],
    operations: [
      { id: "reports", title: "Reports", status: "4 unprocessed", level: "normal", path: "/dashboard/impact" },
      { id: "missions", title: "Active Missions", status: "2 in progress", level: "normal", path: "/dashboard/missions" },
      { id: "alerts", title: "Urgent Alerts", status: "1 critical", level: "critical", path: "/dashboard/alerts" },
    ],
    volunteers: [
      { name: "Arjun Mehta", role: "Logistics Lead", score: 4.9 },
      { name: "Sarah Jenkins", role: "First Responder", score: 5.0 },
    ],
    chips: ["Summarize alerts", "Dispatch resources", "Generate brief"],
  },
  {
    id: "today-report",
    prompt: "Show today's report and top interventions.",
    analystTitle: "Daily Report Synthesis",
    analystSubtitle: "Cross-zone operational snapshot",
    narrative:
      "Today's reports show food kit pressure in East corridors and medicine delays in Zone 3. Mission throughput can improve by reallocating three volunteers before 17:00. Priority order: medicine backlog, food queue normalization, and shelter check-in support.",
    confidence: 91,
    chartBars: [34, 46, 52, 61, 69, 74, 66],
    operations: [
      { id: "reports", title: "Reports", status: "12 reviewed", level: "normal", path: "/dashboard/impact" },
      { id: "missions", title: "Active Missions", status: "5 in progress", level: "high", path: "/dashboard/missions" },
      { id: "alerts", title: "Urgent Alerts", status: "2 high", level: "high", path: "/dashboard/alerts" },
    ],
    volunteers: [
      { name: "Priya Raman", role: "Comms Coordinator", score: 4.8 },
      { name: "David Kim", role: "Supply Runner", score: 4.7 },
    ],
    chips: ["Compare yesterday", "Notify field team", "Open impact reports"],
  },
  {
    id: "dispatch-plan",
    prompt: "Optimize mission dispatch for next 2 hours.",
    analystTitle: "Mission Dispatch Optimizer",
    analystSubtitle: "2-hour resource forecast",
    narrative:
      "Rebalance one medical response unit from South Line to Hebbal node and launch staggered volunteer waves every 25 minutes. This lowers forecasted response lag by 18% while preserving coverage in two adjacent sectors.",
    confidence: 89,
    chartBars: [30, 39, 49, 61, 72, 78, 71],
    operations: [
      { id: "reports", title: "Reports", status: "6 pending", level: "normal", path: "/dashboard/impact" },
      { id: "missions", title: "Active Missions", status: "7 in progress", level: "high", path: "/dashboard/missions" },
      { id: "alerts", title: "Urgent Alerts", status: "0 critical", level: "normal", path: "/dashboard/alerts" },
    ],
    volunteers: [
      { name: "Leah Thomas", role: "Medical Support", score: 4.9 },
      { name: "Ravi Nair", role: "Transport Ops", score: 4.8 },
    ],
    chips: ["Approve dispatch", "Share plan", "Open missions"],
  },
  {
    id: "alert-escalation",
    prompt: "Escalate urgent alerts and propose mitigation.",
    analystTitle: "Alert Escalation Matrix",
    analystSubtitle: "Critical incident triage",
    narrative:
      "One critical alert in Hebbal North and two high alerts in East sector require immediate escalation. Mitigation: dispatch nearest logistics volunteer, send advisory push to field workers, and trigger NGO coordination bridge for supplies.",
    confidence: 93,
    chartBars: [28, 33, 51, 64, 79, 76, 68],
    operations: [
      { id: "reports", title: "Reports", status: "3 unprocessed", level: "normal", path: "/dashboard/impact" },
      { id: "missions", title: "Active Missions", status: "3 in progress", level: "high", path: "/dashboard/missions" },
      { id: "alerts", title: "Urgent Alerts", status: "3 escalated", level: "critical", path: "/dashboard/alerts" },
    ],
    volunteers: [
      { name: "Neha Patel", role: "Rapid Coordinator", score: 4.9 },
      { name: "Omar Khan", role: "Field Responder", score: 4.8 },
    ],
    chips: ["Escalate now", "Draft incident brief", "Open alerts"],
  },
  {
    id: "priority-plan",
    prompt: "What should I prioritize in the next 2 hours?",
    analystTitle: "2-Hour Priority Brief",
    analystSubtitle: "Coordinator execution order",
    narrative:
      "Priority one: clear medicine queue in Zone 3. Priority two: route surplus volunteers from Hebbal to East corridor food distribution. Priority three: close unresolved alerts with command acknowledgements.",
    confidence: 90,
    chartBars: [26, 38, 45, 57, 68, 73, 70],
    operations: [
      { id: "reports", title: "Reports", status: "9 analyzed", level: "normal", path: "/dashboard/impact" },
      { id: "missions", title: "Active Missions", status: "4 reprioritized", level: "high", path: "/dashboard/missions" },
      { id: "alerts", title: "Urgent Alerts", status: "1 awaiting closure", level: "high", path: "/dashboard/alerts" },
    ],
    volunteers: [
      { name: "Maya Singh", role: "Ops Planner", score: 4.9 },
      { name: "Joel Martin", role: "Distribution Lead", score: 4.7 },
    ],
    chips: ["Start with medicine", "Create summary", "Open dashboard reports"],
  },
];
