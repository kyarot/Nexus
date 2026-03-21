import { cn } from "@/lib/utils";
import { Clock, Send, Loader, CheckCircle2, XCircle } from "lucide-react";

type MissionStatus = "queued" | "dispatched" | "in_progress" | "completed" | "failed";

const config: Record<MissionStatus, { icon: React.ElementType; style: string; label: string }> = {
  queued: { icon: Clock, style: "bg-muted text-muted-foreground", label: "Queued" },
  dispatched: { icon: Send, style: "bg-primary/15 text-primary animate-pulse", label: "Dispatched" },
  in_progress: { icon: Loader, style: "bg-warning/15 text-warning", label: "In Progress" },
  completed: { icon: CheckCircle2, style: "bg-success/15 text-success", label: "Completed" },
  failed: { icon: XCircle, style: "bg-destructive/15 text-destructive", label: "Failed" },
};

interface MissionStatusChipProps {
  status: MissionStatus;
  className?: string;
}

export function MissionStatusChip({ status, className }: MissionStatusChipProps) {
  const { icon: Icon, style, label } = config[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-semibold", style, className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
