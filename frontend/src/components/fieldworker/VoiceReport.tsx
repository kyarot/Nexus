import React, { useState, useEffect } from "react";
import { 
  Mic, 
  Square, 
  Sparkles, 
  CheckCircle2, 
  ChevronRight,
  Info,
  ArrowRight,
  FileText,
  MessageSquare,
  Globe,
  Loader2,
  Volume2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const LanguagePill = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-4 py-2 rounded-full text-sm font-bold transition-all border shrink-0",
      active 
        ? "bg-[#5A57FF] text-white border-[#5A57FF] shadow-lg shadow-indigo-500/20" 
        : "bg-white text-slate-500 border-slate-200 hover:border-[#5A57FF] hover:text-[#5A57FF]"
    )}
  >
    {label}
  </button>
);

const Waveform = () => (
  <div className="flex items-center gap-1.5 h-16">
    {[...Array(12)].map((_, i) => (
      <div
        key={i}
        className="w-1.5 bg-[#5A57FF] rounded-full animate-pulse"
        style={{
          height: `${Math.random() * 80 + 20}%`,
          animationDuration: `${Math.random() * 0.5 + 0.5}s`,
          animationDelay: `${i * 0.1}s`
        }}
      />
    ))}
  </div>
);

export const VoiceReport = ({ onGoToDashboard }: { onGoToDashboard: () => void }) => {
  const [step, setStep] = useState<"idle" | "recording" | "processing" | "result" | "submitted">("idle");
  const [language, setLanguage] = useState("Kannada");
  const [timer, setTimer] = useState(0);
  const languages = ["Kannada", "Hindi", "Telugu", "Tamil", "Bengali", "Marathi", "English"];

  useEffect(() => {
    let interval: any;
    if (step === "recording") {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [step]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = () => {
    setStep("recording");
  };

  const handleStopRecording = () => {
    setStep("processing");
    setTimeout(() => setStep("result"), 3000);
  };

  const handleSubmit = () => {
    setStep("submitted");
  };

  if (step === "submitted") {
    return (
      <div className="flex-1 flex items-center justify-center p-10 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[600px] animate-in fade-in zoom-in duration-500">
        <div className="max-w-md w-full text-center space-y-8">
           <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
           </div>
           <div className="space-y-2">
              <h2 className="text-3xl font-bold text-[#1A1A3D]">Voice Report Submitted!</h2>
              <p className="text-slate-500 font-medium">Your report has been transcribed and synced.</p>
           </div>
           
           <div className="space-y-3 pt-6">
              <Button onClick={() => setStep("idle")} className="w-full h-14 bg-[#5A57FF] rounded-2xl font-bold flex gap-2">
                New Recording <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="ghost" onClick={onGoToDashboard} className="w-full h-14 text-slate-500 font-bold">
                Go to Dashboard
              </Button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-10 max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* MAIN CONTENT Area */}
      <div className="flex-1 space-y-8 max-w-[680px] mx-auto w-full">
        
        {/* Language Selector */}
        <div className="space-y-4">
           <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#5A57FF]" />
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Select reporting language</label>
           </div>
           <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {languages.map(lang => (
                <LanguagePill 
                  key={lang} 
                  label={lang} 
                  active={language === lang} 
                  onClick={() => setLanguage(lang)} 
                />
              ))}
           </div>
        </div>

        {/* Recording Card */}
        <Card className="p-10 min-h-[400px] flex flex-col items-center justify-center text-center space-y-8 rounded-[2.5rem] border-slate-100 shadow-xl shadow-indigo-500/5 relative overflow-hidden bg-white">
           {/* Top bar indicator */}
           <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
           
           {step === "idle" && (
              <div className="space-y-8 animate-in fade-in zoom-in">
                 <button 
                  onClick={handleStartRecording}
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-[#5A57FF] to-indigo-700 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/40 hover:scale-110 transition-transform group"
                 >
                    <Mic className="w-10 h-10 group-hover:animate-pulse" />
                 </button>
                 <div className="space-y-2">
                    <h3 className="text-xl font-bold text-[#1A1A3D]">Tap to start recording</h3>
                    <p className="text-sm text-slate-400 font-medium">Speak naturally — Nexus will extract the details</p>
                 </div>
              </div>
           )}

           {step === "recording" && (
              <div className="space-y-8 animate-in fade-in zoom-in w-full">
                 <div className="flex flex-col items-center space-y-4">
                    <p className="text-sm font-black text-[#5A57FF] uppercase tracking-[0.2em]">Recording in {language}...</p>
                    <p className="text-5xl font-mono font-black text-[#1A1A3D]">{formatTime(timer)}</p>
                 </div>
                 
                 <Waveform />

                 <button 
                  onClick={handleStopRecording}
                  className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center text-white shadow-2xl shadow-red-500/20 hover:scale-110 transition-transform"
                 >
                    <Square className="w-8 h-8 fill-current" />
                 </button>
                 <p className="text-xs font-bold text-slate-400 animate-pulse">Tap to finish and process report</p>
              </div>
           )}

           {step === "processing" && (
              <div className="space-y-8 animate-in fade-in zoom-in">
                 <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-[#F3F2FF] border-t-[#5A57FF] animate-spin mx-auto" />
                    <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-indigo-400" />
                 </div>
                 <div className="space-y-3">
                    <h3 className="text-xl font-bold text-[#1A1A3D]">Gemini is processing...</h3>
                    <div className="flex flex-col gap-2 max-w-[240px] mx-auto">
                       <p className="text-sm text-slate-400 font-medium flex items-center justify-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Transcribing report...
                       </p>
                       <p className="text-sm text-slate-400 font-medium opacity-60">Extracting need details...</p>
                    </div>
                 </div>
              </div>
           )}

           {step === "result" && (
              <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-6">
                 <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                       <Volume2 className="w-5 h-5 text-[#5A57FF]" />
                       <h4 className="font-bold text-[#1A1A3D]">Transcription Preview</h4>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-600 border-none px-3 font-black text-[9px] tracking-widest uppercase py-1">High Confidence</Badge>
                 </div>

                 <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 text-left relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#5A57FF]" />
                    <p className="text-lg text-slate-600 leading-relaxed font-medium italic">
                       "In the north sector of the village, we have observed a critical <span className="bg-indigo-100 text-[#5A57FF] px-2 py-0.5 rounded-md font-bold">food shortage</span> affecting approximately <span className="bg-indigo-100 text-[#5A57FF] px-2 py-0.5 rounded-md font-bold">34 families</span>. The local well water level has dropped by 2 meters since last week. Immediate delivery of grain and clean water tanks is required by Friday in <span className="bg-indigo-100 text-[#5A57FF] px-2 py-0.5 rounded-md font-bold">Hebbal</span>."
                    </p>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-left space-y-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identified Issue</p>
                       <p className="text-sm font-bold text-[#1A1A3D]">Resource Scarcity</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-left space-y-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Impact Radius</p>
                       <p className="text-sm font-bold text-[#1A1A3D]">North Sector</p>
                    </div>
                 </div>

                 <div className="flex gap-4 pt-4">
                    <Button variant="outline" className="flex-1 h-14 rounded-2xl border-slate-200 font-bold text-slate-600">Edit Text</Button>
                    <Button onClick={handleSubmit} className="flex-[2] h-14 rounded-2xl bg-[#5A57FF] hover:bg-[#4845E0] font-bold shadow-xl shadow-indigo-100">
                       Submit Intelligence Report <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                 </div>
              </div>
           )}
        </Card>
      </div>

      {/* RIGHT SIDEBAR - Tips */}
      <aside className="hidden xl:block w-[240px] space-y-6">
        <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm space-y-6">
           <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#5A57FF]" />
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Reporting Tips</h4>
           </div>
           
           <div className="space-y-4">
              {[
                "State the location first",
                "Mention number of families affected",
                "Describe urgency level",
                "Add any access issues"
              ].map((tip, i) => (
                <div key={i} className="flex gap-3">
                   <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-[#5A57FF]" />
                   </div>
                   <p className="text-xs font-bold text-slate-600 leading-tight">{tip}</p>
                </div>
              ))}
           </div>
        </div>

        <div className="bg-[#F3F2FF]/50 border border-indigo-100/50 rounded-[2.5rem] p-6 space-y-4">
           <p className="text-[10px] font-black text-[#5A57FF] uppercase tracking-widest">Example Report</p>
           <p className="text-xs text-slate-500 font-medium italic leading-relaxed">
              "In Hebbal near the market, around 34 families facing food shortage, situation is critical, road is accessible"
           </p>
           <div className="flex items-center gap-2 pt-2 text-[#5A57FF]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#5A57FF]" />
              <span className="text-[10px] font-black uppercase tracking-widest">98% Transcription accuracy</span>
           </div>
        </div>
      </aside>

    </div>
  );
};