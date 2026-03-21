import { Cloud, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface OfflineSyncBannerProps {
  pendingCount?: number;
  synced?: boolean;
  className?: string;
}

export function OfflineSyncBanner({ pendingCount = 0, synced = false, className }: OfflineSyncBannerProps) {
  if (synced) {
    return (
      <div className={cn("flex items-center justify-center gap-2 bg-success/15 px-4 py-2 text-xs font-medium text-success", className)}>
        <Cloud className="h-3.5 w-3.5" /> All synced ✓
      </div>
    );
  }
  return (
    <div className={cn("flex items-center justify-center gap-2 bg-warning/15 px-4 py-2 text-xs font-medium text-warning", className)}>
      <CloudOff className="h-3.5 w-3.5" /> {pendingCount} reports queued — will sync when online
    </div>
  );
}
