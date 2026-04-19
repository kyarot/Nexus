import React, { useEffect, useMemo, useState } from "react";
import { 
  Search, 
  Clock, 
  CheckCircle2, 
  ArrowLeft,
  Shield,
  Activity,
  AlertTriangle,
  Send,
  MessageSquare
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { submitCommunityVoiceFeedback, trackCommunityVoiceReport, type PublicTrackResponse } from "@/lib/public-api";
import { translatePublicBatch } from "@/lib/public-translation-api";

const PUBLIC_LANGUAGE_STORAGE_KEY = "nexus_public_language";

const LANGUAGE_CODE_BY_LABEL: Record<string, string> = {
  English: "en",
  Kannada: "kn",
  Hindi: "hi",
  Telugu: "te",
};

const LANGUAGE_LABEL_BY_CODE: Record<string, string> = {
  en: "English",
  kn: "Kannada",
  hi: "Hindi",
  te: "Telugu",
};

const LanguagePill = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
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

const StatusStep = ({ status, time, event, description, latestLabel, active, completed }: { status: string, time: string, event: string, description: string, latestLabel: string, active?: boolean, completed?: boolean }) => (
  <div className="flex gap-4 group">
    <div className="flex flex-col items-center">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500",
        completed ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20" :
        active ? "bg-white border-[#4F46E5] text-[#4F46E5] ring-4 ring-indigo-50 animate-pulse" :
        "bg-white border-slate-200 text-slate-300"
      )}>
        {completed ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
      </div>
      <div className={cn("w-0.5 flex-1 my-2 transition-colors duration-500", completed ? "bg-emerald-500" : "bg-slate-100")} />
    </div>
    <div className="flex-1 pb-10">
      <div className="flex justify-between items-baseline mb-1">
        <h4 className={cn("text-base font-bold", active || completed ? "text-[#1A1A3D]" : "text-slate-400")}>{event}</h4>
        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{time}</span>
      </div>
      <p className="text-sm text-slate-500 font-medium leading-relaxed">{description}</p>
      {active && (
        <Badge className="mt-3 bg-indigo-50 text-[#4F46E5] border-none font-bold text-[10px] uppercase tracking-widest py-1 px-3">
          {latestLabel}
        </Badge>
      )}
    </div>
  </div>
);

