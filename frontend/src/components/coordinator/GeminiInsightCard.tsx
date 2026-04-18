import { Sparkles, Share2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignalPill } from "../coordinator/SignalPill";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { createCoordinatorMission } from "@/lib/coordinator-api";

type InsightVariant = "critical" | "high" | "watch" | "resolved";

const variantStyles: Record<InsightVariant, { border: string; badge: string; badgeText: string }> = {
  critical: { border: "border-l-destructive", badge: "bg-destructive/15 text-destructive", badgeText: "Critical" },
  high: { border: "border-l-warning", badge: "bg-warning/15 text-warning", badgeText: "High" },
  watch: { border: "border-l-primary", badge: "bg-primary/15 text-primary", badgeText: "Watch" },
  resolved: { border: "border-l-success", badge: "bg-success/15 text-success", badgeText: "Resolved" },
};

interface Signal {
  label: string;
  variant: "danger" | "warning" | "info" | "success";
}

interface GeminiInsightCardProps {
  variant?: InsightVariant;
  zone: string;
  zoneId?: string;
  signals?: Signal[];
  description: string;
  sourceCount?: string;
  timestamp?: string;
  hasMission?: boolean;
  className?: string;
  sourceReports?: Array<{
    id: string;
    needType?: string | null;
    severity?: string | null;
    familiesAffected?: number | null;
    personsAffected?: number | null;
    additionalNotes?: string | null;
    createdAt?: string | null;
  }>;
}

export function GeminiInsightCard({
  variant = "watch",
  zone,
  zoneId,
  signals,
  description,
  sourceCount,
  timestamp,
  hasMission,
  className,
  sourceReports,
}: GeminiInsightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [missionCreated, setMissionCreated] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const v = variantStyles[variant];
  const showActions = !hasMission && !missionCreated && Boolean(zoneId);

  const resolveNeedType = () => {
    const needTypes = (sourceReports || [])
      .map((report) => String(report.needType || "").trim().toLowerCase())
      .filter(Boolean);
    if (needTypes.length) {
      const counts = needTypes.reduce<Record<string, number>>((acc, item) => {
        acc[item] = (acc[item] || 0) + 1;
        return acc;
      }, {});
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "general";
    }

    const signalText = (signals || []).map((signal) => signal.label.toLowerCase()).join(" ");
    const knownNeeds = ["food", "education", "health", "substance", "shelter", "safety"];
    const matched = knownNeeds.find((need) => signalText.includes(need));
    return matched || "general";
  };

  const resolvePriority = () => {
    if (variant === "critical") return "critical";
    if (variant === "high") return "high";
    if (variant === "resolved") return "low";
    return "medium";
  };

  const formatNeedTitle = (needType: string) => {
    if (!needType || needType === "general") return "Community support";
    return `${needType[0].toUpperCase()}${needType.slice(1)} response`;
  };

  const handleCreateMission = async () => {
    if (!zoneId) {
      toast({ title: "Missing zone", description: "Zone data is required to create a mission.", variant: "destructive" });
      return;
    }

    const needType = resolveNeedType();
    const missionTitle = `${formatNeedTitle(needType)} in ${zone}`;
    const missionDescription = description?.trim() || `Auto-generated mission for ${zone}.`;

    setIsCreating(true);
    try {
      const result = await createCoordinatorMission({
        title: missionTitle,
        description: missionDescription,
        zoneId,
        needType,
        targetAudience: "volunteer",
        priority: resolvePriority(),
        allowAutoAssign: true,
        sourceReportIds: (sourceReports || []).map((report) => report.id),
      });

      const assigned = Boolean(result?.mission?.assignedTo);
      setMissionCreated(true);
      toast({
        title: assigned ? "Mission created & assigned" : "Mission created",
        description: assigned ? "A volunteer has been auto-assigned." : "Awaiting volunteer assignment.",
      });
      await queryClient.invalidateQueries({ queryKey: ["coordinator-insights"] });
      await queryClient.invalidateQueries({ queryKey: ["coordinator-dashboard"] });
    } catch (error) {
      toast({
        title: "Mission creation failed",
        description: error instanceof Error ? error.message : "Unable to create a mission right now.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleShare = async () => {
    const signalText = signals?.length ? `Signals: ${signals.map((signal) => signal.label).join(", ")}` : "";
    const shareText = [
      `Zone: ${zone}`,
      `Severity: ${v.badgeText}`,
      `Summary: ${description}`,
      signalText,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast({ title: "Insight copied", description: "Insight details copied to clipboard." });
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      toast({
        title: "Copy failed",
        description: "Clipboard access was blocked. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={cn("rounded-card border border-l-4 bg-card p-5 shadow-card", v.border, className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{zone}</span>
          <span className={cn("rounded-pill px-2 py-0.5 text-[11px] font-semibold", v.badge)}>{v.badgeText}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {sourceCount && <span>{sourceCount}</span>}
          {timestamp && <span>· {timestamp}</span>}
        </div>
      </div>
      {signals && signals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {signals.map((s, i) => <SignalPill key={i} label={s.label} variant={s.variant} />)}
        </div>
      )}
      <p className="mt-3 text-sm leading-relaxed text-foreground">{description}</p>
      <button onClick={() => setExpanded(!expanded)} className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        View source reports
      </button>
      {expanded && (
        <div className="mt-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-2">
          {sourceReports?.length ? (
            sourceReports.map((report) => (
              <div key={report.id} className="rounded-md bg-card p-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{report.needType || "Report"}</span>
                  <span className="text-[10px] uppercase">{report.severity || "unknown"}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">Families: {report.familiesAffected ?? 0} • Persons: {report.personsAffected ?? 0}</div>
                {report.additionalNotes && <div className="text-[11px] text-muted-foreground">{report.additionalNotes}</div>}
              </div>
            ))
          ) : (
            <div className="text-[11px] text-muted-foreground">No source reports available.</div>
          )}
        </div>
      )}
      <div className="mt-4 flex items-center gap-2">
        {showActions && (
          <Button size="sm" variant="gradient" onClick={handleCreateMission} disabled={isCreating}>
            {isCreating ? "Generating mission..." : "Generate Mission & Assign Volunteers →"}
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto h-8 w-8"
          onClick={handleShare}
          aria-label="Copy insight details"
          title={copied ? "Copied" : "Copy insight details"}
        >
          <Share2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
