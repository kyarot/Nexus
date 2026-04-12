import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardList, Loader2, Settings, AlertTriangle } from "lucide-react";
import {
  decideCoordinatorResourceRequest,
  getNotificationStreamUrl,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/ops-api";
import { cn } from "@/lib/utils";

type NotificationFilter = "all" | "unread" | "missions" | "alerts";

const typeLabels: Record<string, string> = {
  mission_created: "Mission",
  mission_assigned: "Mission",
  mission_assignment_updated: "Mission",
  mission_completed: "Mission",
  insight_generated: "Insight",
  drift_alert_triggered: "Alert",
  collaboration_request: "Collaboration",
  collaboration_accepted: "Collaboration",
  collaboration_rejected: "Collaboration",
  collaboration_support_activated: "Collaboration",
  resources_claimed: "Resource",
  resource_request: "Resource",
  resource_request_decision: "Resource",
};

function relativeTime(timestamp?: string | null): string {
  if (!timestamp) {
    return "now";
  }
  const value = new Date(timestamp).getTime();
  if (Number.isNaN(value)) {
    return "now";
  }
  const delta = Math.max(0, Date.now() - value);
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationPanel() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [actingId, setActingId] = useState<string | null>(null);

  const role = useMemo(() => {
    try {
      const raw = localStorage.getItem("nexus_user");
      if (!raw) return "";
      const parsed = JSON.parse(raw) as { role?: string };
      return String(parsed.role || "").toLowerCase();
    } catch {
      return "";
    }
  }, []);

  const refresh = async () => {
    const payload = await listNotifications(false);
    setItems(payload.notifications);
    setUnread(payload.unread);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        await refresh();
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    const streamUrl = getNotificationStreamUrl();
    const source = new EventSource(streamUrl);
    source.onmessage = () => {
      void refresh();
    };
    source.onerror = () => {
      // Keep panel functional even if realtime stream disconnects.
    };

    return () => {
      mounted = false;
      source.close();
    };
  }, []);

  const markOne = async (item: NotificationItem) => {
    if (item.read) {
      return;
    }
    await markNotificationRead(item.id);
    await refresh();
  };

  const markAll = async () => {
    await markAllNotificationsRead();
    await refresh();
  };

  const decideRequest = async (requestId: string, decision: "approved" | "rejected") => {
    setActingId(requestId);
    try {
      await decideCoordinatorResourceRequest(requestId, decision);
      await refresh();
    } finally {
      setActingId(null);
    }
  };

  const filtered = items.filter((item) => {
    if (filter === "unread") return !item.read;
    if (filter === "missions") return item.type.includes("mission");
    if (filter === "alerts") return item.type.includes("alert") || item.type.includes("resource") || item.type.includes("insight");
    return true;
  });

  return (
    <div className="flex flex-col bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] overflow-hidden font-sans">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#FCFCFD]">
        <h3 className="font-bold text-[19px] text-[#0A0F2C] tracking-tight">Notifications</h3>
        <div className="flex items-center gap-4">
          <button onClick={markAll} className="text-[14px] text-indigo-600 hover:text-indigo-800 font-semibold transition-colors">
            Mark all read
          </button>
          <button className="text-slate-600 hover:text-slate-900 transition-colors">
            <Settings className="h-[22px] w-[22px]" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-[#FCFCFD]">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-full px-4 py-1.5 text-[12px] font-bold tracking-wide shadow-sm transition-colors",
            filter === "all" ? "bg-[#312E81] text-white hover:bg-indigo-900" : "bg-[#F3F4F6] text-[#475569] hover:bg-[#E5E7EB]"
          )}
        >
          ALL
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={cn(
            "rounded-full px-4 py-1.5 text-[12px] font-bold tracking-wide transition-colors",
            filter === "unread" ? "bg-[#EEF2FF] text-[#4F46E5] hover:bg-[#E0E7FF]" : "bg-[#F3F4F6] text-[#475569] hover:bg-[#E5E7EB]"
          )}
        >
          UNREAD
        </button>
        <button
          onClick={() => setFilter("missions")}
          className={cn(
            "rounded-full px-4 py-1.5 text-[12px] font-bold tracking-wide transition-colors",
            filter === "missions" ? "bg-[#EEF2FF] text-[#4F46E5] hover:bg-[#E0E7FF]" : "bg-[#F3F4F6] text-[#475569] hover:bg-[#E5E7EB]"
          )}
        >
          MISSIONS
        </button>
        <button
          onClick={() => setFilter("alerts")}
          className={cn(
            "rounded-full px-4 py-1.5 text-[12px] font-bold tracking-wide transition-colors",
            filter === "alerts" ? "bg-[#EEF2FF] text-[#4F46E5] hover:bg-[#E0E7FF]" : "bg-[#F3F4F6] text-[#475569] hover:bg-[#E5E7EB]"
          )}
        >
          ALERTS
        </button>
        <span className="ml-auto text-[11px] font-bold text-slate-500">{unread} unread</span>
      </div>

      <div className="flex flex-col max-h-[460px] overflow-y-auto">
        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading notifications...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-500">No notifications in this filter.</div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors",
                item.read ? "bg-white" : "bg-[#F8FAFC]"
              )}
              onClick={() => {
                void markOne(item);
              }}
            >
              <div className="relative shrink-0 mt-0.5">
                <div className={cn(
                  "h-[46px] w-[46px] rounded-full flex items-center justify-center",
                  item.type.includes("alert") || item.type.includes("resource") ? "bg-[#FCE8E8] text-[#991B1B]" : item.type.includes("mission") ? "bg-[#E0E7FF] text-[#4338CA]" : "bg-[#86EFAC] text-[#065F46]"
                )}>
                  {item.type.includes("alert") || item.type.includes("resource") ? (
                    <AlertTriangle className="h-[22px] w-[22px]" strokeWidth={2.5} />
                  ) : item.type.includes("mission") ? (
                    <ClipboardList className="h-[22px] w-[22px]" strokeWidth={2.5} />
                  ) : (
                    <CheckCircle2 className="h-[22px] w-[22px]" strokeWidth={2.5} />
                  )}
                </div>
                {!item.read ? (
                  <span className="absolute -top-0.5 -right-0.5 h-[10px] w-[10px] rounded-full bg-[#312E81] border-2 border-white" />
                ) : null}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-semibold text-[#0F172A]">{item.title}</p>
                  <span className="text-[13px] text-slate-500 whitespace-nowrap mt-0.5">{relativeTime(item.timestamp)}</span>
                </div>
                <p className="text-[14px] text-slate-600 leading-[1.5]">{item.message}</p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                    {typeLabels[item.type] || item.type}
                  </span>
                  {role === "coordinator" && item.type === "resource_request" && item.requestId ? (
                    <>
                      <button
                        disabled={actingId === item.requestId}
                        onClick={(event) => {
                          event.stopPropagation();
                          void decideRequest(item.requestId as string, "approved");
                        }}
                        className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        disabled={actingId === item.requestId}
                        onClick={(event) => {
                          event.stopPropagation();
                          void decideRequest(item.requestId as string, "rejected");
                        }}
                        className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="py-4 border-t border-slate-100 bg-white text-center rounded-b-xl">
        <button className="text-[15px] font-bold text-[#312E81] hover:text-indigo-900 flex items-center justify-center gap-1.5 w-full transition-colors">
          View all notifications <ArrowRight className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}