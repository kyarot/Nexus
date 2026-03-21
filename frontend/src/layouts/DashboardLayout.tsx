import { Outlet } from "react-router-dom";
import { GlobalSidebar } from "@/components/nexus/GlobalSidebar";
import { useSidebarStore } from "@/hooks/use-sidebar-store";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  role?: "coordinator" | "volunteer";
}

export function DashboardLayout({ role = "coordinator" }: DashboardLayoutProps) {
  const { isOpen } = useSidebarStore();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <GlobalSidebar role={role} />
      <motion.main 
        initial={false}
        animate={{ marginLeft: isOpen ? 64 : 0 }}
        transition={{ type: "tween", duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="flex-1 overflow-y-auto"
      >
        <Outlet />
      </motion.main>
    </div>
  );
}
