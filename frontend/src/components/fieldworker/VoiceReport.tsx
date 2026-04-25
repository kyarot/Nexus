import { API_BASE_URL } from "@/lib/config";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Mic, 
  Square, 
  Sparkles, 
  CheckCircle2, 
  ChevronRight,
  Info,
  MessageSquare,
  Globe,
  Loader2,
  Volume2,
  Database,
  ArrowRight,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPicker } from "@/components/nexus/MapPicker";
import { deriveZoneInfo } from "@/lib/location-utils";
import { fetchWithOutbox } from "@/lib/offline-outbox";

const splitCsv = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

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
  const [reportMode, setReportMode] = useState<"mission_update" | "independent">("independent");
  const [selectedNeedType, setSelectedNeedType] = useState("General");
  const [isMerged, setIsMerged] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [activeMission, setActiveMission] = useState<any | null>(null);
  const languages = ["Kannada", "Hindi", "Telugu", "Tamil", "Bengali", "Marathi", "English"];
  const [isQueued, setIsQueued] = useState(false);

  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);

  const [location, setLocation] = useState({
    lat: 12.9716,
    lng: 77.5946,
    address: "",
    pincode: "",
    areaName: ""
  });

  const [reportMeta, setReportMeta] = useState({
    personsAffected: "0",
    householdRef: "",
    visitType: "first_visit",
    verificationState: "unverified",
    urgencyWindowHours: "24",
    vulnerableGroups: "",
    requiredResources: "",
    riskFlags: "",
    preferredResponderType: "volunteer",
    requiredSkills: "local_language",
    languageNeeds: "kannada",
    safeVisitTimeWindows: "08:00-17:00",
    estimatedEffortMinutes: "60",
    revisitRecommendedAt: "",
  });

  const apiBaseUrl = API_BASE_URL;
  const token = localStorage.getItem("nexus_access_token");

  const mapInitialLocation = useMemo(
    () => ({ lat: location.lat, lng: location.lng }),
    [location.lat, location.lng]
  );

  const handleLocationSelect = useCallback((loc: { lat: number; lng: number; address?: string; pincode?: string; areaName?: string }) => {
    setLocation({
      lat: loc.lat,
      lng: loc.lng,
      address: loc.address || "",
      pincode: loc.pincode || "",
      areaName: loc.areaName || ""
    });
  }, []);

  useEffect(() => {
    const fetchActiveMission = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/fieldworker/mission/active`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        const mission = data?.mission || null;
        setActiveMission(mission);
        if (mission) {
          setReportMode("mission_update");
          setMissionId(mission.id || null);
          setSelectedNeedType(mission.needType || "General");
          setLocation((prev) => ({
            ...prev,
            address: mission.location?.address || prev.address,
            lat: mission.location?.lat ?? prev.lat,
            lng: mission.location?.lng ?? prev.lng,
          }));
        }
      } catch {
        // keep manual location defaults if active mission fetch fails
      }
    };

    fetchActiveMission();
  }, [apiBaseUrl, token]);

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

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setAudioBlob(blob);
        processVoice(blob);
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setStep("recording");
    } catch (err) {
      console.error("Failed to start recording", err);
      alert("Microphone access denied or not available");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  };

  const processVoice = async (blob: Blob) => {
    setStep("processing");
    setError(null);

    const formData = new FormData();
    formData.append("file", blob, "report.wav");
    formData.append("language", language);

    try {
      const response = await fetch(`${apiBaseUrl}/fieldworker/voice`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error("Failed to process voice report");

      const data = await response.json();
      setExtractedData(data.extracted);
      setVoiceUrl(data.voiceUrl);
      setSelectedNeedType(data.extracted?.needType || activeMission?.needType || "General");
      
      // Update location address if AI found something
      if (data.extracted.location) {
        setLocation(prev => ({ ...prev, address: data.extracted.location }));
      }

      const families = Number(data.extracted?.familiesAffected || 0);
      const primaryIncident = Array.isArray(data.extracted?.needIncidents) && data.extracted.needIncidents.length > 0
        ? data.extracted.needIncidents[0]
        : null;

      setReportMeta({
        personsAffected: String(data.extracted?.personsAffected || families * 4 || 0),
        householdRef: data.extracted?.householdRef || "",
        visitType: data.extracted?.visitType || "first_visit",
        verificationState: data.extracted?.verificationState || "unverified",
        urgencyWindowHours: String(primaryIncident?.urgencyWindowHours || (data.extracted?.severity === "high" || data.extracted?.severity === "critical" ? 24 : 72)),
        vulnerableGroups: Array.isArray(primaryIncident?.vulnerableGroups) ? primaryIncident.vulnerableGroups.join(", ") : "",
        requiredResources: Array.isArray(primaryIncident?.requiredResources)
          ? primaryIncident.requiredResources.map((r: any) => `${r.name}:${r.quantity}:${r.priority || "medium"}`).join(", ")
          : "",
        riskFlags: Array.isArray(primaryIncident?.riskFlags)
          ? primaryIncident.riskFlags.join(", ")
          : Array.isArray(data.extracted?.safetySignals) ? data.extracted.safetySignals.join(", ") : "",
        preferredResponderType: data.extracted?.preferredResponderType || "volunteer",
        requiredSkills: Array.isArray(data.extracted?.requiredSkills) ? data.extracted.requiredSkills.join(", ") : "local_language",
        languageNeeds: Array.isArray(data.extracted?.languageNeeds) ? data.extracted.languageNeeds.join(", ") : "kannada",
        safeVisitTimeWindows: Array.isArray(data.extracted?.safeVisitTimeWindows) ? data.extracted.safeVisitTimeWindows.join(", ") : "08:00-17:00",
        estimatedEffortMinutes: String(data.extracted?.estimatedEffortMinutes || 60),
        revisitRecommendedAt: data.extracted?.revisitRecommendedAt ? String(data.extracted.revisitRecommendedAt).slice(0, 16) : "",
      });
      
      setStep("result");
    } catch (err: any) {
      setError(err.message);
      setStep("idle");
    }
  };

  const handleSubmit = async () => {
    setStep("processing");

    const zoneInfo = deriveZoneInfo({
      lat: location.lat,
      lng: location.lng,
      address: location.address,
      pincode: location.pincode,
      areaName: location.areaName,
    });
    
    const needType = reportMode === "mission_update"
      ? (activeMission?.needType || selectedNeedType || extractedData?.needType || "General")
      : (selectedNeedType || extractedData?.needType || "General");
    const severity = (extractedData?.severity || "medium").toLowerCase();
    const familiesAffected = parseInt(extractedData?.familiesAffected || "0", 10) || 0;
    const personsAffected = parseInt(reportMeta.personsAffected || "0", 10) > 0
      ? parseInt(reportMeta.personsAffected || "0", 10)
      : Number(extractedData?.personsAffected) > 0
      ? Number(extractedData.personsAffected)
      : familiesAffected * 4;
    const safetySignals = splitCsv(reportMeta.riskFlags || "");
    const requiredResourceName = `${String(needType).toLowerCase().replace(/\s+/g, "-")}-support`;
    const requiredResources = splitCsv(reportMeta.requiredResources).map((item) => {
      const [name, quantity, priority] = item.split(":").map((part) => part.trim());
      return {
        name: name || requiredResourceName,
        quantity: Number(quantity) > 0 ? Number(quantity) : familiesAffected,
        priority: ["low", "medium", "high", "critical"].includes((priority || "").toLowerCase())
          ? (priority || "medium").toLowerCase()
          : severity,
      };
    });

    const payload = {
      missionId: reportMode === "mission_update" ? (activeMission?.id || null) : null,
      zoneId: reportMode === "mission_update" ? (activeMission?.zoneId || zoneInfo.zoneId) : zoneInfo.zoneId,
      needType,
      familiesAffected,
      personsAffected,
      location: {
        lat: location.lat || 12.9716,
        lng: location.lng || 77.5946,
        address: location.address || zoneInfo.zoneLabel,
        landmark: location.address || zoneInfo.zoneLabel,
      },
      sourceType: "voice",
      householdRef: reportMeta.householdRef || extractedData?.householdRef || null,
      visitType: reportMeta.visitType || "first_visit",
      verificationState: reportMeta.verificationState || "unverified",
      needIncidents: (extractedData?.needIncidents && extractedData.needIncidents.length > 0)
        ? [{
            ...extractedData.needIncidents[0],
            needType: String(needType).toLowerCase(),
            severity,
            urgencyWindowHours: parseInt(reportMeta.urgencyWindowHours || "24", 10) || 24,
            familiesAffected,
            personsAffected,
            vulnerableGroups: splitCsv(reportMeta.vulnerableGroups),
            requiredResources: requiredResources.length > 0
              ? requiredResources
              : extractedData.needIncidents[0]?.requiredResources || [],
            riskFlags: safetySignals,
          }]
        : [{
            needType: String(needType).toLowerCase(),
            severity,
            urgencyWindowHours: parseInt(reportMeta.urgencyWindowHours || "24", 10) || (severity === "high" || severity === "critical" ? 24 : 72),
            familiesAffected,
            personsAffected,
            vulnerableGroups: splitCsv(reportMeta.vulnerableGroups),
            requiredResources: requiredResources.length > 0
              ? requiredResources
              : familiesAffected > 0
              ? [{ name: requiredResourceName, quantity: familiesAffected, priority: severity }]
              : [],
            riskFlags: safetySignals,
          }],
      preferredResponderType: reportMeta.preferredResponderType || "volunteer",
      requiredSkills: splitCsv(reportMeta.requiredSkills),
      languageNeeds: splitCsv(reportMeta.languageNeeds),
      safeVisitTimeWindows: splitCsv(reportMeta.safeVisitTimeWindows),
      estimatedEffortMinutes: parseInt(reportMeta.estimatedEffortMinutes || "60", 10) || 60,
      revisitRecommendedAt: reportMeta.revisitRecommendedAt ? new Date(reportMeta.revisitRecommendedAt).toISOString() : null,
      voiceUrl: voiceUrl,
      transcript: extractedData?.transcript,
      transcriptEnglish: extractedData?.transcriptEnglish,
      extractedData: extractedData,
      confidence: extractedData?.confidence || 90,
      safetySignals,
      landmark: extractedData?.landmark || location.address || null,
      additionalNotes: extractedData?.additionalNotes || null,
      fieldConfidences: extractedData?.fieldConfidences || null
    };

    try {
      setIsQueued(false);
      const { response, queued } = await fetchWithOutbox(`${apiBaseUrl}/fieldworker/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (queued) {
        setIsQueued(true);
        setIsMerged(false);
        setReportId(queued.outboxId);
        setMissionId(null);
        setStep("submitted");
        return;
      }

      if (!response?.ok) throw new Error("Failed to submit report");

      const data = await response.json();
      setIsMerged(data.merged);
      setReportId(data.reportId || null);
      setMissionId(data.missionId || null);
      setStep("submitted");
    } catch (err: any) {
      setError(err.message);
      setStep("result");
    }
  };

  if (step === "submitted") {
    return (
      <div className="flex-1 flex items-center justify-center p-10 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[600px] animate-in fade-in zoom-in duration-500 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-[#5A57FF]" />
        <div className="max-w-md w-full text-center space-y-8">
           <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-bounce" />
           </div>
           <div className="space-y-2">
              <h2 className="text-3xl font-bold text-[#1A1A3D]">
                {isMerged ? "Report added to active mission!" : isQueued ? "Report queued" : "Voice Report Submitted!"}
              </h2>
              <p className="text-slate-500 font-medium">
                {isMerged
                  ? "Your report has been transcribed and linked to an ongoing mission."
                  : isQueued
                  ? "Will sync automatically when you are back online."
                  : "Your report has been transcribed and synced."}
              </p>
           </div>

           {isMerged ? (
             <div className="bg-[#EEF2FF] border border-indigo-100 rounded-2xl p-6 text-left space-y-4">
                <div className="flex gap-3">
                  <Database className="w-5 h-5 text-[#3730A3] shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-[#3730A3] leading-relaxed">
                    Your report was automatically merged into <span className="font-bold">mission {missionId || "active mission"}</span>.
                  </p>
                </div>
                <p className="text-[11px] text-[#3730A3]/70 font-bold uppercase tracking-wider pl-8">
                  The mission coordinator has received this update
                </p>
             </div>
           ) : (
             <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3 text-left">
               <Database className="w-5 h-5 text-emerald-600" />
               <div>
                 <p className="text-sm font-bold text-emerald-900">{isQueued ? "Queued for sync" : "Syncing to Nexus..."}</p>
                 <p className="text-[10px] text-emerald-700/70 font-bold uppercase tracking-widest">Voice ID: {reportId || "Pending"}</p>
               </div>
             </div>
           )}
           
           <div className="space-y-3 pt-6">
              {isMerged && (
                <Button 
                  variant="ghost"
                  className="w-full h-14 text-[#5A57FF] font-bold border border-indigo-100 hover:bg-indigo-50 rounded-2xl"
                >
                  View mission {missionId || "details"} →
                </Button>
              )}
              <Button onClick={() => setStep("idle")} className="w-full h-14 bg-[#5A57FF] rounded-2xl font-bold flex gap-2 justify-center group">
                New Recording <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="ghost" onClick={onGoToDashboard} className="w-full h-14 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl">
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
                       "{extractedData?.transcript || 'No transcription available'}"
                    </p>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-left space-y-2">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identified Issue</p>
                       <p className="text-sm font-bold text-[#1A1A3D]">{selectedNeedType || extractedData?.needType || "General Issue"}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-left space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mapped Zone</p>
                      <p className="text-sm font-bold text-[#1A1A3D]">{deriveZoneInfo(location).zoneLabel}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 text-left">
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs font-bold text-slate-500">Report Option</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={reportMode === "mission_update" ? "default" : "outline"}
                          className="h-10 rounded-xl text-xs"
                          disabled={!activeMission?.id}
                          onClick={() => {
                            if (!activeMission?.id) return;
                            setReportMode("mission_update");
                            if (activeMission?.needType) {
                              setSelectedNeedType(activeMission.needType);
                            }
                          }}
                        >
                          Assigned mission
                        </Button>
                        <Button
                          type="button"
                          variant={reportMode === "independent" ? "default" : "outline"}
                          className="h-10 rounded-xl text-xs"
                          onClick={() => setReportMode("independent")}
                        >
                          Submit other report
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Need Type</Label>
                      <Select
                        value={selectedNeedType}
                        onValueChange={setSelectedNeedType}
                        disabled={reportMode === "mission_update" && Boolean(activeMission?.needType)}
                      >
                        <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="General">General</SelectItem>
                          <SelectItem value="Food Insecurity">Food Insecurity</SelectItem>
                          <SelectItem value="Sanitation">Sanitation</SelectItem>
                          <SelectItem value="Medical Aid">Medical Aid</SelectItem>
                          <SelectItem value="Housing">Housing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {reportMode === "mission_update" && activeMission?.id ? (
                      <p className="text-[11px] text-indigo-700 font-medium md:col-span-2">
                        This report will follow mission need type: {activeMission.needType || "General"}.
                      </p>
                    ) : (
                      <p className="text-[11px] text-indigo-700 font-medium md:col-span-2">
                        This report will be submitted as a separate need report and can use a different need type.
                      </p>
                    )}
                 </div>

                 <div className="w-full h-44 rounded-[2rem] overflow-hidden border border-slate-100 relative shadow-inner group">
                    <MapPicker
                      initialLocation={mapInitialLocation}
                      onLocationSelect={handleLocationSelect}
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Persons Affected</Label>
                      <Input type="number" value={reportMeta.personsAffected} onChange={(e) => setReportMeta((prev) => ({ ...prev, personsAffected: e.target.value }))} className="h-10 rounded-xl bg-white border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Household Ref</Label>
                      <Input value={reportMeta.householdRef} onChange={(e) => setReportMeta((prev) => ({ ...prev, householdRef: e.target.value }))} className="h-10 rounded-xl bg-white border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Visit Type</Label>
                      <Select value={reportMeta.visitType} onValueChange={(val) => setReportMeta((prev) => ({ ...prev, visitType: val }))}>
                        <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="first_visit">first_visit</SelectItem>
                          <SelectItem value="follow_up">follow_up</SelectItem>
                          <SelectItem value="revisit">revisit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Verification</Label>
                      <Select value={reportMeta.verificationState} onValueChange={(val) => setReportMeta((prev) => ({ ...prev, verificationState: val }))}>
                        <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unverified">unverified</SelectItem>
                          <SelectItem value="verified">verified</SelectItem>
                          <SelectItem value="rejected">rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Urgency Hours</Label>
                      <Input type="number" value={reportMeta.urgencyWindowHours} onChange={(e) => setReportMeta((prev) => ({ ...prev, urgencyWindowHours: e.target.value }))} className="h-10 rounded-xl bg-white border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Preferred Responder</Label>
                      <Select value={reportMeta.preferredResponderType} onValueChange={(val) => setReportMeta((prev) => ({ ...prev, preferredResponderType: val }))}>
                        <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="volunteer">volunteer</SelectItem>
                          <SelectItem value="ngo_staff">ngo_staff</SelectItem>
                          <SelectItem value="mixed">mixed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-xs font-bold text-slate-500">Risk Flags</Label>
                      <Input value={reportMeta.riskFlags} onChange={(e) => setReportMeta((prev) => ({ ...prev, riskFlags: e.target.value }))} placeholder="night_safety, road_blocked" className="h-10 rounded-xl bg-white border-slate-200" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-xs font-bold text-slate-500">Required Resources (name:qty:priority)</Label>
                      <Input value={reportMeta.requiredResources} onChange={(e) => setReportMeta((prev) => ({ ...prev, requiredResources: e.target.value }))} placeholder="rice-kit:34:high" className="h-10 rounded-xl bg-white border-slate-200" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-xs font-bold text-slate-500">Required Skills</Label>
                      <Input value={reportMeta.requiredSkills} onChange={(e) => setReportMeta((prev) => ({ ...prev, requiredSkills: e.target.value }))} placeholder="local_language, ration_distribution" className="h-10 rounded-xl bg-white border-slate-200" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-xs font-bold text-slate-500">Language Needs</Label>
                      <Input value={reportMeta.languageNeeds} onChange={(e) => setReportMeta((prev) => ({ ...prev, languageNeeds: e.target.value }))} className="h-10 rounded-xl bg-white border-slate-200" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-xs font-bold text-slate-500">Safe Visit Windows</Label>
                      <Input value={reportMeta.safeVisitTimeWindows} onChange={(e) => setReportMeta((prev) => ({ ...prev, safeVisitTimeWindows: e.target.value }))} className="h-10 rounded-xl bg-white border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Effort Minutes</Label>
                      <Input type="number" value={reportMeta.estimatedEffortMinutes} onChange={(e) => setReportMeta((prev) => ({ ...prev, estimatedEffortMinutes: e.target.value }))} className="h-10 rounded-xl bg-white border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Revisit At</Label>
                      <Input type="datetime-local" value={reportMeta.revisitRecommendedAt} onChange={(e) => setReportMeta((prev) => ({ ...prev, revisitRecommendedAt: e.target.value }))} className="h-10 rounded-xl bg-white border-slate-200" />
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
            <p className="text-[10px] font-black text-[#5A57FF] uppercase tracking-widest">Reporting Guidance</p>
           <p className="text-xs text-slate-500 font-medium italic leading-relaxed">
              Record concise context: location, affected families, urgency, and any access or safety constraints.
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