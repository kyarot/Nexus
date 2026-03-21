import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ElementType;
  heading: string;
  subtext?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, heading, subtext, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{heading}</h3>
      {subtext && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{subtext}</p>}
      {actionLabel && <Button className="mt-4" variant="gradient" onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
}
