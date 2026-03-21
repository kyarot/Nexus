import { Search, Bell, Menu } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationPanel } from "./NotificationPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DashboardTopBarProps {
  breadcrumb?: string;
  subtext?: string;
  onMenuToggle?: () => void;
  className?: string;
  rightElement?: React.ReactNode;
}

export function DashboardTopBar({ breadcrumb = "Dashboard", subtext, onMenuToggle, className, rightElement }: DashboardTopBarProps) {
  return (
    <div className={cn("border-b bg-card", className)}>
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onMenuToggle} className="lg:hidden text-muted-foreground hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">{breadcrumb}</h1>
        </div>
        <div className="flex items-center gap-3">
          {rightElement}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 w-60 rounded-pill pl-9 text-sm" placeholder="Search zones, volunteers..." />
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <button className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer outline-none">
                <Bell className="h-5 w-5" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0 rounded-xl" align="end" alignOffset={-8}>
              <NotificationPanel />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {subtext && (
        <div className="border-t px-6 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          {subtext}
        </div>
      )}
    </div>
  );
}
