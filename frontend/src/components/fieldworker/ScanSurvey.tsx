import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Camera, 
  Upload, 
  X, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  ChevronRight,
  Database,
  ArrowRight,
  FileText,
  Calendar,
  Layers,
  Search,
  Navigation
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPicker } from "@/components/nexus/MapPicker";
import { deriveZoneInfo } from "@/lib/location-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

const MAX_SCAN_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_SCAN_MIMES = new Set(["image/png", "image/jpeg", "application/pdf"]);

const extractPincode = (text?: string | null): string => {
  if (!text) return "";
  const match = text.match(/\b\d{6}\b/);
  return match ? match[0] : "";
};

const splitCsv = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const ConfidenceDot = ({ level }: { level: "high" | "low" }) => (
  <div className={cn(
    "w-2 h-2 rounded-full",
    level === "high" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
  )} />
);

export const ScanSurvey = ({ onGoToDashboard }: { onGoToDashboard: () => void }) => {
  const [step, setStep] = useState<"idle" | "processing" | "success" | "submitted">( "idle");
  const [reportMode, setReportMode] = useState<"mission_update" | "independent">("independent");
  const [image, setImage] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [processingSteps, setProcessingSteps] = useState([
    { label: "Image quality check", status: "pending" },
    { label: "Text detected", status: "pending" },
    { label: "Structuring fields...", status: "pending" },
    { label: "Identifying need type...", status: "pending" },
  ]);

  const [formData, setFormData] = useState({
    needType: "General",
    severity: "Medium",
    families: "0",
    persons: "0",
    zone: "",
    address: "",
    pincode: "",
    notes: "",
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
    surveyDate: new Date().toISOString().split('T')[0],
    lat: 12.9716,
    lng: 77.5946,
    areaName: ""
  });

  const [extractedResult, setExtractedResult] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
  const token = localStorage.getItem("nexus_access_token");

  const [isMerged, setIsMerged] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [activeMission, setActiveMission] = useState<any | null>(null);
  const [detectedLocation, setDetectedLocation] = useState<string>("");

  const mapInitialLocation = useMemo(
    () => ({ lat: formData.lat, lng: formData.lng }),
    [formData.lat, formData.lng]
  );

  const handleLocationSelect = useCallback((loc: { lat: number; lng: number; address?: string; pincode?: string; areaName?: string }) => {
    setFormData((f) => {
      const zoneInfo = deriveZoneInfo({
        lat: loc.lat,
        lng: loc.lng,
        address: loc.address || f.address,
        pincode: loc.pincode || f.pincode,
        areaName: loc.areaName || f.areaName,
      });

      return {
        ...f,
        lat: loc.lat,
        lng: loc.lng,
        address: loc.address || f.address,
        pincode: loc.pincode || f.pincode,
        areaName: loc.areaName || f.areaName,
        zone: zoneInfo.zoneLabel,
      };
    });
  }, []);

  useEffect(() => {
    const fetchActiveMission = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/fieldworker/mission/active`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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
          setFormData((prev) => ({
            ...prev,
            needType: mission.needType || prev.needType,
            zone: mission.zoneName || mission.zoneId || prev.zone,
            address: mission.location?.address || prev.address,
            lat: mission.location?.lat ?? prev.lat,
            lng: mission.location?.lng ?? prev.lng,
          }));
        }
      } catch {
        // keep current form defaults if active mission is unavailable
      }
    };

    fetchActiveMission();
  }, [apiBaseUrl, token]);

  const startProcessing = async (file: File) => {
    setSelectedFileName(file.name || "survey-upload");
    setStep("processing");
    setProgress(0);
    setIsUploading(true);
    setError(null);

    const zoneInfo = deriveZoneInfo({
      lat: formData.lat,
      lng: formData.lng,
      address: formData.address,
      pincode: formData.pincode,
      areaName: formData.areaName,
    });

    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("zoneId", activeMission?.zoneId || zoneInfo.zoneId);
    uploadFormData.append("language", "en");

    // Start a fake progress for UI
    const progressInterval = setInterval(() => {
      setProgress(prev => (prev < 90 ? prev + 5 : prev));
    }, 200);

    try {
      const response = await fetch(`${apiBaseUrl}/fieldworker/scan`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: uploadFormData
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.detail || "Failed to process scan");
      }

      const data = await response.json();
      clearInterval(progressInterval);
      setProgress(100);
      
      setExtractedResult(data.extracted);
      setImageUrl(data.imageUrl);
      setDetectedLocation(data.extracted?.location || "");

      const detectedAddress = String(data.extracted?.location || "").trim();
      const detectedPincode = extractPincode(detectedAddress);
      const missionAddress = String(activeMission?.location?.address || "").trim();
      const resolvedAddress = missionAddress || detectedAddress || "";
      const resolvedPincode = extractPincode(missionAddress) || detectedPincode || "";
      
      // Update form data with extracted results
      const primaryIncident = Array.isArray(data.extracted?.needIncidents) && data.extracted.needIncidents.length > 0
        ? data.extracted.needIncidents[0]
        : null;

      setFormData((prev) => ({
        needType: data.extracted.needType || "General",
        severity: data.extracted.severity ? (data.extracted.severity.charAt(0).toUpperCase() + data.extracted.severity.slice(1)) : "Medium",
        families: String(data.extracted.familiesAffected || "0"),
        persons: String(data.extracted.personsAffected || (Number(data.extracted.familiesAffected || 0) * 4) || "0"),
        zone: prev.zone,
        address: resolvedAddress || prev.address,
        pincode: resolvedPincode || prev.pincode,
        notes: data.extracted.additionalNotes || "",
        householdRef: data.extracted.householdRef || "",
        visitType: data.extracted.visitType || "first_visit",
        verificationState: data.extracted.verificationState || "unverified",
        urgencyWindowHours: String(primaryIncident?.urgencyWindowHours || (data.extracted.severity === "high" || data.extracted.severity === "critical" ? 24 : 72)),
        vulnerableGroups: Array.isArray(primaryIncident?.vulnerableGroups) ? primaryIncident.vulnerableGroups.join(", ") : "",
        requiredResources: Array.isArray(primaryIncident?.requiredResources)
          ? primaryIncident.requiredResources.map((r: any) => `${r.name}:${r.quantity}:${r.priority || "medium"}`).join(", ")
          : "",
        riskFlags: Array.isArray(primaryIncident?.riskFlags)
          ? primaryIncident.riskFlags.join(", ")
          : Array.isArray(data.extracted.safetySignals) ? data.extracted.safetySignals.join(", ") : "",
        preferredResponderType: data.extracted.preferredResponderType || "volunteer",
        requiredSkills: Array.isArray(data.extracted.requiredSkills) ? data.extracted.requiredSkills.join(", ") : "local_language",
        languageNeeds: Array.isArray(data.extracted.languageNeeds) ? data.extracted.languageNeeds.join(", ") : "kannada",
        safeVisitTimeWindows: Array.isArray(data.extracted.safeVisitTimeWindows) ? data.extracted.safeVisitTimeWindows.join(", ") : "08:00-17:00",
        estimatedEffortMinutes: String(data.extracted.estimatedEffortMinutes || 60),
        revisitRecommendedAt: data.extracted.revisitRecommendedAt ? String(data.extracted.revisitRecommendedAt).slice(0, 16) : "",
        surveyDate: new Date().toISOString().split('T')[0],
        lat: prev.lat,
        lng: prev.lng,
        areaName: prev.areaName
      }));

      setStep("success");
    } catch (err: any) {
      clearInterval(progressInterval);
      setError(err.message);
      setStep("idle");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_SCAN_FILE_SIZE) {
        setError("File is too large. Maximum supported size is 10MB.");
        return;
      }

      const nameLower = file.name.toLowerCase();
      const mimeOk = ALLOWED_SCAN_MIMES.has(file.type);
      const extensionOk = nameLower.endsWith(".pdf") || nameLower.endsWith(".png") || nameLower.endsWith(".jpg") || nameLower.endsWith(".jpeg");
      if (!mimeOk && !extensionOk) {
        setError("Unsupported file type. Upload PNG, JPEG, or PDF.");
        return;
      }

      const isPdf = file.type === "application/pdf" || nameLower.endsWith(".pdf");
      if (isPdf) {
        setImage(null);
        startProcessing(file);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        startProcessing(file);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (step === "processing") {
      if (progress > 25) setProcessingSteps(s => s.map((p, i) => i === 0 ? { ...p, status: "done" } : p));
      if (progress > 50) setProcessingSteps(s => s.map((p, i) => i === 1 ? { ...p, status: "done" } : p));
      if (progress > 75) setProcessingSteps(s => s.map((p, i) => i === 2 ? { ...p, status: "active" } : p));
      if (progress > 90) setProcessingSteps(s => s.map((p, i) => i === 3 ? { ...p, status: "active" } : p));
    }
  }, [progress, step]);

  const handleSubmit = async () => {
    setStep("processing");
    setProgress(0);

    const zoneInfo = deriveZoneInfo({
      lat: formData.lat,
      lng: formData.lng,
      address: formData.address,
      pincode: formData.pincode,
      areaName: formData.areaName,
    });
    
    const familiesAffected = parseInt(formData.families || "0", 10) || 0;
    const personsAffected = parseInt(formData.persons || "0", 10) > 0
      ? parseInt(formData.persons || "0", 10)
      : (Number(extractedResult?.personsAffected) > 0 ? Number(extractedResult.personsAffected) : familiesAffected * 4);
    const needType = reportMode === "mission_update"
      ? (activeMission?.needType || formData.needType)
      : formData.needType;
    const severity = formData.severity.toLowerCase();
    const safetySignals = splitCsv(formData.riskFlags || "");
    const requiredResourceName = `${String(needType).toLowerCase().replace(/\s+/g, "-")}-support`;
    const requiredResources = splitCsv(formData.requiredResources).map((item) => {
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
      severity,
      familiesAffected,
      personsAffected,
      location: {
        lat: formData.lat || 12.9716,
        lng: formData.lng || 77.5946,
        address: formData.address || zoneInfo.zoneLabel,
        landmark: formData.address || zoneInfo.zoneLabel
      },
      inputType: "ocr",
      sourceType: "scan",
      householdRef: formData.householdRef || extractedResult?.householdRef || null,
      visitType: formData.visitType || "first_visit",
      verificationState: formData.verificationState || "unverified",
      needIncidents: (extractedResult?.needIncidents && extractedResult.needIncidents.length > 0)
        ? [{
            ...extractedResult.needIncidents[0],
            needType: String(needType).toLowerCase(),
            severity,
            urgencyWindowHours: parseInt(formData.urgencyWindowHours || "24", 10) || 24,
            familiesAffected,
            personsAffected,
            vulnerableGroups: splitCsv(formData.vulnerableGroups),
            requiredResources: requiredResources.length > 0
              ? requiredResources
              : extractedResult.needIncidents[0]?.requiredResources || [],
            riskFlags: safetySignals,
          }]
        : [{
            needType: String(needType).toLowerCase(),
            severity,
            urgencyWindowHours: parseInt(formData.urgencyWindowHours || "24", 10) || (severity === "high" || severity === "critical" ? 24 : 72),
            familiesAffected,
            personsAffected,
            vulnerableGroups: splitCsv(formData.vulnerableGroups),
            requiredResources: requiredResources.length > 0
              ? requiredResources
              : familiesAffected > 0
              ? [{ name: requiredResourceName, quantity: familiesAffected, priority: severity }]
              : [],
            riskFlags: safetySignals,
          }],
      preferredResponderType: formData.preferredResponderType || "volunteer",
      requiredSkills: splitCsv(formData.requiredSkills),
      languageNeeds: splitCsv(formData.languageNeeds),
      safeVisitTimeWindows: splitCsv(formData.safeVisitTimeWindows),
      estimatedEffortMinutes: parseInt(formData.estimatedEffortMinutes || "60", 10) || 60,
      revisitRecommendedAt: formData.revisitRecommendedAt ? new Date(formData.revisitRecommendedAt).toISOString() : null,
      imageUrl: imageUrl,
      extractedData: extractedResult,
      confidence: extractedResult?.confidence || 90,
      safetySignals,
      landmark: extractedResult?.landmark || formData.address || null,
      additionalNotes: formData.notes || extractedResult?.additionalNotes || null,
      fieldConfidences: extractedResult?.fieldConfidences || null
    };

    try {
      const response = await fetch(`${apiBaseUrl}/fieldworker/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Failed to submit report");

      const data = await response.json();
      setIsMerged(data.merged);
      setReportId(data.reportId || null);
      setMissionId(data.missionId || null);
      setStep("submitted");
    } catch (err: any) {
      setError(err.message);
      setStep("success"); // Go back to success to allow retry
    }
  };

  if (step === "submitted") {
    return (
      <div className="flex-1 flex items-center justify-center p-10 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[600px] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-[#5A57FF]" />
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
           <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-bounce" />
           </div>
           
           <div className="space-y-2">
              <h2 className="text-3xl font-bold text-[#1A1A3D]">
                {isMerged ? "Report added to active mission!" : "Report submitted!"}
              </h2>
              <p className="text-slate-500 font-medium">
                {isMerged ? "Your field data was automatically linked to an ongoing mission." : "Your field data has been successfully digitized."}
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
                  Coordinator Sarah has been notified of the update
                </p>
             </div>
           ) : (
             <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3 text-left">
                <Database className="w-5 h-5 text-emerald-600" />
                <div>
                   <p className="text-sm font-bold text-emerald-900">Syncing to Nexus...</p>
                   <p className="text-[10px] text-emerald-700/70 font-bold uppercase tracking-widest">Transaction ID: {reportId || "Pending"}</p>
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
              <Button 
                onClick={() => { setStep("idle"); setImage(null); }}
                className="w-full h-14 bg-[#5A57FF] hover:bg-[#4845E0] rounded-2xl font-bold flex gap-2 group justify-center"
              >
                Submit another report <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
              {!isMerged && (
                <Button 
                  variant="ghost" 
                  onClick={onGoToDashboard}
                  className="w-full h-14 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl"
                >
                  Go to dashboard →
                </Button>
              )}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* LEFT COLUMN - CAPTURE AREA */}
      <div className="lg:w-[55%] space-y-8">
        <div 
          className={cn(
            "relative w-full h-[480px] rounded-[2.5rem] border-4 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden bg-white group",
            image ? "border-transparent" : "border-slate-200 hover:border-[#5A57FF]/40 hover:bg-indigo-50/30"
          )}
        >
          {image ? (
            <>
              <img src={image} className="w-full h-full object-cover" alt="Survey preview" />
              
              {/* Corner Guides Overlay */}
              <div className="absolute inset-8 pointer-events-none">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white/60 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white/60 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white/60 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white/60 rounded-tr-xl" />
              </div>

              {step === "processing" && (
                <div className="absolute inset-0 bg-indigo-900/40 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-10">
                   <div className="relative mb-8">
                      <Sparkles className="w-16 h-16 text-indigo-400 animate-pulse" />
                      <div className="absolute inset-0 animate-ping opacity-20">
                         <Sparkles className="w-16 h-16 text-white" />
                      </div>
                   </div>
                   
                   <div className="w-full max-w-xs space-y-4">
                      <div className="flex justify-between text-sm font-bold">
                         <span>Extracting data...</span>
                         <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2 bg-white/20" indicatorClassName="bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                   </div>

                   {selectedFileName && (
                      <p className="mt-4 text-[11px] font-bold text-white/80 uppercase tracking-widest text-center">
                        Processing {selectedFileName}
                      </p>
                   )}

                   <div className="grid grid-cols-1 gap-3 mt-10 w-full max-w-sm">
                      {processingSteps.map((s, i) => (
                        <div key={i} className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300",
                          s.status === "done" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-50" : 
                          s.status === "active" ? "bg-white/10 border-white/20 text-white animate-pulse" : 
                          "bg-black/10 border-transparent text-white/40"
                        )}>
                           {s.status === "done" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : 
                            s.status === "active" ? <Sparkles className="w-4 h-4 animate-spin" /> : 
                            <div className="w-4 h-4 rounded-full border border-white/20" />}
                           <span className="text-xs font-bold">{s.status === "active" ? "⏳ " : ""}{s.label}</span>
                        </div>
                      ))}
                   </div>
                </div>
              )}

              {step === "success" && (
                <div className="absolute top-6 left-6 right-6">
                   <div className="bg-emerald-500 text-white px-6 py-3 rounded-2xl flex items-center justify-between shadow-xl animate-in slide-in-from-top-4">
                      <div className="flex items-center gap-3">
                         <div className="bg-white/20 p-1.5 rounded-lg">
                            <CheckCircle2 className="w-5 h-5" />
                         </div>
                         <span className="font-bold text-sm">Extraction complete</span>
                      </div>
                       <Badge className="bg-white/20 text-white border-none font-bold">Review extracted fields</Badge>
                   </div>
                </div>
              )}
            </>
             ) : step === "processing" ? (
              <div className="absolute inset-0 bg-indigo-900/40 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-10">
                <div className="relative mb-8">
                  <Sparkles className="w-16 h-16 text-indigo-400 animate-pulse" />
                  <div className="absolute inset-0 animate-ping opacity-20">
                    <Sparkles className="w-16 h-16 text-white" />
                  </div>
                </div>

                <div className="w-full max-w-xs space-y-4">
                  <div className="flex justify-between text-sm font-bold">
                    <span>Extracting data...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-white/20" indicatorClassName="bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                </div>

                <div className="grid grid-cols-1 gap-3 mt-10 w-full max-w-sm">
                  {processingSteps.map((s, i) => (
                    <div key={i} className={cn(
                     "flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300",
                     s.status === "done" ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-50" :
                     s.status === "active" ? "bg-white/10 border-white/20 text-white animate-pulse" :
                     "bg-black/10 border-transparent text-white/40"
                    )}>
                      {s.status === "done" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                      s.status === "active" ? <Sparkles className="w-4 h-4 animate-spin" /> :
                      <div className="w-4 h-4 rounded-full border border-white/20" />}
                      <span className="text-xs font-bold">{s.status === "active" ? "⏳ " : ""}{s.label}</span>
                    </div>
                  ))}
                </div>

                {selectedFileName && (
                  <p className="mt-4 text-[11px] font-bold text-white/80 uppercase tracking-widest text-center">
                    Processing {selectedFileName}
                  </p>
                )}
              </div>
          ) : (
            <div className="text-center p-10 cursor-pointer" onClick={() => document.getElementById('survey-upload')?.click()}>
              <div className="w-24 h-24 bg-[#F3F2FF] rounded-[2rem] flex items-center justify-center text-[#5A57FF] mx-auto mb-6 group-hover:scale-110 transition-transform shadow-sm">
                <Upload className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-[#1A1A3D] mb-2">Drop survey image here</h3>
              <p className="text-slate-500 font-medium">PNG, JPEG or PDF supported up to 10MB</p>
              <button className="mt-6 text-[#5A57FF] font-bold text-sm underline-offset-4 hover:underline transition-all">or use camera</button>
            </div>
          )}
          <input type="file" id="survey-upload" className="hidden" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" onChange={handleFileChange} />
        </div>

        <div className="flex items-center justify-between px-2">
           <div className="flex gap-4">
              <Button 
                variant="outline" 
                className="h-12 px-6 rounded-2xl border-slate-200 font-bold text-slate-600 gap-2 hover:bg-slate-50 transition-all"
                onClick={() => document.getElementById('survey-upload')?.click()}
              >
                  <Upload className="w-4 h-4" /> Upload File
              </Button>
              <Button 
                className="h-12 px-6 rounded-2xl bg-[#5A57FF] hover:bg-[#4845E0] font-bold gap-2 shadow-lg shadow-indigo-100 transition-all"
                onClick={() => document.getElementById('survey-upload')?.click()}
              >
                 <Camera className="w-4 h-4" /> Use Camera
              </Button>
           </div>
           <button 
             className="text-slate-400 font-bold text-sm hover:text-red-500 transition-colors"
             onClick={() => { setImage(null); setStep("idle"); setProgress(0); setSelectedFileName(""); }}
           >
             Clear
           </button>
        </div>

        {/* Confidence Banner */}
          {error && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-left-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-900">Scan failed</p>
                <p className="text-[11px] text-red-700 font-medium italic">{error}</p>
              </div>
            </div>
          )}

          {step === "success" && (
           <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-left-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
                 <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-900">Please review extracted fields before submitting</p>
                <p className="text-[11px] text-amber-700 font-medium italic">Verify severity, families, and location details for mission accuracy.</p>
              </div>
           </div>
        )}
      </div>

      {/* RIGHT COLUMN - EXTRACTED DATA */}
      <div className="lg:w-[45%] bg-white rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between shrink-0">
           <div>
              <h3 className="text-xl font-bold text-[#1A1A3D]">Extracted Information</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Automated extraction by Nexus OCR</p>
           </div>
            <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 px-3 py-1 font-bold text-xs flex gap-1.5 items-center">
              <ConfidenceDot level={(extractedResult?.confidence || 0) >= 80 ? "high" : "low"} />
              {`${extractedResult?.confidence ?? 0}% confidence`}
           </Badge>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-none">
           <section className="space-y-5">
              <div className="flex items-center gap-2">
                 <div className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 text-[#5A57FF]" />
                 </div>
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Need Information</h4>
              </div>
              
              <div className="grid grid-cols-1 gap-5">
                 <div className="space-y-2">
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
                            setFormData((prev) => ({ ...prev, needType: activeMission.needType }));
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
                    {reportMode === "mission_update" && activeMission?.needType ? (
                      <p className="text-[11px] text-indigo-700 font-medium">Need type is locked to mission: {activeMission.needType}.</p>
                    ) : (
                      <p className="text-[11px] text-indigo-700 font-medium">You can submit a different need report from this assigned mission.</p>
                    )}
                 </div>

                 <div className="space-y-2">
                    <div className="flex items-center justify-between">
                       <Label className="text-xs font-bold text-slate-500">Need Type</Label>
                       <ConfidenceDot level="high" />
                    </div>
                    <Select
                      value={formData.needType}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, needType: val }))}
                      disabled={reportMode === "mission_update" && Boolean(activeMission?.needType)}
                    >
                       <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-transparent focus:ring-[#5A57FF] group">
                          <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                          <SelectItem value="General">General</SelectItem>
                          <SelectItem value="Food Insecurity">Food Insecurity</SelectItem>
                          <SelectItem value="Sanitation">Sanitation</SelectItem>
                          <SelectItem value="Medical Aid">Medical Aid</SelectItem>
                          <SelectItem value="Housing">Housing</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>

                  <div className="grid grid-cols-3 gap-5">
                    <div className="space-y-3">
                       <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-slate-500">Severity Level</Label>
                          <ConfidenceDot level="high" />
                       </div>
                       <RadioGroup value={formData.severity} onValueChange={(val) => setFormData(prev => ({ ...prev, severity: val }))} className="flex flex-col gap-2">
                          {["Low", "Medium", "High", "Critical"].map((v) => (
                             <div key={v} className="flex items-center space-x-2">
                                 <RadioGroupItem value={v} id={`severity-${v}`} className="text-[#5A57FF]" />
                                 <Label htmlFor={`severity-${v}`} className="text-xs font-bold text-[#1A1A3D]">{v}</Label>
                             </div>
                          ))}
                       </RadioGroup>
                    </div>
                    <div className="space-y-2">
                       <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-slate-500">Affected Families</Label>
                          <ConfidenceDot level="low" />
                       </div>
                       <Input 
                         type="number" 
                         value={formData.families} onChange={(e) => setFormData(prev => ({ ...prev, families: e.target.value }))} 
                         className="h-12 rounded-xl bg-amber-50/50 border-amber-200 focus:ring-amber-500 text-[#1A1A3D] font-bold"
                       />
                    </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-slate-500">Affected Persons</Label>
                          <ConfidenceDot level="low" />
                        </div>
                        <Input 
                         type="number" 
                         value={formData.persons} onChange={(e) => setFormData(prev => ({ ...prev, persons: e.target.value }))} 
                         className="h-12 rounded-xl bg-amber-50/50 border-amber-200 focus:ring-amber-500 text-[#1A1A3D] font-bold"
                        />
                      </div>
                 </div>
              </div>
           </section>

                <section className="space-y-5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center">
                      <Layers className="w-3.5 h-3.5 text-[#5A57FF]" />
                    </div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">V2 Incident & Assignment</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Household Ref</Label>
                      <Input value={formData.householdRef} onChange={(e) => setFormData(prev => ({ ...prev, householdRef: e.target.value }))} className="h-12 rounded-xl bg-slate-50 border-transparent" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Visit Type</Label>
                      <Select value={formData.visitType} onValueChange={(val) => setFormData(prev => ({ ...prev, visitType: val }))}>
                       <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-transparent"><SelectValue /></SelectTrigger>
                       <SelectContent>
                        <SelectItem value="first_visit">first_visit</SelectItem>
                        <SelectItem value="follow_up">follow_up</SelectItem>
                        <SelectItem value="revisit">revisit</SelectItem>
                       </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Verification State</Label>
                      <Select value={formData.verificationState} onValueChange={(val) => setFormData(prev => ({ ...prev, verificationState: val }))}>
                       <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-transparent"><SelectValue /></SelectTrigger>
                       <SelectContent>
                        <SelectItem value="unverified">unverified</SelectItem>
                        <SelectItem value="verified">verified</SelectItem>
                        <SelectItem value="rejected">rejected</SelectItem>
                       </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Urgency (hours)</Label>
                      <Input type="number" value={formData.urgencyWindowHours} onChange={(e) => setFormData(prev => ({ ...prev, urgencyWindowHours: e.target.value }))} className="h-12 rounded-xl bg-slate-50 border-transparent" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-xs font-bold text-slate-500">Vulnerable Groups (comma separated)</Label>
                      <Input value={formData.vulnerableGroups} onChange={(e) => setFormData(prev => ({ ...prev, vulnerableGroups: e.target.value }))} className="h-12 rounded-xl bg-slate-50 border-transparent" placeholder="children, elderly" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-xs font-bold text-slate-500">Required Resources (name:qty:priority)</Label>
                      <Input value={formData.requiredResources} onChange={(e) => setFormData(prev => ({ ...prev, requiredResources: e.target.value }))} className="h-12 rounded-xl bg-slate-50 border-transparent" placeholder="rice-kit:34:high, water-kit:20:medium" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-xs font-bold text-slate-500">Risk Flags / Safety Signals</Label>
                      <Input value={formData.riskFlags} onChange={(e) => setFormData(prev => ({ ...prev, riskFlags: e.target.value }))} className="h-12 rounded-xl bg-slate-50 border-transparent" placeholder="night_safety, access_blocked" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Preferred Responder</Label>
                      <Select value={formData.preferredResponderType} onValueChange={(val) => setFormData(prev => ({ ...prev, preferredResponderType: val }))}>
                       <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-transparent"><SelectValue /></SelectTrigger>
                       <SelectContent>
                        <SelectItem value="volunteer">volunteer</SelectItem>
                        <SelectItem value="ngo_staff">ngo_staff</SelectItem>
                        <SelectItem value="mixed">mixed</SelectItem>
                       </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">Estimated Effort (minutes)</Label>
                      <Input type="number" value={formData.estimatedEffortMinutes} onChange={(e) => setFormData(prev => ({ ...prev, estimatedEffortMinutes: e.target.value }))} className="h-12 rounded-xl bg-slate-50 border-transparent" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-xs font-bold text-slate-500">Required Skills</Label>
                      <Input value={formData.requiredSkills} onChange={(e) => setFormData(prev => ({ ...prev, requiredSkills: e.target.value }))} className="h-12 rounded-xl bg-slate-50 border-transparent" placeholder="local_language, ration_distribution" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-xs font-bold text-slate-500">Language Needs</Label>
                      <Input value={formData.languageNeeds} onChange={(e) => setFormData(prev => ({ ...prev, languageNeeds: e.target.value }))} className="h-12 rounded-xl bg-slate-50 border-transparent" placeholder="kannada, hindi" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-xs font-bold text-slate-500">Safe Visit Time Windows</Label>
                      <Input value={formData.safeVisitTimeWindows} onChange={(e) => setFormData(prev => ({ ...prev, safeVisitTimeWindows: e.target.value }))} className="h-12 rounded-xl bg-slate-50 border-transparent" placeholder="08:00-17:00, 18:00-20:00" />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label className="text-xs font-bold text-slate-500">Revisit Recommended At</Label>
                      <Input type="datetime-local" value={formData.revisitRecommendedAt} onChange={(e) => setFormData(prev => ({ ...prev, revisitRecommendedAt: e.target.value }))} className="h-12 rounded-xl bg-slate-50 border-transparent" />
                    </div>
                  </div>
                </section>

           <section className="space-y-5">
              <div className="flex items-center gap-2">
                 <div className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-[#5A57FF]" />
                 </div>
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Location Details</h4>
              </div>

              <div className="grid grid-cols-1 gap-5">
                 <div className="space-y-2">
                    <div className="flex items-center justify-between">
                       <Label className="text-xs font-bold text-slate-500">Zone / Sector</Label>
                       <ConfidenceDot level="high" />
                    </div>
                    <Input
                     value={formData.zone}
                     readOnly
                     className="h-12 rounded-xl bg-slate-50 border-transparent text-[#1A1A3D] font-medium"
                    />
                 </div>

                 <div className="space-y-2">
                    <div className="flex items-center justify-between">
                       <Label className="text-xs font-bold text-slate-500">Address/Landmark</Label>
                       <ConfidenceDot level="high" />
                    </div>
                    <Input value={formData.address} onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))} className="h-12 rounded-xl bg-slate-50 border-transparent text-[#1A1A3D] font-medium" />
                     {Boolean(reportMode === "mission_update" && detectedLocation && activeMission?.location?.address && detectedLocation !== activeMission.location.address) && (
                       <p className="text-[11px] text-amber-700 font-medium italic mt-1">
                         OCR detected location: "{detectedLocation}". Report is locked to assigned mission location.
                       </p>
                     )}
                 </div>

                 <div className="grid grid-cols-2 gap-5 items-start">
                    <div className="space-y-2">
                       <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-slate-500">Pincode</Label>
                          <ConfidenceDot level="low" />
                       </div>
                       <Input value={formData.pincode} onChange={(e) => setFormData(prev => ({ ...prev, pincode: e.target.value }))} className="h-12 rounded-xl bg-amber-50/50 border-amber-200 text-[#1A1A3D] font-bold" />
                    </div>
                    <div className="relative rounded-2xl overflow-hidden h-44 border border-slate-100 group shadow-inner">
                        <MapPicker
                          initialLocation={mapInitialLocation}
                          onLocationSelect={handleLocationSelect}
                        />
                     </div>
                 </div>
              </div>
           </section>

           <section className="space-y-5">
              <div className="flex items-center gap-2">
                 <div className="w-6 h-6 bg-indigo-50 rounded flex items-center justify-center">
                    <Layers className="w-3.5 h-3.5 text-[#5A57FF]" />
                 </div>
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Context & Source</h4>
              </div>

              <div className="space-y-5">
                 <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500">Additional Field Notes</Label>
                    <Textarea 
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Any additional context from field worker..." 
                      className="rounded-xl bg-slate-50 border-transparent min-h-[100px] text-sm resize-none" 
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                       <Label className="text-xs font-bold text-slate-500">Data Source</Label>
                       <div className="flex items-center gap-2 bg-[#F3F2FF] px-4 h-12 rounded-xl border border-indigo-100">
                          <Badge className="bg-[#5A57FF] text-white border-none py-1 h-6">Paper Survey</Badge>
                          <span className="text-[10px] font-bold text-[#5A57FF] uppercase tracking-widest">Auto-detected</span>
                       </div>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-xs font-bold text-slate-500">Survey Date</Label>
                       <div className="relative">
                          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            type="date"
                            value={formData.surveyDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, surveyDate: e.target.value }))}
                            className="h-12 pl-12 rounded-xl bg-slate-50 border-transparent text-sm font-bold"
                          />
                       </div>
                    </div>
                 </div>
              </div>
           </section>
        </div>

        <div className="p-8 bg-slate-50/50 border-t border-slate-100 space-y-4 shrink-0">
           <Button 
             onClick={handleSubmit}
             className="w-full h-14 bg-gradient-to-r from-[#5A57FF] to-purple-600 hover:opacity-90 rounded-2xl font-bold flex gap-2 shadow-xl shadow-indigo-100"
             disabled={step === "processing"}
           >
              Submit Report <ChevronRight className="w-4 h-4" />
           </Button>
           <div className="flex items-center justify-between px-2">
              <button className="text-sm font-bold text-slate-400 hover:text-[#5A57FF] transition-colors">Save as Draft</button>
              <button 
                className="text-sm font-bold text-[#5A57FF] flex items-center gap-1.5"
                onClick={() => { setStep("idle"); setImage(null); }}
              >
                <Search className="w-3.5 h-3.5" /> Re-scan
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};