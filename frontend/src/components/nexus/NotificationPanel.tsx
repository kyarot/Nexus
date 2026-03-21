import React from "react";
import { Settings, AlertTriangle, ClipboardList, CheckCircle2, ArrowRight } from "lucide-react";

export function NotificationPanel() {
  return (
    <div className="flex flex-col bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] overflow-hidden font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#FCFCFD]">
        <h3 className="font-bold text-[19px] text-[#0A0F2C] tracking-tight">Notifications</h3>
        <div className="flex items-center gap-4">
          <button className="text-[14px] text-indigo-600 hover:text-indigo-800 font-semibold transition-colors">
            Mark all read
          </button>
          <button className="text-slate-600 hover:text-slate-900 transition-colors">
            <Settings className="h-[22px] w-[22px]" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-[#FCFCFD]">
        <button className="bg-[#312E81] text-white hover:bg-indigo-900 rounded-full px-4 py-1.5 text-[12px] font-bold tracking-wide shadow-sm transition-colors">
          ALL
        </button>
        <button className="bg-[#EEF2FF] text-[#4F46E5] hover:bg-[#E0E7FF] border-transparent rounded-full px-4 py-1.5 text-[12px] font-bold tracking-wide transition-colors">
          UNREAD
        </button>
        <button className="bg-[#F3F4F6] text-[#475569] hover:bg-[#E5E7EB] border-transparent rounded-full px-4 py-1.5 text-[12px] font-bold tracking-wide transition-colors">
          MISSIONS
        </button>
        <button className="bg-[#F3F4F6] text-[#475569] hover:bg-[#E5E7EB] border-transparent rounded-full px-4 py-1.5 text-[12px] font-bold tracking-wide transition-colors">
          ALERTS
        </button>
      </div>

      {/* List */}
      <div className="flex flex-col max-h-[460px] overflow-y-auto">
        {/* Just Now Section */}
        <div className="px-5 py-4 bg-[#F8FAFC]">
          <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Just Now</span>
        </div>

        {/* Item 1 */}
        <div className="flex gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors bg-[#F8FAFC]">
          <div className="relative shrink-0 mt-0.5">
            <div className="h-[46px] w-[46px] rounded-full bg-[#FCE8E8] text-[#991B1B] flex items-center justify-center">
              <AlertTriangle className="h-[22px] w-[22px]" strokeWidth={2.5} />
            </div>
            <span className="absolute -top-0.5 -right-0.5 h-[10px] w-[10px] rounded-full bg-[#312E81] border-2 border-white" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[15px] font-semibold text-[#0F172A]">Security Protocol Breach</p>
              <span className="text-[13px] text-slate-500 whitespace-nowrap mt-0.5">2m ago</span>
            </div>
            <p className="text-[14px] text-slate-600 leading-[1.5]">
              Unauthorized access attempt detected in Sector 7 Intelligence node.
            </p>
          </div>
        </div>

        {/* Item 2 */}
        <div className="flex gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors bg-[#F8FAFC]">
          <div className="relative shrink-0 mt-0.5">
            <div className="h-[46px] w-[46px] rounded-full bg-[#E0E7FF] text-[#4338CA] flex items-center justify-center">
              <ClipboardList className="h-[22px] w-[22px]" strokeWidth={2.5} />
            </div>
            <span className="absolute -top-0.5 -right-0.5 h-[10px] w-[10px] rounded-full bg-[#312E81] border-2 border-white" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[15px] font-semibold text-[#0F172A]">New Mission Assigned</p>
              <span className="text-[13px] text-slate-500 whitespace-nowrap mt-0.5">15m ago</span>
            </div>
            <p className="text-[14px] text-slate-600 leading-[1.5]">
              Orchestrate regional volunteer deployment for Project "Green Horizon".
            </p>
          </div>
        </div>

        {/* Earlier Today Section */}
        <div className="px-5 py-4 bg-white border-t border-slate-50">
          <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Earlier Today</span>
        </div>

        {/* Item 3 */}
        <div className="flex gap-4 px-5 pb-5 pt-3 hover:bg-slate-50 cursor-pointer transition-colors bg-white">
          <div className="relative shrink-0 mt-0.5">
            <div className="h-[46px] w-[46px] rounded-full bg-[#86EFAC] text-[#065F46] flex items-center justify-center">
              <CheckCircle2 className="h-[22px] w-[22px]" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[15px] font-semibold text-[#0F172A]">Mission Successful</p>
              <span className="text-[13px] text-slate-500 whitespace-nowrap mt-0.5">2h ago</span>
            </div>
            <p className="text-[14px] text-slate-600 leading-[1.5]">
              Intelligence synthesis for the Global Summit is now complete.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-4 border-t border-slate-100 bg-white text-center rounded-b-xl">
        <button className="text-[15px] font-bold text-[#312E81] hover:text-indigo-900 flex items-center justify-center gap-1.5 w-full transition-colors">
          View all notifications <ArrowRight className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}