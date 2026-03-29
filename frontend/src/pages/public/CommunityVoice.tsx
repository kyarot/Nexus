import React, { useState } from "react";
import { 
  Globe, 
  Phone, 
  MapPin, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  Shield,
  MessageSquare,
  Package,
  Droplets,
  HeartPulse,
  Flame,
  UserPlus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

const LanguagePill = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all border",
      active 
        ? "bg-[#4F46E5] text-white border-[#4F46E5] shadow-lg shadow-indigo-500/20" 
        : "bg-white text-slate-500 border-slate-100 hover:border-[#4F46E5] hover:text-[#4F46E5]"
    )}
  >
    {label}
  </button>
);

const UrgencyCard = ({ level, label, description, active, onClick }: { level: string, label: string, description: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex-1 p-4 rounded-2xl border-2 text-left transition-all",
      active 
        ? (level === "Critical" ? "bg-red-50 border-red-500 shadow-md" : 
           level === "High" ? "bg-amber-50 border-amber-500 shadow-md" : 
           "bg-blue-50 border-blue-500 shadow-md")
        : "bg-white border-slate-100 hover:border-slate-200"
    )}
  >
    <div className={cn("w-2 h-2 rounded-full mb-3", 
      level === "Critical" ? "bg-red-500" : 
      level === "High" ? "bg-amber-500" : 
      "bg-blue-500")} />
    <p className={cn("text-xs font-black uppercase tracking-widest mb-1",
      active ? (level === "Critical" ? "text-red-700" : level === "High" ? "text-amber-700" : "text-blue-700") : "text-slate-400"
    )}>{label}</p>
    <p className="text-[10px] text-slate-500 font-medium leading-tight">{description}</p>
  </button>
);

const CategoryCard = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all",
      active 
        ? "bg-indigo-50 border-[#4F46E5] shadow-sm" 
        : "bg-white border-slate-100 hover:border-slate-200"
    )}
  >
    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", active ? "bg-[#4F46E5] text-white" : "bg-slate-50 text-slate-400")}>
      <Icon className="w-5 h-5" />
    </div>
    <span className={cn("text-[10px] font-bold uppercase tracking-wider", active ? "text-[#4F46E5]" : "text-slate-500")}>{label}</span>
  </button>
);

