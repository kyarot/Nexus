import React from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Plug, 
  Sparkles, 
  MapPin, 
  Flame, 
  Brain, 
  Type, 
  Code2, 
  MessageSquare, 
  Phone, 
  Mail, 
  MessageCircle,
  Stethoscope,
  BarChart3,
  Building,
  ClipboardList,
  Info,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

const IntegrationCard = ({ 
  icon: Icon, 
  iconBg, 
  name, 
  description, 
  status, 
  statusType = "success", 
  hasToggle = false, 
  isToggleOn = true,
  actionText = "" 
}: { 
  icon: any, 
  iconBg: string, 
  name: string, 
  description: string, 
  status: string, 
  statusType?: "success" | "muted", 
  hasToggle?: boolean,
  isToggleOn?: boolean,
  actionText?: string
}) => (
  <div className="bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-slate-100 flex flex-col h-full hover:border-indigo-100 transition-all group">
    <div className="flex items-start gap-4 mb-4">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm", iconBg)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <h3 className="text-[15px] font-bold text-[#1A1A3D] leading-tight">{name}</h3>
        <p className="text-[11px] text-[#64748B] font-medium leading-relaxed line-clamp-2">{description}</p>
      </div>
    </div>
    
    <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-50">
      <Badge className={cn(
        "border-none font-black text-[9px] uppercase px-2 py-0.5 tracking-widest",
        statusType === "success" ? "bg-[#DCFCE7] text-[#166534]" : "bg-slate-100 text-slate-500"
      )}>
        {status}
      </Badge>
      
      {hasToggle ? (
        <Switch defaultChecked={isToggleOn} className="data-[state=checked]:bg-[#4F46E5]" />
      ) : actionText ? (
        <Button variant="ghost" className="h-auto p-0 text-[#4F46E5] font-black uppercase text-[10px] tracking-widest hover:bg-transparent flex gap-1 group/btn">
          {actionText} <ChevronRight className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform" />
        </Button>
      ) : status === "Not connected" ? (
        <Button className="h-8 px-4 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-black uppercase text-[9px] tracking-widest rounded-lg">
          Connect →
        </Button>
      ) : null}
    </div>
  </div>
);

const Integrations = () => {
  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7FF] font-['Plus_Jakarta_Sans']">
      <DashboardTopBar breadcrumb="Settings / Integrations" />
      
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1280px] mx-auto p-8 space-y-12 pb-24">
          
          {/* Header */}
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-[#4F46E5]">
                <Plug className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-bold text-[#1A1A3D]">Integrations</h1>
            </div>
            <p className="text-[#64748B] font-medium text-base">All tools and services connected to Nexus</p>
          </div>

          {/* Section 1: Google core */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <h2 className="text-[11px] font-black text-[#1A1A3D] uppercase tracking-[0.15em]">Google — Core Platform</h2>
              <Badge className="bg-[#DCFCE7] text-[#166534] border-none font-black text-[9px] uppercase px-2 py-0.5 tracking-widest">All Connected</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <IntegrationCard 
                icon={Sparkles} iconBg="bg-indigo-500" name="Gemini API" 
                description="AI synthesis, OCR, voice transcription, empathy engine, insights." 
                status="Connected ✓" hasToggle={true} isToggleOn={true}
              />
              <IntegrationCard 
                icon={MapPin} iconBg="bg-green-500" name="Google Maps Platform" 
                description="Need terrain map, volunteer routing, zone visualization." 
                status="Connected ✓" hasToggle={true} isToggleOn={true}
              />
              <IntegrationCard 
                icon={Flame} iconBg="bg-amber-500" name="Firebase" 
                description="Real-time database, authentication, cloud functions, file storage." 
                status="Connected ✓" hasToggle={true} isToggleOn={true}
              />
              <IntegrationCard 
                icon={Brain} iconBg="bg-blue-500" name="Vertex AI" 
                description="Need forecasting, burnout prediction, anomaly detection." 
                status="Connected ✓" hasToggle={true} isToggleOn={true}
              />
              <IntegrationCard 
                icon={Type} iconBg="bg-sky-400" name="Google Translate API" 
                description="12 Indian language translation for reports and broadcasts." 
                status="Connected ✓" hasToggle={true} isToggleOn={true}
              />
              <IntegrationCard 
                icon={Code2} iconBg="bg-blue-600" name="Google Cloud Functions" 
                description="Background pipelines, data ingestion, auto-synthesis triggers." 
                status="Connected ✓" hasToggle={true} isToggleOn={true}
              />
            </div>
          </div>

          {/* Section 2: communication */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <h2 className="text-[11px] font-black text-[#1A1A3D] uppercase tracking-[0.15em]">Communication Channels</h2>
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest">2 of 4 connected</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <IntegrationCard 
                icon={MessageCircle} iconBg="bg-[#25D366]" name="WhatsApp Business API" 
                description="Send Community Echo broadcasts and mission briefings via WhatsApp." 
                status="Connected ✓" actionText="Configure"
              />
              <IntegrationCard 
                icon={Phone} iconBg="bg-red-500" name="Twilio IVR" 
                description="Toll-free IVR for zero-smartphone voice reporting from villages." 
                status="Connected ✓" actionText="Configure"
              />
              <IntegrationCard 
                icon={MessageSquare} iconBg="bg-slate-400" name="SMS Shortcode" 
                description="Field workers send reports via plain SMS to a registered number." 
                status="Not connected" statusType="muted"
              />
              <IntegrationCard 
                icon={Mail} iconBg="bg-slate-400" name="Email (SMTP)" 
                description="Send Living Constitution briefs and donor reports via email." 
                status="Not connected" statusType="muted"
              />
            </div>
          </div>

          {/* Section 3: Gov Data */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <h2 className="text-[11px] font-black text-[#1A1A3D] uppercase tracking-[0.15em]">Government Data Sources</h2>
              <div className="p-0.5 rounded-full bg-slate-200 text-slate-500 hover:bg-indigo-100 hover:text-[#4F46E5] transition-colors cursor-help">
                <Info className="w-3.5 h-3.5" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <IntegrationCard 
                icon={Stethoscope} iconBg="bg-teal-500" name="ASHA Worker Reports" 
                description="National Health Mission field data for baseline community health scores." 
                status="Auto-connected ✓"
              />
              <IntegrationCard 
                icon={BarChart3} iconBg="bg-orange-500" name="Census Data (2024)" 
                description="Poverty indicators, literacy rates, sanitation data by pincode." 
                status="Auto-connected ✓"
              />
              <IntegrationCard 
                icon={Building} iconBg="bg-indigo-600" name="District Collector Portal" 
                description="Submit Living Constitution briefs directly to DC office." 
                status="Connected ✓" actionText="Configure district"
              />
              <IntegrationCard 
                icon={ClipboardList} iconBg="bg-blue-400" name="NFHS Survey Data" 
                description="National Family Health Survey — nutrition and health indicators." 
                status="Auto-connected ✓"
              />
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-gradient-to-r from-indigo-50 to-white rounded-[2rem] p-8 border border-indigo-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12 opacity-10 -mr-6 -mt-6 group-hover:scale-110 transition-transform duration-700">
               <Sparkles className="w-32 h-32 text-[#4F46E5]" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 rounded-[1.5rem] bg-white shadow-xl shadow-indigo-100/50 flex items-center justify-center text-[#4F46E5]">
                    <Sparkles className="w-8 h-8" />
                 </div>
                 <div className="space-y-2">
                    <div className="flex items-center gap-3">
                       <h3 className="text-xl font-black text-[#1A1A3D]">Google for Nonprofits</h3>
                       <Badge className="bg-[#4F46E5] text-white border-none font-bold text-[9px] uppercase px-3 py-1 tracking-widest">Verified Program</Badge>
                    </div>
                    <p className="text-sm text-[#64748B] font-medium max-w-2xl leading-relaxed">
                       Qualifying NGOs receive <span className="text-[#4F46E5] font-black">$10,000/year</span> in free Google Cloud API credits. Apply directly from Nexus to accelerate your community impact.
                    </p>
                 </div>
              </div>
              <Button className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] text-white font-black text-sm uppercase tracking-widest px-8 h-12 rounded-[1.25rem] shadow-xl shadow-indigo-200/50 flex gap-2">
                 Check eligibility <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Integrations;