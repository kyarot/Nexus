import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, BarChart3, Map, AlertTriangle, Users, Target, Sparkles, TrendingUp, 
  Handshake, FileText, BookOpen, Shield, Building2, Plug, UserCog, LogOut, 
  Hexagon, Camera, Mic, ListTodo, Zap, Clock, User, Heart, Star, Activity, 
  CloudUpload, Settings, HelpCircle, Phone, Footprints, MessageCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/hooks/use-sidebar-store";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Types
interface NavItem {
  id: string;
  label: string;
  icon: any;
  path: string;
  badge?: number | string;
  badgeVariant?: "red" | "amber" | "indigo";
}

interface NavSection {
  items: NavItem[];
}

// Icon Maps
const coordinatorNav: NavSection[] = [
  { items: [
    { id: "dash", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  ]},
  { items: [
    { id: "terrain", label: "Need Terrain Map", icon: Map, path: "/dashboard/terrain" },
    { id: "alerts", label: "Alerts Feed", icon: AlertTriangle, path: "/dashboard/alerts", badge: 3, badgeVariant: "red" },
    { id: "volunteers", label: "Volunteers", icon: Users, path: "/dashboard/volunteers" },
    { id: "missions", label: "Missions", icon: Target, path: "/dashboard/missions" },
  ]},
  { items: [
    { id: "insights", label: "Gemini Insights", icon: Sparkles, path: "/dashboard/insights", badge: "•", badgeVariant: "indigo" },
    { id: "forecast", label: "Forecast", icon: TrendingUp, path: "/dashboard/forecast" },
    { id: "collab", label: "Collaboration Bridge", icon: Handshake, path: "/dashboard/echo" },
  ]},
  { items: [
    { id: "trust", label: "Trust Fabric", icon: Shield, path: "/dashboard/trust" },
    { id: "constitution", label: "Living Constitution", icon: BookOpen, path: "/dashboard/constitution" },
    { id: "impact", label: "Impact Reports", icon: BarChart3, path: "/dashboard/impact" },
  ]},
  { items: [
    { id: "org", label: "Organisation", icon: Building2, path: "/dashboard/organisation" },
    { id: "integrations", label: "Integrations", icon: Plug, path: "/dashboard/integrations" },
    { id: "team", label: "Team", icon: UserCog, path: "/dashboard/team" },
  ]},
];

const fieldworkerNav = [
  { items: [
    { id: "fw-dash", label: "Dashboard", icon: LayoutDashboard, path: "/fieldworker" },
    { id: "scan", label: "Scan Survey", icon: Camera, path: "/fieldworker/scan" },
    { id: "voice", label: "Voice Report", icon: Mic, path: "/fieldworker/voice" },
    { id: "reports", label: "My Reports", icon: ListTodo, path: "/fieldworker/reports" },
  ]},
  { items: [
    { id: "active", label: "Active Mission", icon: Zap, path: "/fieldworker/active", badge: "!", badgeVariant: "amber" },
    
  ]},
  { items: [
    { id: "profile", label: "My Profile", icon: User, path: "/fieldworker/profile" },
    
  ]},
];

const volunteerNav = [
  { items: [
    { id: "vol-dash", label: "My Dashboard", icon: LayoutDashboard, path: "/volunteer" },
    { id: "vol-missions", label: "My Missions", icon: Target, path: "/volunteer/missions" },
    { id: "empathy", label: "Empathy Engine", icon: Sparkles, path: "/volunteer/empathy" },
  ]},
  { items: [
    { id: "vol-impact", label: "My Impact", icon: Star, path: "/volunteer/impact" },
    { id: "vol-profile", label: "My Profile", icon: User, path: "/volunteer/profile" },
  ]},
];

// Sub-components
const NavIconButton = ({ 
  item, 
  isActive, 
  onClick 
}: { 
  item: NavItem; 
  isActive: boolean; 
  onClick?: () => void 
}) => {
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <div className="relative flex justify-center group py-1">
          <motion.button
            onClick={onClick}
            whileHover={{ scale: isActive ? 1 : 1.25 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-[10px] transition-all relative overflow-visible cursor-pointer",
              isActive 
                ? "bg-[#4F46E5] text-white shadow-[0_0_12px_rgba(79,70,229,0.5),0_0_0_1px_rgba(79,70,229,0.3)]" 
                : "text-white/50 hover:text-white hover:bg-white/5"
            )}
          >
            <item.icon size={20} className="shrink-0" />
            
            {/* Badge */}
            {item.badge && (
              <div className={cn(
                "absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-[#1E1B4B]",
                item.badgeVariant === "red" ? "bg-[#EF4444] text-white" : 
                item.badgeVariant === "amber" ? "bg-amber-500 text-white" : 
                "bg-[#4F46E5] text-white"
              )}>
                {item.badge}
              </div>
            )}
          </motion.button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={14} className="bg-white text-[#1E1B4B] border-none shadow-[0_4px_16px_rgba(0,0,0,0.15)] rounded-full px-3.5 py-1.5 font-medium z-[100] text-[13px]">
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
};

export function GlobalSidebar({ 
  role = "coordinator",
  onTabChange,
  activeTab
}: { 
  role?: "coordinator" | "fieldworker" | "volunteer";
  onTabChange?: (tabId: string) => void;
  activeTab?: string;
}) {
  const { isOpen, setIsOpen } = useSidebarStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);

  const sections = role === "coordinator" ? coordinatorNav : role === "fieldworker" ? fieldworkerNav : volunteerNav;
  
  const avatarColors = {
    coordinator: "bg-[#4F46E5]",
    fieldworker: "bg-amber-500",
    volunteer: "bg-emerald-500"
  };

  const handleMouseEnter = () => {
    if (hideTimeout) clearTimeout(hideTimeout);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setIsOpen(false);
    }, 300);
    setHideTimeout(timeout);
  };

  return (
    <>
      {/* Edge Trigger Zone */}
      <div 
        className="fixed left-0 top-0 bottom-0 w-[20px] z-[51]"
        onMouseEnter={handleMouseEnter}
      />

      <motion.aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        initial={{ x: -64 }}
        animate={{ x: isOpen ? 0 : -64 }}
        transition={{ type: "tween", duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="fixed left-0 top-0 bottom-0 w-16 bg-gradient-to-b from-[#1E1B4B] to-[#16133A] border-r border-white/10 z-50 flex flex-col py-5 scrollbar-thin scrollbar-thumb-[#4F46E5]/50 overflow-y-auto"
      >
        {/* Logo */}
        <div className="flex justify-center mb-3">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="relative group cursor-pointer" onClick={() => navigate("/")}>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="w-10 h-10 overflow-hidden flex items-center justify-center p-1 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <img src="/logo.png" alt="NEXUS" className="w-full h-full object-contain" />
                </motion.div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={14} className="bg-white text-[#1E1B4B] border-none shadow-[0_4px_16px_rgba(0,0,0,0.15)] rounded-full px-3.5 py-1.5 font-medium z-[100] text-[13px]">
              NEXUS
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="w-8 h-[1px] bg-white/10 mx-auto my-3" />

        {/* User Avatar */}
        <div className="flex justify-center mb-6">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="relative group cursor-pointer">
                <div className={cn(
                  "w-10 h-10 rounded-[10px] flex items-center justify-center text-sm font-bold text-white shadow-lg transition-transform hover:scale-110",
                  avatarColors[role]
                )}>
                  RK
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={14} className="bg-white text-[#1E1B4B] border-none shadow-[0_4px_16px_rgba(0,0,0,0.15)] rounded-2xl px-4 py-2.5 font-medium z-[100]">
              <div className="text-left py-0.5">
                <div className="font-bold text-[14px]">Ravi Kumar</div>
                <div className="text-[11px] opacity-60 uppercase tracking-wider font-extrabold mt-0.5">
                  {role === "coordinator" ? "NGO Coordinator" : role === "fieldworker" ? "Field Worker" : "Volunteer"}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Nav Sections */}
        <div className="flex-1 space-y-3 px-3">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {section.items.map((item) => {
                // Map path to tab ID for fieldworker to stay in the same URL without routing issues
                const isFieldworkerPath = item.path.startsWith("/fieldworker/");
                const tabIdMatch = item.path.split("/").pop();
                const matchedTab = item.path === "/fieldworker" ? "Dashboard" : 
                                  tabIdMatch === "scan" ? "Scan" : 
                                  tabIdMatch === "voice" ? "Voice" : 
                                  tabIdMatch === "reports" ? "Reports" : 
                                  tabIdMatch === "active" ? "Active" : 
                                  tabIdMatch === "profile" ? "Profile" : tabIdMatch;
                                  
                return (
                  <NavIconButton 
                    key={item.id} 
                    item={item} 
                    isActive={
                      role === "fieldworker" && activeTab 
                        ? activeTab === matchedTab 
                        : location.pathname === item.path
                    }
                    onClick={() => {
                      if (role === "fieldworker" && onTabChange) {
                        onTabChange(matchedTab as string);
                      } else {
                        navigate(item.path);
                      }
                      if (window.innerWidth < 1024) setIsOpen(false);
                    }}
                  />
                );
              })}
              {sIdx < sections.length - 1 && (
                <div className="w-8 h-[1px] bg-white/5 mx-auto my-3" />
              )}
            </div>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="mt-auto px-3 border-t border-white/10 pt-4 space-y-2">
          {role === "fieldworker" && (
            <NavIconButton 
              item={{ 
                id: "sync", 
                label: "All synced ✓", 
                icon: CloudUpload, 
                path: "#",
                badgeVariant: "indigo" 
              }} 
              isActive={false} 
            />
          )}
          <NavIconButton 
            item={{ id: "help", label: "Help & Documentation", icon: HelpCircle, path: "/help" }} 
            isActive={false} 
          />
          <NavIconButton 
            item={{ id: "logout", label: "Sign out", icon: LogOut, path: "/" }} 
            isActive={false}
            onClick={() => navigate("/")}
          />
        </div>
      </motion.aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#1E1B4B] border-t border-white/10 flex lg:hidden items-center justify-around z-50 px-2 shadow-2xl">
        <MobileTabItem 
          icon={LayoutDashboard} 
          label="Home" 
          path={role === "coordinator" ? "/dashboard" : role === "fieldworker" ? "/fieldworker" : "/volunteer"} 
          active={
            role === "fieldworker" && activeTab 
              ? activeTab === "Dashboard" 
              : (location.pathname.endsWith("dashboard") || location.pathname === "/volunteer" || location.pathname === "/fieldworker")
          }
          onClick={() => role === "fieldworker" && onTabChange ? onTabChange("Dashboard") : undefined}
        />
        <MobileTabItem 
          icon={Target} 
          label="Missions" 
          path={role === "coordinator" ? "/dashboard/missions" : role === "fieldworker" ? "/fieldworker/active" : "/volunteer/missions"} 
          active={role === "fieldworker" && activeTab ? activeTab === "Active" : undefined}
          onClick={() => role === "fieldworker" && onTabChange ? onTabChange("Active") : undefined}
        />
        <MobileTabItem 
          icon={Sparkles} 
          label="Nexus" 
          path={role === "coordinator" ? "/dashboard/insights" : role === "fieldworker" ? "/fieldworker/scan" : "/volunteer/empathy"} 
          active={role === "fieldworker" && activeTab ? activeTab === "Scan" : undefined}
          onClick={() => role === "fieldworker" && onTabChange ? onTabChange("Scan") : undefined}
        />
        <MobileTabItem 
          icon={BarChart3} 
          label="Impact" 
          path={role === "coordinator" ? "/dashboard/impact" : "/fieldworker/reports"} 
          active={role === "fieldworker" && activeTab ? activeTab === "Reports" : undefined}
          onClick={() => role === "fieldworker" && onTabChange ? onTabChange("Reports") : undefined}
        />
        <MobileTabItem 
          icon={UserCog} 
          label="Profile" 
          path={role === "coordinator" ? "/dashboard/team" : role === "fieldworker" ? "/fieldworker/profile" : "/volunteer/profile"} 
          active={role === "fieldworker" && activeTab ? activeTab === "Profile" : undefined}
          onClick={() => role === "fieldworker" && onTabChange ? onTabChange("Profile") : undefined}
        />
      </nav>
    </>
  );
}

const MobileTabItem = ({ icon: Icon, label, path, active, onClick }: { icon: any, label: string, path: string, active?: boolean, onClick?: () => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = active !== undefined ? active : location.pathname === path;

  return (
    <button 
      onClick={() => {
        if (onClick) onClick();
        else navigate(path);
      }}
      className={cn("flex flex-col items-center gap-1", isActive ? "text-[#4F46E5]" : "text-white/50")}
    >
      <div className={cn("p-1.5 rounded-lg", isActive && "bg-[#4F46E5]/10")}>
        <Icon className="w-5 h-5" />
      </div>
      {isActive && <span className="text-[10px] font-bold text-white">{label}</span>}
    </button>
  );
}
