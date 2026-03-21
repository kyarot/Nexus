import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface GeminiProcessingProps {
  text?: string;
  className?: string;
}

export function GeminiProcessing({ text = "Analysing...", className }: GeminiProcessingProps) {
  return (
    <div className={cn("flex items-center gap-3 rounded-card border bg-card p-5 shadow-card", className)}>
      <Sparkles className="h-5 w-5 animate-spin text-primary" />
      <div>
        <p className="text-sm font-medium text-foreground">{text}</p>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-1.5 w-16 animate-pulse rounded-full bg-primary/20" style={{ animationDelay: `${i * 200}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
