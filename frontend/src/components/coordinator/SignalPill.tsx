import { cn } from "@/lib/utils";

type SignalVariant = "danger" | "warning" | "info" | "success";

const variants: Record<SignalVariant, string> = {
  danger: "bg-destructive/15 text-destructive",
  warning: "bg-warning/15 text-warning",
  info: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
};

interface SignalPillProps {
  label: string;
  variant?: SignalVariant;
  className?: string;
}

export function SignalPill({ label, variant = "info", className }: SignalPillProps) {
  return (
    <span className={cn("inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold", variants[variant], className)}>
      {label}
    </span>
  );
}