export const CommunityVoice = () => {
  const [step, setStep] = useState<"form" | "success">("form");
  const [language, setLanguage] = useState("English");
  const [urgency, setUrgency] = useState("High");
  const [category, setCategory] = useState("Food");

  const languages = ["English", "Kannada", "Hindi", "Telugu"];
  const categories = [
    { icon: Package, label: "Food" },
    { icon: Droplets, label: "Water" },
    { icon: HeartPulse, label: "Health" },
    { icon: Flame, label: "Fire/DANGER" },
    { icon: Shield, label: "Safety" },
    { icon: UserPlus, label: "Other" }
  ];

  if (step === "success") {
    return (
      <div className="min-h-screen bg-[#F8F7FF] flex flex-col items-center justify-center p-6 font-['Plus_Jakarta_Sans']">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-2xl shadow-indigo-500/10 border border-slate-100 text-center space-y-8 animate-in fade-in zoom-in duration-500">
           <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
           </div>
           <div className="space-y-3">
              <h2 className="text-3xl font-bold text-[#1A1A3D]">Report Received!</h2>
              <p className="text-slate-500 font-medium">Thank you. Your community report has been submitted to the regional coordination center.</p>
           </div>
           
           <div className="bg-slate-50 rounded-2xl p-6 space-y-2 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">YOUR REFERENCE NUMBER</p>
              <p className="text-4xl font-mono font-black text-[#4F46E5]">#NCH-2847</p>
              <p className="text-[11px] text-slate-400 font-medium">Save this number to track your report status.</p>
           </div>

           <div className="space-y-3">
              <Button 
                onClick={() => window.location.href = "/community-voice/track"}
                variant="outline"
                className="w-full h-14 border-slate-200 text-slate-600 font-bold rounded-2xl"
              >
                Track Status
              </Button>
              <Button 
                onClick={() => setStep("form")}
                className="w-full h-14 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white font-bold rounded-2xl shadow-lg ring-offset-2 focus:ring-2 ring-indigo-500"
              >
                Submit New Report
              </Button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7FF] flex flex-col font-['Plus_Jakarta_Sans']">
      {/* Header */}
      <header className="p-6 flex flex-col md:flex-row items-center justify-between gap-6 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#4F46E5] rounded-xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/30">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1A1A3D] uppercase tracking-tighter">NEXUS Community</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Voice & Reporting Channel</p>
          </div>
        </div>

        <div className="flex gap-2">
          {languages.map(lang => (
            <LanguagePill 
              key={lang} 
              label={lang} 
              active={language === lang} 
              onClick={() => setLanguage(lang)} 
            />
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 flex items-start justify-center">
        <Card className="max-w-xl w-full rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-indigo-500/5 border-slate-100 space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
           
           <div className="space-y-2">
              <h2 className="text-3xl font-bold text-[#1A1A3D]">Report a Problem</h2>
              <p className="text-slate-500 font-medium">Tell us what's happening in your area. Help is on the way.</p>
           </div>

           <div className="space-y-8">
              {/* Phone Input */}
              <div className="space-y-3">
                 <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#4F46E5]" />
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Your Phone Number</label>
                 </div>
                 <Input 
                   type="tel"
                   placeholder="+91-0000000000"
                   className="h-14 bg-slate-50 border-slate-100 rounded-2xl text-lg font-bold focus:bg-white transition-all shadow-inner"
                 />
              </div>

              {/* Problem Description */}
              <div className="space-y-3">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <MessageSquare className="w-4 h-4 text-[#4F46E5]" />
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">What's the situation?</label>
                    </div>
                    <Button variant="ghost" className="h-fit py-0 text-[10px] font-black text-[#4F46E5] uppercase tracking-widest">
                       <MapPin className="w-3 h-3 mr-1" /> Use current location
                    </Button>
                 </div>
                 <Textarea 
                   placeholder="Describe the issue, location details, and number of people affected..."
                   className="min-h-[140px] bg-slate-50 border-slate-100 rounded-[2rem] p-6 text-base font-medium focus:bg-white transition-all shadow-inner resize-none"
                 />
              </div>

              {/* Category Grid */}
              <div className="space-y-4">
                 <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Problem Category</label>
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                   {categories.map(cat => (
                     <CategoryCard 
                       key={cat.label}
                       icon={cat.icon}
                       label={cat.label}
                       active={category === cat.label}
                       onClick={() => setCategory(cat.label)}
                     />
                   ))}
                 </div>
              </div>

              {/* Urgency */}
              <div className="space-y-4">
                 <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-[#4F46E5]" />
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Urgency Level</label>
                 </div>
                 <div className="flex flex-col sm:flex-row gap-3">
                    <UrgencyCard 
                       level="Life Threatening"
                       label="Critical"
                       description="Immediate danger to life or health"
                       active={urgency === "Critical"}
                       onClick={() => setUrgency("Critical")}
                    />
                    <UrgencyCard 
                       level="Urgent"
                       label="High"
                       description="Needs attention within 12-24 hours"
                       active={urgency === "High"}
                       onClick={() => setUrgency("High")}
                    />
                    <UrgencyCard 
                       level="Routine"
                       label="Normal"
                       description="Standard community update/request"
                       active={urgency === "Normal"}
                       onClick={() => setUrgency("Normal")}
                    />
                 </div>
              </div>

              {/* Submit */}
              <Button 
                onClick={() => setStep("success")}
                className="w-full h-16 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:opacity-90 text-white text-lg font-black rounded-2xl shadow-xl shadow-indigo-500/20 group uppercase tracking-widest"
              >
                Send Assistance Request <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>

              <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">
                 Your IP and location will be sent to emergency responders
              </p>
           </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="p-8 text-center border-t border-slate-100">
         <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Secured by NEXUS Protocol</p>
         <div className="flex justify-center gap-6">
            <a href="#" className="text-[10px] font-black text-slate-500 hover:text-[#4F46E5] uppercase tracking-widest transition-colors">Privacy</a>
            <a href="#" className="text-[10px] font-black text-slate-500 hover:text-[#4F46E5] uppercase tracking-widest transition-colors">Emergency Contacts</a>
            <a href="#" className="text-[10px] font-black text-slate-500 hover:text-[#4F46E5] uppercase tracking-widest transition-colors">About</a>
         </div>
      </footer>
    </div>
  );
};
