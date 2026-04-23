import { useEffect, useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { GeminiInsightCard } from "@/components/coordinator/GeminiInsightCard";
import { GeminiProcessing } from "@/components/coordinator/GeminiProcessing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, RefreshCw, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCoordinatorInsights, synthesizeCoordinatorInsights } from "@/lib/coordinator-api";
import { getNotificationStreamUrl, listNotifications, streamGeminiChat, type NotificationItem } from "@/lib/ops-api";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/use-online-status";

const promptChips = ["Summarize all zones", "What worked in Hebbal?", "Generate policy brief"];

type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
  isStreaming?: boolean;
};

export default function GeminiInsights() {
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const queryClient = useQueryClient();
  const token = localStorage.getItem("nexus_access_token");
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const insightsQuery = useQuery({
    queryKey: ["coordinator-insights"],
    queryFn: getCoordinatorInsights,
  });

  const notificationsQuery = useQuery({
    queryKey: ["insight-history", token],
    queryFn: () => listNotifications(false),
    enabled: Boolean(token),
    refetchInterval: 10_000,
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

  useEffect(() => {
    if (!token || !isOnline) return;
    const streamUrl = getNotificationStreamUrl();
    const source = new EventSource(streamUrl);

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        if (payload?.type === "notification_update") {
          notificationsQuery.refetch();
        }
      } catch {
        // Ignore malformed SSE events.
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [notificationsQuery, token, isOnline]);

  const synthesisHistory = useMemo(() => {
    const notifications = notificationsQuery.data?.notifications ?? [];
    return notifications
      .filter((item: NotificationItem) => item.type === "insight_generated")
      .map((item) => {
        const metadata = item.metadata || {};
        const zonesUpdated = Number(metadata.zonesUpdated || 0);
        const reportsAdded = Number(metadata.reportsAdded || 0);
        return {
          id: item.id,
          timestamp: item.timestamp,
          zonesUpdated,
          reportsAdded,
        };
      });
  }, [notificationsQuery.data?.notifications]);

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const updateMessage = (id: string, updater: (current: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((msg) => (msg.id === id ? updater(msg) : msg)));
  };

  const parseSseBlock = (block: string) => {
    const lines = block.split("\n");
    let eventType = "message";
    const dataLines: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      if (!line) continue;
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
        continue;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    return { eventType, data: dataLines.join("\n") };
  };

  const handleSendMessage = async (value?: string) => {
    const query = (value ?? chatInput).trim();
    if (!query || isSending) return;
    if (!token) {
      toast({ title: "Sign in required", description: "Please sign in to use Gemini chat.", variant: "destructive" });
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: query,
    };
    appendMessage(userMessage);
    setChatInput("");

    const assistantId = `ai-${Date.now()}`;
    appendMessage({ id: assistantId, role: "ai", text: "", isStreaming: true });
    setIsSending(true);

    try {
      const response = await streamGeminiChat({ query });
      if (!response.ok || !response.body) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        while (buffer.includes("\n\n")) {
          const splitIndex = buffer.indexOf("\n\n");
          const rawBlock = buffer.slice(0, splitIndex);
          buffer = buffer.slice(splitIndex + 2);
          const { eventType, data } = parseSseBlock(rawBlock);

          if (eventType === "token") {
            updateMessage(assistantId, (current) => ({
              ...current,
              text: `${current.text}${current.text ? " " : ""}${data}`,
            }));
          }

          if (eventType === "done") {
            try {
              const payload = JSON.parse(data || "{}");
              if (payload?.text) {
                updateMessage(assistantId, (current) => ({
                  ...current,
                  text: payload.text,
                  isStreaming: false,
                }));
              }
            } catch {
              updateMessage(assistantId, (current) => ({ ...current, isStreaming: false }));
            }
          }

          if (eventType === "error") {
            updateMessage(assistantId, (current) => ({
              ...current,
              text: data || "Gemini chat failed.",
              isStreaming: false,
            }));
          }
        }
      }
    } catch (error) {
      updateMessage(assistantId, (current) => ({
        ...current,
        text: "Gemini chat failed. Please try again.",
        isStreaming: false,
      }));
    } finally {
      setIsSending(false);
    }
  };

  const handleChipClick = (chip: string) => {
    setChatInput(chip);
    handleSendMessage(chip);
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardTopBar breadcrumb="Gemini Insights" />
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold text-foreground">Gemini Insights</h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                AI-synthesized intelligence from {totals.reportTotal || 0} reports across {totals.ngoTotal || 1} NGOs
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => synthesizeMutation.mutate()}>
                <Sparkles className="h-4 w-4 mr-1" />Synthesize
              </Button>
              <Button size="sm" variant="ghost" onClick={() => insightsQuery.refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" />Refresh
              </Button>
              <Button size="sm" variant="ghost" className="hidden sm:flex"><Download className="h-4 w-4 mr-1" />Export All</Button>
            </div>
          </div>

          {insights.length ? (
            insights.map((insight) => (
              <GeminiInsightCard
                key={insight.id}
                variant={insight.severity || "watch"}
                zone={`${insight.zoneName || insight.zoneId || "Zone"}`}
                zoneId={insight.zoneId || undefined}
                signals={insight.signals || []}
                description={insight.summary || "No summary available."}
                sourceCount={`Synthesized from ${insight.reportCount || 0} reports · ${insight.sourceNgoCount || 1} NGOs`}
                timestamp={insight.generatedAt ? new Date(insight.generatedAt).toLocaleString() : ""}
                hasMission={insight.hasMission}
                sourceReports={insight.sourceReports || []}
              />
            ))
          ) : (
            <div className="rounded-card border border-dashed bg-card p-4 text-xs text-muted-foreground">
              No Gemini insights yet. Run synthesis to populate live insight cards.
            </div>
          )}

          {synthesizeMutation.isPending && (
            <GeminiProcessing text="Synthesizing new reports..." />
          )}

          {/* Synthesis history */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Synthesis History</h3>
            <div className="space-y-2">
              {synthesisHistory.length ? (
                synthesisHistory.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
                    <span className="text-muted-foreground">
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "Recently"}
                    </span>
                    <span className="text-foreground font-medium">
                      {entry.reportsAdded} reports → {entry.zonesUpdated} insights
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed bg-card p-3 text-xs text-muted-foreground">
                  No synthesis history yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Chat panel */}
        <div className="fixed inset-x-0 bottom-0 lg:relative lg:inset-auto lg:flex w-full lg:w-[340px] shrink-0 flex-col border-l bg-card z-50 lg:z-auto">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Ask Gemini about your community</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[40vh] lg:max-h-none">
            {messages.length ? (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-lg p-3 text-sm",
                    m.role === "user" ? "bg-primary text-white ml-8" : "bg-muted text-foreground mr-8",
                  )}
                >
                  {m.text || (m.isStreaming ? "Generating response..." : "")}
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                No Gemini chat messages yet. Ask about zones, missions, insights, reports, or heatmaps.
              </div>
            )}
          </div>
          <div className="border-t p-3 space-y-2">
            <div className="flex flex-wrap gap-1">
              {promptChips.map(c => (
                <button
                  key={c}
                  onClick={() => handleChipClick(c)}
                  className="rounded-pill border px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary-light transition-colors"
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Ask about zones, trends..."
                className="rounded-pill text-sm flex-1"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSendMessage();
                  }
                }}
              />
              <Button
                size="icon"
                variant="gradient"
                className="shrink-0 h-10 w-10 rounded-full"
                onClick={() => handleSendMessage()}
                disabled={isSending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
