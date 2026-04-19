import React, { useEffect, useMemo, useRef, useState } from "react";
import { 
  Globe, 
  Phone, 
  MapPin, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft,
  ArrowRight,
  Mic,
  MicOff,
  Shield,
  MessageSquare,
  Package,
  Droplets,
  HeartPulse,
  Flame,
  UserPlus
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { submitCommunityVoiceReport, type PublicReportSubmitResponse } from "@/lib/public-api";
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

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

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
      "flex-1 p-3 rounded-xl border-2 text-left transition-all",
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
    <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1",
      active ? (level === "Critical" ? "text-red-700" : level === "High" ? "text-amber-700" : "text-blue-700") : "text-slate-400"
    )}>{label}</p>
    <p className="text-[9px] text-slate-500 font-medium leading-tight">{description}</p>
  </button>
);

const CategoryCard = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all",
      active 
        ? "bg-indigo-50 border-[#4F46E5] shadow-sm" 
        : "bg-white border-slate-100 hover:border-slate-200"
    )}
  >
    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", active ? "bg-[#4F46E5] text-white" : "bg-slate-50 text-slate-400")}>
      <Icon className="w-4 h-4" />
    </div>
    <span className={cn("text-[9px] font-bold uppercase tracking-wider", active ? "text-[#4F46E5]" : "text-slate-500")}>{label}</span>
  </button>
);

