import { cn } from "@/lib/utils";
import { NavLink, useNavigate } from "react-router-dom";
import { Hexagon, LayoutDashboard, BarChart3, Map, AlertTriangle, Users, Target, Sparkles, TrendingUp, Handshake, FileText, BookOpen, Shield, Building2, Plug, UserCog, LogOut, ChevronDown, Package } from "lucide-react";

interface NavItem {
  label: string;
  icon?: React.ElementType;
  path: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const coordinatorNav: NavSection[] = [
  { title: "OVERVIEW", items: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  ]},
  { title: "OPERATIONS", items: [
    { label: "Need Terrain Map", icon: Map, path: "/dashboard/terrain" },
    { label: "Alerts Feed", icon: AlertTriangle, path: "/dashboard/alerts" },
    { label: "Volunteers", icon: Users, path: "/dashboard/volunteers" },
    { label: "Missions", icon: Target, path: "/dashboard/missions" },
    { label: "Resources", icon: Package, path: "/dashboard/resources" },
  ]},
  { title: "INTELLIGENCE", items: [
    { label: "Gemini Insights", path: "/dashboard/insights" },
    { label: "Forecast", icon: TrendingUp, path: "/dashboard/forecast" },
    { label: "Community Echo", icon: Handshake, path: "/dashboard/echo" },
  ]},
  { title: "REPORTS", items: [
    { label: "Impact Reports", icon: FileText, path: "/dashboard/impact" },
    { label: "Living Constitution", icon: BookOpen, path: "/dashboard/constitution" },
    { label: "Trust Fabric", icon: Shield, path: "/dashboard/trust" },
  ]},
  { title: "SETTINGS", items: [
    { label: "Organization", icon: Building2, path: "/dashboard/organisation" },
    { label: "Integrations", icon: Plug, path: "/dashboard/integrations" },
  ]},
];

const volunteerNav: NavSection[] = [
  { title: "MENU", items: [
    { label: "My Dashboard", icon: LayoutDashboard, path: "/volunteer" },
    { label: "My Missions", icon: Target, path: "/volunteer/missions" },
    { label: "My Profile", icon: UserCog, path: "/volunteer/profile" },
    { label: "My Impact", icon: BarChart3, path: "/volunteer/impact" },
    { label: "Empathy Engine", icon: Sparkles, path: "/volunteer/empathy" },
  ]},
];

interface DashboardSidebarProps {
  role?: "coordinator" | "volunteer";
  userName?: string;
  orgName?: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function DashboardSidebar({ role = "coordinator", userName = "Sarah Coordinator", orgName = "Bengaluru NGO", collapsed, onToggle }: DashboardSidebarProps) {
  const nav = role === "coordinator" ? coordinatorNav : volunteerNav;
  const navigate = useNavigate();

  return (
    <aside className={cn("flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 shrink-0", collapsed ? "w-[60px]" : "w-sidebar-w")}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5 font-['Plus_Jakarta_Sans']">
        <img src="/logo.png" alt="NEXUS Logo" className="h-7 w-7 rounded-sm shrink-0" />
        {!collapsed && <span className="text-lg font-bold tracking-tight">NEXUS</span>}
      </div>

      {/* User */}
      {!collapsed && (
        <div className="mx-3 flex items-center gap-3 rounded-lg bg-sidebar-muted/30 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{userName[0]}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">{orgName}</p>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </div>
      )}

      {/* Nav */}
      <nav className="mt-4 flex-1 overflow-y-auto px-2">
        {nav.map(section => (
          <div key={section.title} className="mb-4">
            {!collapsed && <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">{section.title}</p>}
            {section.items.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/dashboard" || item.path === "/volunteer"}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 rounded-r-pill px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/70 hover:bg-sidebar-muted/20 hover:text-sidebar-foreground"
                )}
              >
                {item.icon ? (
                  <item.icon className="h-4.5 w-4.5 shrink-0" />
                ) : (
                  <span className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                )}
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <button 
          onClick={() => navigate("/")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>
    </aside>
  );
}
