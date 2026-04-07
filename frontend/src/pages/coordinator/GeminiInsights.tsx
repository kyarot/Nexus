import { useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { GeminiInsightCard } from "@/components/coordinator/GeminiInsightCard";
import { GeminiProcessing } from "@/components/coordinator/GeminiProcessing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, RefreshCw, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCoordinatorInsights, synthesizeCoordinatorInsights } from "@/lib/coordinator-api";

const chatMessages = [
  { role: "user", text: "What's the situation in Hebbal North?" },
  { role: "ai", text: "Hebbal North (Zone 4) shows 3 converging signals: school absenteeism up 34%, whisper network volume spiked 58%, and clinic walk-ins rising. This pattern matches the 2022 Koramangala food insecurity signature. Recommend immediate food security intervention." },
];

const promptChips = ["Summarize all zones", "What worked in Hebbal?", "Generate policy brief"];

export default function GeminiInsights() {
  const [chatInput, setChatInput] = useState("");
  const queryClient = useQueryClient();

  const insightsQuery = useQuery({
    queryKey: ["coordinator-insights"],
    queryFn: getCoordinatorInsights,
  });

  const synthesizeMutation = useMutation({
    mutationFn: synthesizeCoordinatorInsights,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["coordinator-insights"] });
    },
  });

  const insights = insightsQuery.data?.insights ?? [];
  const totals = useMemo(() => {
    const reportTotal = insights.reduce((sum, insight) => sum + (insight.reportCount || 0), 0);
    const ngoTotal = insights.reduce((sum, insight) => sum + (insight.sourceNgoCount || 0), 0);
    return { reportTotal, ngoTotal };
  }, [insights]);

  return (
    <div className="flex flex-col h-full">
      <DashboardTopBar breadcrumb="Gemini Insights" />
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold text-foreground">Gemini Insights</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                AI-synthesized intelligence from {totals.reportTotal || 0} reports across {totals.ngoTotal || 1} NGOs
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => synthesizeMutation.mutate()}>
                <Sparkles className="h-4 w-4 mr-1" />Synthesize
              </Button>
              <Button size="sm" variant="ghost" onClick={() => insightsQuery.refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" />Refresh
              </Button>
              <Button size="sm" variant="ghost"><Download className="h-4 w-4 mr-1" />Export All</Button>
            </div>
          </div>

          {insights.map((insight) => (
            <GeminiInsightCard
              key={insight.id}
              variant={insight.severity || "watch"}
              zone={`${insight.zoneName || insight.zoneId || "Zone"}`}
              signals={insight.signals || []}
              description={insight.summary || "No summary available."}
              sourceCount={`Synthesized from ${insight.reportCount || 0} reports · ${insight.sourceNgoCount || 1} NGOs`}
              timestamp={insight.generatedAt ? new Date(insight.generatedAt).toLocaleString() : ""}
              sourceReports={insight.sourceReports || []}
            />
          ))}

          {synthesizeMutation.isPending && (
            <GeminiProcessing text="Synthesizing new reports..." />
          )}

          {/* Synthesis history */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Synthesis History</h3>
            <div className="space-y-2">
              {[
                { date: "Mar 20, 2026", reports: 47, insights: 5, saved: "3.2 hours" },
                { date: "Mar 19, 2026", reports: 38, insights: 4, saved: "2.8 hours" },
                { date: "Mar 18, 2026", reports: 52, insights: 6, saved: "4.1 hours" },
              ].map((h, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
                  <span className="text-muted-foreground">{h.date}</span>
                  <span className="text-foreground font-medium">{h.reports} reports → {h.insights} insights</span>
                  <span className="ml-auto rounded-pill bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">Saved {h.saved}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Chat panel */}
        <div className="hidden lg:flex w-[340px] shrink-0 flex-col border-l bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Ask Gemini about your community</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((m, i) => (
              <div key={i} className={cn("rounded-lg p-3 text-sm", m.role === "user" ? "bg-primary text-white ml-8" : "bg-muted text-foreground mr-8")}>
                {m.text}
              </div>
            ))}
          </div>
          <div className="border-t p-3 space-y-2">
            <div className="flex flex-wrap gap-1">
              {promptChips.map(c => (
                <button key={c} className="rounded-pill border px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary-light transition-colors">{c}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask about zones, trends..." className="rounded-pill text-sm flex-1" />
              <Button size="icon" variant="gradient" className="shrink-0 h-10 w-10 rounded-full"><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