export const CommunityVoice = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "success">("form");
  const [language, setLanguage] = useState(() => {
    if (typeof window === "undefined") return "English";
    const saved = (localStorage.getItem(PUBLIC_LANGUAGE_STORAGE_KEY) || "en").toLowerCase();
    return LANGUAGE_LABEL_BY_CODE[saved] || "English";
  });
  const [urgency, setUrgency] = useState("High");
  const [category, setCategory] = useState("Food");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [problemText, setProblemText] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [lat, setLat] = useState<number>(12.9716);
  const [lng, setLng] = useState<number>(77.5946);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [speechMessage, setSpeechMessage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [submitResult, setSubmitResult] = useState<PublicReportSubmitResponse | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const baseCopy = useMemo(
    () => ({
      back: "Back",
      headerTitle: "NEXUS Community",
      headerSubtitle: "Voice & Reporting Channel",
      reportTitle: "Report a Problem",
      reportSubtitle: "Tell us what's happening in your area. Help is on the way.",
      phoneLabel: "Your Phone Number",
      phonePlaceholder: "+91-0000000000",
      situationLabel: "What's the situation?",
      useCurrentLocation: "Use current location",
      voiceInput: "Use microphone",
      stopVoiceInput: "Stop recording",
      voiceListening: "Listening... speak now.",
      voiceCaptured: "Speech converted to text.",
      voiceUnsupported: "Speech input is not supported on this browser.",
      voiceError: "Could not capture speech. Please try again.",
      voiceStopped: "Recording stopped.",
      addressPlaceholder: "Address / area / landmark",
      landmarkPlaceholder: "Landmark (optional)",
      coordinates: "Coordinates",
      issuePlaceholder: "Describe the issue, location details, and number of people affected...",
      problemCategory: "Problem Category",
      urgencyLevel: "Urgency Level",
      critical: "Critical",
      criticalDesc: "Immediate danger",
      high: "High",
      highDesc: "Needs quick action",
      normal: "Normal",
      normalDesc: "Standard request",
      submit: "Send Assistance Request",
      submitting: "Submitting...",
      verification: "Your report is verified with phone + reference for secure tracking",
      locationNotSupported: "Location is not supported on this device.",
      locationCaptured: "Current location captured.",
      locationUnavailable: "Unable to access your current location. Enter address manually.",
      errorPhone: "Please enter your phone number.",
      errorProblem: "Please describe the problem in at least 10 characters.",
      errorAddress: "Please provide address/location details.",
      errorSubmit: "Failed to submit report",
      reportReceivedTitle: "Report Received!",
      reportReceivedTextPrefix: "Thank you. Your report has been routed to",
      assignedNgoFallback: "assigned NGO",
      referenceLabel: "YOUR REFERENCE NUMBER",
      referenceHint: "Use this reference and your phone number to track status.",
      trackStatus: "Track Status",
      submitNewReport: "Submit New Report",
      food: "Food",
      water: "Water",
      health: "Health",
      fireDanger: "Fire/DANGER",
      safety: "Safety",
      other: "Other",
      privacy: "Privacy",
      emergencyContacts: "Emergency Contacts",
      about: "About",
      securedBy: "Secured by NEXUS Protocol",
    }),
    []
  );

  const [copy, setCopy] = useState(baseCopy);

  const languages = ["English", "Kannada", "Hindi", "Telugu"];
  const categories = [
    { icon: Package, value: "Food", labelKey: "food" as const },
    { icon: Droplets, value: "Water", labelKey: "water" as const },
    { icon: HeartPulse, value: "Health", labelKey: "health" as const },
    { icon: Flame, value: "Fire/DANGER", labelKey: "fireDanger" as const },
    { icon: Shield, value: "Safety", labelKey: "safety" as const },
    { icon: UserPlus, value: "Other", labelKey: "other" as const }
  ];

  const languageCode = LANGUAGE_CODE_BY_LABEL[language] || "en";
  const speechLocale = useMemo(() => {
    if (languageCode === "kn") return "kn-IN";
    if (languageCode === "hi") return "hi-IN";
    if (languageCode === "te") return "te-IN";
    return "en-IN";
  }, [languageCode]);

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

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = speechLocale;
    }
  }, [speechLocale]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // No-op on cleanup.
        }
      }
    };
  }, []);

  const getSpeechRecognitionConstructor = () => {
    if (typeof window === "undefined") return null;
    const speechWindow = window as Window & {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };

    return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
  };

  const handleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setSpeechMessage(copy.voiceStopped);
      return;
    }

    const RecognitionCtor = getSpeechRecognitionConstructor();
    if (!RecognitionCtor) {
      setSpeechMessage(copy.voiceUnsupported);
      return;
    }

    const recognition = recognitionRef.current || new RecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = speechLocale;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || [])
        .map((chunk) => chunk?.[0]?.transcript || "")
        .join(" ")
        .trim();

      if (!transcript) {
        return;
      }

      setProblemText((previous) => {
        const base = previous.trim();
        return base ? `${base} ${transcript}` : transcript;
      });
      setSpeechMessage(copy.voiceCaptured);
    };

    recognition.onerror = () => {
      setSpeechMessage(copy.voiceError);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    try {
      setSpeechMessage(copy.voiceListening);
      setIsListening(true);
      recognition.start();
    } catch {
      setSpeechMessage(copy.voiceError);
      setIsListening(false);
    }
  };

  const handleUseCurrentLocation = () => {
    setLocationMessage(null);
    if (!navigator.geolocation) {
      setLocationMessage(copy.locationNotSupported);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setLocationMessage(copy.locationCaptured);
      },
      () => {
        setLocationMessage(copy.locationUnavailable);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!phoneNumber.trim()) {
      setErrorMessage(copy.errorPhone);
      return;
    }
    if (!problemText.trim() || problemText.trim().length < 10) {
      setErrorMessage(copy.errorProblem);
      return;
    }
    if (!address.trim()) {
      setErrorMessage(copy.errorAddress);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await submitCommunityVoiceReport({
        phoneNumber,
        problemText,
        category,
        urgencyLevel: urgency,
        language: languageCode,
        location: {
          lat,
          lng,
          address,
          landmark: landmark || undefined,
        },
      });
      setSubmitResult(response);
      setStep("success");
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.errorSubmit;
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep("form");
    setProblemText("");
    setAddress("");
    setLandmark("");
    setUrgency("High");
    setCategory("Food");
    setErrorMessage(null);
    setSubmitResult(null);
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-[#F8F7FF] flex flex-col items-center justify-center p-6 font-['Plus_Jakarta_Sans']">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-2xl shadow-indigo-500/10 border border-slate-100 text-center space-y-8 animate-in fade-in zoom-in duration-500">
           <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
           </div>
           <div className="space-y-3">
                <h2 className="text-3xl font-bold text-[#1A1A3D]">{copy.reportReceivedTitle}</h2>
                <p className="text-slate-500 font-medium">{copy.reportReceivedTextPrefix} <span className="font-bold text-[#1A1A3D]">{submitResult?.ngo.name || copy.assignedNgoFallback}</span>.</p>
           </div>
           
           <div className="bg-slate-50 rounded-2xl p-6 space-y-2 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{copy.referenceLabel}</p>
              <p className="text-4xl font-mono font-black text-[#4F46E5]">#{submitResult?.referenceNumber || "N/A"}</p>
                <p className="text-[11px] text-slate-400 font-medium">{copy.referenceHint}</p>
           </div>

           <div className="space-y-3">
              <Button 
                onClick={() => navigate(`/community-voice/track?ref=${encodeURIComponent(submitResult?.referenceNumber || "")}`)}
                variant="outline"
                className="w-full h-14 border-slate-200 text-slate-600 font-bold rounded-2xl"
              >
                {copy.trackStatus}
              </Button>
              <Button 
                onClick={resetForm}
                className="w-full h-14 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white font-bold rounded-2xl shadow-lg ring-offset-2 focus:ring-2 ring-indigo-500"
              >
                {copy.submitNewReport}
              </Button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#F8F7FF] flex flex-col font-['Plus_Jakarta_Sans']">
      {/* Header */}
      <header className="py-4 px-6 flex flex-col md:flex-row items-center justify-between gap-4 max-w-7xl mx-auto w-full shrink-0">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="h-10 px-3 text-slate-500 hover:text-[#4F46E5]"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> {copy.back}
          </Button>
          <div className="w-10 h-10 bg-[#4F46E5] rounded-xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/30">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1A1A3D] uppercase tracking-tighter">{copy.headerTitle}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{copy.headerSubtitle}</p>
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
      <main className="flex-1 px-4 pb-3 sm:px-6 min-h-0 flex items-stretch justify-center w-full overflow-hidden">
        <Card className="max-w-6xl w-full h-full rounded-[2rem] p-5 md:p-6 shadow-2xl shadow-indigo-500/5 border-slate-100 animate-in fade-in slide-in-from-bottom-8 duration-700 overflow-hidden flex flex-col gap-4">
           
           <div className="space-y-2 shrink-0">
            <h2 className="text-2xl font-bold text-[#1A1A3D]">{copy.reportTitle}</h2>
            <p className="text-sm text-slate-500 font-medium">{copy.reportSubtitle}</p>
           </div>

          <div className="grid md:grid-cols-2 gap-4 md:gap-5 flex-1 min-h-0">
            <div className="flex flex-col gap-4 min-h-0 h-full">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#4F46E5]" />
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{copy.phoneLabel}</label>
                </div>
                <Input
                 type="tel"
                 placeholder={copy.phonePlaceholder}
                 value={phoneNumber}
                 onChange={(event) => setPhoneNumber(event.target.value)}
                 className="h-12 bg-slate-50 border-slate-100 rounded-xl text-base font-bold focus:bg-white transition-all shadow-inner"
                />
              </div>

              <div className="space-y-2 min-h-0 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#4F46E5]" />
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{copy.situationLabel}</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                     variant="ghost"
                     type="button"
                     onClick={handleUseCurrentLocation}
                     className="h-fit py-0 text-[10px] font-black text-[#4F46E5] uppercase tracking-widest"
                    >
                      <MapPin className="w-3 h-3 mr-1" /> {copy.useCurrentLocation}
                    </Button>
                    <Button
                     variant="ghost"
                     type="button"
                     onClick={handleVoiceInput}
                     className="h-fit py-0 text-[10px] font-black text-[#4F46E5] uppercase tracking-widest"
                    >
                      {isListening ? <MicOff className="w-3 h-3 mr-1" /> : <Mic className="w-3 h-3 mr-1" />}
                      {isListening ? copy.stopVoiceInput : copy.voiceInput}
                    </Button>
                  </div>
                </div>

                <Input
                 placeholder={copy.addressPlaceholder}
                 value={address}
                 onChange={(event) => setAddress(event.target.value)}
                 className="h-11 bg-slate-50 border-slate-100 rounded-xl text-sm font-medium focus:bg-white transition-all shadow-inner"
                />
                <Input
                 placeholder={copy.landmarkPlaceholder}
                 value={landmark}
                 onChange={(event) => setLandmark(event.target.value)}
                 className="h-11 bg-slate-50 border-slate-100 rounded-xl text-sm font-medium focus:bg-white transition-all shadow-inner"
                />
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                 {copy.coordinates}: {lat.toFixed(5)}, {lng.toFixed(5)}
                </p>
                {locationMessage && <p className="text-[10px] font-semibold text-[#4F46E5]">{locationMessage}</p>}
                <Textarea
                 placeholder={copy.issuePlaceholder}
                 value={problemText}
                 onChange={(event) => setProblemText(event.target.value)}
                 className="min-h-[140px] flex-1 bg-slate-50 border-slate-100 rounded-xl p-4 text-sm font-medium focus:bg-white transition-all shadow-inner resize-none"
                />
                {speechMessage && <p className="text-[10px] font-semibold text-[#4F46E5]">{speechMessage}</p>}
              </div>
            </div>

            <div className="flex flex-col gap-4 min-h-0 h-full">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{copy.problemCategory}</label>
                <div className="grid grid-cols-3 gap-2">
                 {categories.map(cat => (
                  <CategoryCard
                    key={cat.value}
                    icon={cat.icon}
                    label={copy[cat.labelKey]}
                    active={category === cat.value}
                    onClick={() => setCategory(cat.value)}
                  />
                 ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#4F46E5]" />
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{copy.urgencyLevel}</label>
                </div>
                <div className="flex gap-2">
                  <UrgencyCard
                    level="Life Threatening"
                    label={copy.critical}
                    description={copy.criticalDesc}
                    active={urgency === "Critical"}
                    onClick={() => setUrgency("Critical")}
                  />
                  <UrgencyCard
                    level="Urgent"
                    label={copy.high}
                    description={copy.highDesc}
                    active={urgency === "High"}
                    onClick={() => setUrgency("High")}
                  />
                  <UrgencyCard
                    level="Routine"
                    label={copy.normal}
                    description={copy.normalDesc}
                    active={urgency === "Normal"}
                    onClick={() => setUrgency("Normal")}
                  />
                </div>
              </div>

              <div className="mt-auto space-y-3">
                <Button
                 onClick={handleSubmit}
                 disabled={isSubmitting}
                 className="w-full h-14 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:opacity-90 text-white text-base font-black rounded-xl shadow-xl shadow-indigo-500/20 group uppercase tracking-widest"
                >
                 {isSubmitting ? copy.submitting : copy.submit}
                 {!isSubmitting && <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                </Button>

                <Button
                 type="button"
                 variant="outline"
                 onClick={() => navigate("/community-voice/track")}
                 className="w-full h-12 border-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  {copy.trackStatus}
                </Button>

                {errorMessage && (
                 <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-xs text-red-700 font-semibold">{errorMessage}</p>
                 </div>
                )}

                <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest">
                  {copy.verification}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="py-3 px-6 text-center border-t border-slate-100 shrink-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">{copy.securedBy}</p>
        <div className="flex justify-center gap-4">
          <a href="#" className="text-[9px] font-black text-slate-500 hover:text-[#4F46E5] uppercase tracking-widest transition-colors">{copy.privacy}</a>
          <a href="#" className="text-[9px] font-black text-slate-500 hover:text-[#4F46E5] uppercase tracking-widest transition-colors">{copy.emergencyContacts}</a>
          <a href="#" className="text-[9px] font-black text-slate-500 hover:text-[#4F46E5] uppercase tracking-widest transition-colors">{copy.about}</a>
         </div>
      </footer>
    </div>
  );
};