const formatTimestamp = (value: string | null | undefined, nowLabel: string) => {
  if (!value) return nowLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return nowLabel;
  return date.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const CommunityVoiceTrack = () => {
  const navigate = useNavigate();
  const [language, setLanguage] = useState(() => {
    if (typeof window === "undefined") return "English";
    const saved = (localStorage.getItem(PUBLIC_LANGUAGE_STORAGE_KEY) || "en").toLowerCase();
    return LANGUAGE_LABEL_BY_CODE[saved] || "English";
  });
  const languageCode = LANGUAGE_CODE_BY_LABEL[language] || "en";
  const languages = ["English", "Kannada", "Hindi", "Telugu"];
  const [searchParams] = useSearchParams();
  const [refId, setRefId] = useState(searchParams.get("ref") || "");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showStatus, setShowStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<PublicTrackResponse | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const baseCopy = useMemo(
    () => ({
      backToReporting: "Back to Reporting",
      title: "Track Your Request",
      subtitle: "Enter your reference code and phone number to view real-time response updates.",
      refPlaceholder: "Reference Number (e.g. NCH-AB12CD34)",
      phonePlaceholder: "Phone number used during report submission",
      checking: "Checking...",
      checkStatus: "Check Status",
      errorMissingFields: "Enter both reference number and phone number.",
      errorFetch: "Unable to fetch report status",
      activeResponse: "Active Response",
      referenceCode: "REFERENCE CODE",
      respondingNgo: "RESPONDING NGO",
      realtimeStatus: "REAL-TIME STATUS",
      urgency: "Urgency",
      problem: "Problem",
      mission: "Mission",
      missionNotCreated: "Not created yet",
      responseTimeline: "Response Timeline",
      updatesRealtime: "Updates in real-time",
      latestUpdate: "Latest Update",
      now: "Now",
      worseningNote: "If the situation worsens, submit a new report using the same phone number so coordinators can correlate your updates quickly.",
      emptyHint: "Enter a reference number above to view the live timeline of activity",
      feedbackTitle: "Share Feedback",
      feedbackSubtitle: "Your response is sent directly to the coordinator for this mission and zone.",
      feedbackPlaceholder: "Tell us what worked, what was missing, or what to improve next week.",
      feedbackSubmit: "Submit Feedback",
      feedbackSubmitting: "Submitting...",
      feedbackValidation: "Please write at least a few words before submitting feedback.",
      feedbackSuccess: "Feedback submitted. Thank you for helping improve community broadcasts.",
      footer: "© 2026 NEXUS PROTOCOL · PUBLIC ASSISTANCE PORTAL",
    }),
    []
  );

  const [copy, setCopy] = useState(baseCopy);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(PUBLIC_LANGUAGE_STORAGE_KEY, languageCode);
    }
  }, [languageCode]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (languageCode === "en") {
        if (active) {
          setCopy(baseCopy);
        }
        return;
      }

      try {
        const entries = Object.entries(baseCopy);
        const translated = await translatePublicBatch(
          entries.map(([, value]) => value),
          languageCode,
          "en"
        );

        if (!active) return;

        const next = { ...baseCopy };
        entries.forEach(([key], index) => {
          next[key as keyof typeof baseCopy] = translated[index] || next[key as keyof typeof baseCopy];
        });
        setCopy(next);
      } catch {
        if (active) {
          setCopy(baseCopy);
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [baseCopy, languageCode]);

  const fetchTracking = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await trackCommunityVoiceReport(refId.trim(), phoneNumber.trim());

      if (languageCode !== "en") {
        const eventTexts = response.timeline.map((item) => item.event);
        const descTexts = response.timeline.map((item) => item.description);
        const dynamicTexts = [response.report.category, response.report.urgency, ...eventTexts, ...descTexts];
        const translated = await translatePublicBatch(dynamicTexts, languageCode, "en");

        const category = translated[0] || response.report.category;
        const urgency = translated[1] || response.report.urgency;
        const eventStart = 2;
        const descStart = eventStart + eventTexts.length;

        const translatedTimeline = response.timeline.map((item, index) => ({
          ...item,
          event: translated[eventStart + index] || item.event,
          description: translated[descStart + index] || item.description,
        }));

        setResult({
          ...response,
          report: {
            ...response.report,
            category,
            urgency,
          },
          timeline: translatedTimeline,
        });
      } else {
        setResult(response);
      }

      setShowStatus(true);
      setFeedbackError(null);
      setFeedbackSuccess(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.errorFetch;
      if (languageCode !== "en") {
        try {
          const [translatedMessage] = await translatePublicBatch([message], languageCode, "en");
          setErrorMessage(translatedMessage || message);
        } catch {
          setErrorMessage(message);
        }
      } else {
        setErrorMessage(message);
      }
      setShowStatus(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refId.trim() || !phoneNumber.trim()) {
      setErrorMessage(copy.errorMissingFields);
      return;
    }
    await fetchTracking();
  };

  useEffect(() => {
    if (!showStatus || !result) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void fetchTracking();
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [showStatus, result, refId, phoneNumber, languageCode]);

  const handleSubmitFeedback = async () => {
    const message = feedbackMessage.trim();
    if (message.length < 3) {
      setFeedbackError(copy.feedbackValidation);
      setFeedbackSuccess(null);
      return;
    }

    setFeedbackLoading(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);

    try {
      await submitCommunityVoiceFeedback({
        referenceNumber: refId.trim(),
        phoneNumber: phoneNumber.trim(),
        message,
      });
      setFeedbackMessage("");
      setFeedbackSuccess(copy.feedbackSuccess);
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.errorFetch;
      setFeedbackError(message);
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7FF] flex flex-col font-['Plus_Jakarta_Sans'] p-6">
      <header className="max-w-4xl mx-auto w-full pt-10 pb-16 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <button 
            onClick={() => navigate("/community-voice")}
            className="flex items-center gap-2 text-slate-400 hover:text-[#4F46E5] transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-[11px] font-black uppercase tracking-widest">{copy.backToReporting}</span>
          </button>

          <div className="flex gap-2">
            {languages.map((lang) => (
              <LanguagePill
                key={lang}
                label={lang}
                active={language === lang}
                onClick={() => setLanguage(lang)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-[#1A1A3D]">{copy.title}</h1>
          <p className="text-slate-500 font-medium text-lg">{copy.subtitle}</p>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
           <div className="relative group">
             <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                <Search className="w-6 h-6 text-slate-300 group-focus-within:text-[#4F46E5] transition-colors" />
             </div>
             <Input 
               value={refId}
               onChange={(e) => setRefId(e.target.value)}
               placeholder={copy.refPlaceholder}
               className="h-16 pl-16 pr-6 bg-white border-slate-100 rounded-[2rem] text-lg font-mono font-black placeholder:font-sans placeholder:font-medium placeholder:text-slate-300 shadow-2xl shadow-indigo-500/5 focus:ring-4 focus:ring-indigo-100 transition-all border-2 focus:border-[#4F46E5]"
             />
           </div>
           <div className="relative">
             <Input
               value={phoneNumber}
               onChange={(event) => setPhoneNumber(event.target.value)}
               placeholder={copy.phonePlaceholder}
               className="h-16 px-6 bg-white border-slate-100 rounded-[2rem] text-lg font-bold placeholder:font-medium placeholder:text-slate-300 shadow-2xl shadow-indigo-500/5 focus:ring-4 focus:ring-indigo-100 transition-all border-2 focus:border-[#4F46E5]"
             />
           </div>
           <Button 
             type="submit"
             disabled={!refId || !phoneNumber || loading}
             className="w-full h-14 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-black rounded-2xl shadow-lg ring-offset-0 focus:ring-0 uppercase tracking-widest disabled:opacity-50 disabled:bg-slate-300"
           >
             {loading ? copy.checking : copy.checkStatus}
           </Button>
           {errorMessage && <p className="text-sm font-semibold text-red-600">{errorMessage}</p>}
        </form>
      </header>

      <main className="max-w-4xl mx-auto w-full flex-1 pb-20">
        {showStatus && result ? (
          <div className="grid md:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Status Summary Card */}
            <div className="md:col-span-1 space-y-6">
               <Card className="p-8 rounded-[2.5rem] bg-[#1E1B4B] text-white border-0 shadow-2xl shadow-indigo-900/20 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                     <Shield className="w-24 h-24" />
                  </div>
                  <div className="relative space-y-6">
                    <Badge className="bg-emerald-500 text-white border-none font-bold text-[10px] uppercase tracking-widest px-3 py-1">
                       {copy.activeResponse}
                    </Badge>
                    <div>
                       <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest leading-none mb-2">{copy.referenceCode}</p>
                        <p className="text-3xl font-mono font-black">#{result.referenceNumber}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest leading-none mb-2">{copy.respondingNgo}</p>
                        <p className="text-lg font-bold">{result.ngo.name}</p>
                    </div>
                  </div>
               </Card>

               <div className="p-6 bg-white rounded-3xl border border-slate-100 space-y-4">
                  <div className="flex items-center gap-3">
                     <Activity className="w-4 h-4 text-emerald-500" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{copy.realtimeStatus}</p>
                  </div>
                  <div className="space-y-4">
                     <div className="flex justify-between items-center text-sm font-bold text-[#1A1A3D]">
                      <span className="text-slate-500">{copy.urgency}</span>
                      <span className="text-amber-500">{result.report.urgency}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm font-bold text-[#1A1A3D]">
                      <span className="text-slate-500">{copy.problem}</span>
                      <span>{result.report.category}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold text-[#1A1A3D]">
                     <span className="text-slate-500">{copy.mission}</span>
                     <span>{result.mission.id ? result.mission.status : copy.missionNotCreated}</span>
                     </div>
                  </div>
               </div>
            </div>

            {/* Timeline Area */}
            <div className="md:col-span-2">
               <Card className="p-10 rounded-[2.5rem] bg-white border-slate-100 shadow-xl shadow-indigo-500/5">
                  <div className="mb-10 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-[#1A1A3D]">{copy.responseTimeline}</h2>
                     <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest group cursor-help">
                    {copy.updatesRealtime} <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
                     </div>
                  </div>
                  
                  <div className="relative">
                    {result.timeline.map((item, index) => (
                     <StatusStep
                      key={`${item.event}-${index}`}
                      event={item.event}
                      time={formatTimestamp(item.timestamp, copy.now)}
                      status={item.state}
                      description={item.description}
                      latestLabel={copy.latestUpdate}
                      active={index === result.timeline.length - 1}
                      completed={index !== result.timeline.length - 1}
                     />
                    ))}
                  </div>
                  
                  <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-800 font-medium leading-relaxed">
                      {copy.worseningNote}
                    </p>
                  </div>

                  <div className="mt-6 p-5 bg-[#F8F7FF] border border-indigo-100 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-[#4F46E5]">
                      <MessageSquare className="w-4 h-4" />
                      <p className="text-sm font-bold">{copy.feedbackTitle}</p>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">{copy.feedbackSubtitle}</p>
                    <Textarea
                      value={feedbackMessage}
                      onChange={(event) => setFeedbackMessage(event.target.value)}
                      placeholder={copy.feedbackPlaceholder}
                      className="min-h-[100px] bg-white border-slate-200 text-sm"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs">
                        {feedbackError ? <p className="text-red-600 font-semibold">{feedbackError}</p> : null}
                        {feedbackSuccess ? <p className="text-emerald-600 font-semibold">{feedbackSuccess}</p> : null}
                      </div>
                      <Button
                        type="button"
                        onClick={handleSubmitFeedback}
                        disabled={feedbackLoading || !feedbackMessage.trim()}
                        className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-bold"
                      >
                        {feedbackLoading ? copy.feedbackSubmitting : copy.feedbackSubmit}
                      </Button>
                    </div>
                  </div>
               </Card>
            </div>
          </div>
        ) : (
          <div className="min-h-[400px] flex flex-col items-center justify-center text-center space-y-6">
             <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-slate-200 border border-slate-100 shadow-sm animate-in fade-in zoom-in duration-500">
                <Send className="w-8 h-8" />
             </div>
             <p className="text-slate-400 font-medium max-w-xs uppercase tracking-widest text-[11px]">{copy.emptyHint}</p>
          </div>
        )}
      </main>

      <footer className="p-8 text-center border-t border-slate-50 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
          {copy.footer}
      </footer>
    </div>
  );
};
