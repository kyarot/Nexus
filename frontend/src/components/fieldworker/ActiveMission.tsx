import { API_BASE_URL } from "@/lib/config";
import React, { useState, useEffect, useRef } from "react";
import { 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Navigation, 
  AlertTriangle,
  Mic,
  FileText,
  User,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  Navigation2,
  Phone,
  ArrowRight,
  Sparkles,
  Search,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { MapPicker } from "@/components/nexus/MapPicker";
import { useToast } from "@/hooks/use-toast";
import { getNotificationStreamUrl, listNotifications, type NotificationItem } from "@/lib/ops-api";
import { fetchWithOutbox } from "@/lib/offline-outbox";
import { useOnlineStatus } from "@/hooks/use-online-status";

const UpdateRow = ({ time, status, text, type }: { time: string, status: string, text: string, type: "system" | "field" }) => (
  <div className="flex gap-4 relative pb-8 group last:pb-0">
    <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-100 group-last:bg-transparent" />
    <div className={cn(
      "w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10",
      type === "system" ? "bg-indigo-50 border border-indigo-100 text-[#5A57FF]" : "bg-emerald-50 border border-emerald-100 text-emerald-500"
    )}>
       {type === "system" ? <div className="w-1.5 h-1.5 rounded-full bg-current" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
    </div>
    <div className="space-y-1 pt-0.5">
       <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{time}</span>
          <Badge className={cn(
            "text-[8px] font-black tracking-widest uppercase border-none px-2 h-4 shadow-none",
            type === "system" ? "bg-indigo-50 text-[#5A57FF]/70" : "bg-emerald-50 text-emerald-600/70"
          )}>{status}</Badge>
       </div>
       <p className="text-xs font-bold text-[#1A1A3D] leading-relaxed">{text}</p>
    </div>
  </div>
);

export const ActiveMission = () => {
   const { toast } = useToast();
  const [activeMission, setActiveMission] = useState<any>(null);
  const [updates, setUpdates] = useState<any[]>([]);
   const [lastMission, setLastMission] = useState<any | null>(null);
   const [noMissionReason, setNoMissionReason] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("en_route");
  const [completionNotes, setCompletionNotes] = useState("");
  const [familiesHelped, setFamiliesHelped] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
   const [missionLocation, setMissionLocation] = useState({ lat: 12.9716, lng: 77.5946 });
   const [updateMode, setUpdateMode] = useState<"voice" | "text">("text");
   const [updateText, setUpdateText] = useState("");
   const [isRecording, setIsRecording] = useState(false);
   const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
   const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
   const [updateError, setUpdateError] = useState<string | null>(null);

  const apiBaseUrl = API_BASE_URL;
  const token = localStorage.getItem("nexus_access_token");
   const isOnline = useOnlineStatus();
   const seenNotificationIds = useRef<Set<string>>(new Set());

  const fetchActiveMission = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/fieldworker/mission/active`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      setActiveMission(data.mission);
      setUpdates(data.updates || []);
      setLastMission(data.lastMission || null);
      setNoMissionReason(data.reason || "");
      if (data.mission) setStatus(data.mission.status);
         if (data.mission?.location?.lat && data.mission?.location?.lng) {
            setMissionLocation({ lat: data.mission.location.lat, lng: data.mission.location.lng });
         }
    } catch (err) {
      console.error("Failed to fetch active mission", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveMission();
    // Poll every 10s for updates
    const interval = setInterval(fetchActiveMission, 10000);
    return () => clearInterval(interval);
  }, []);

   useEffect(() => {
      if (!token || !isOnline) return;
      const streamUrl = getNotificationStreamUrl();
      const source = new EventSource(streamUrl);

      const handleNotifications = async () => {
         try {
            const data = await listNotifications(true);
            const missionMessages = (data.notifications || []).filter(
               (item: NotificationItem) => item.type === "mission_message",
            );
            for (const item of missionMessages) {
               if (seenNotificationIds.current.has(item.id)) {
                  continue;
               }
               seenNotificationIds.current.add(item.id);
               toast({
                  title: item.title || "Coordinator message",
                  description: item.message,
               });
            }
         } catch {
            // Ignore notification fetch errors.
         }
      };

      source.onmessage = (event) => {
         try {
            const payload = JSON.parse(event.data || "{}");
            if (payload?.type === "notification_update") {
               handleNotifications();
            }
         } catch {
            // Ignore malformed SSE payloads.
         }
      };

      source.onerror = () => {
         source.close();
      };

      return () => {
         source.close();
      };
   }, [token, toast, isOnline]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!activeMission) return;
    setIsSubmitting(true);
    
    // Attempt to get location
    const getLocation = () => {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({ lat: 12.9716, lng: 77.5946 }) // Default to Bangalore
        );
      });
    };

    const location = await getLocation();
    
      try {
         const { response, queued } = await fetchWithOutbox(`${apiBaseUrl}/fieldworker/mission/${activeMission.id}/status`, {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
               "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus, location })
         });

         if (queued) {
            setStatus(newStatus);
            toast({ title: "Status update queued", description: "Will sync when online." });
            return;
         }

         if (response?.ok) {
            setStatus(newStatus);
            fetchActiveMission(); // Refresh timeline
         } else {
            throw new Error("Failed to update status");
         }
      } catch (err) {
         console.error("Failed to update status", err);
      } finally {
         setIsSubmitting(false);
      }
  };

  const handleCompleteMission = async (outcome: 'success' | 'failure') => {
    if (!activeMission) return;
    setIsSubmitting(true);
    
      try {
         const { response, queued } = await fetchWithOutbox(`${apiBaseUrl}/fieldworker/mission/${activeMission.id}/complete`, {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
               "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
               outcome,
               familiesHelped,
               notes: completionNotes
            })
         });

         if (queued) {
            toast({ title: "Completion queued", description: "Will sync when online." });
            return;
         }

         if (response?.ok) {
            setActiveMission(null);
         } else {
            throw new Error("Failed to complete mission");
         }
      } catch (err) {
         console.error("Failed to complete mission", err);
      } finally {
         setIsSubmitting(false);
      }
  };

   const handleStartRecording = async () => {
      setUpdateError(null);
      try {
         const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
         const recorder = new MediaRecorder(stream);
         const chunks: BlobPart[] = [];
         recorder.ondataavailable = (event) => chunks.push(event.data);
         recorder.onstop = () => {
            const blob = new Blob(chunks, { type: "audio/wav" });
            setRecordedBlob(blob);
            recorder.stream.getTracks().forEach((track) => track.stop());
         };
         recorder.start();
         setMediaRecorder(recorder);
         setIsRecording(true);
      } catch {
         setUpdateError("Microphone permission denied or unavailable.");
      }
   };

   const handleStopRecording = () => {
      if (!mediaRecorder) return;
      mediaRecorder.stop();
      setIsRecording(false);
   };

   const submitFieldUpdate = async () => {
      if (!activeMission?.id) return;
      setIsSubmitting(true);
      setUpdateError(null);

      try {
         if (updateMode === "text") {
            if (!updateText.trim()) {
               setUpdateError("Please enter update text before submitting.");
               return;
            }

            const { response, queued } = await fetchWithOutbox(`${apiBaseUrl}/fieldworker/mission/${activeMission.id}/text-update`, {
               method: "POST",
               headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`,
               },
               body: JSON.stringify({ text: updateText.trim() }),
            });

            if (queued) {
              setUpdateText("");
              toast({ title: "Update queued", description: "Will sync when online." });
              return;
            }

            if (!response?.ok) {
               throw new Error("Failed to submit text update");
            }
            setUpdateText("");
         } else {
            if (!recordedBlob) {
               setUpdateError("Record a voice update before submitting.");
               return;
            }

            const formData = new FormData();
            formData.append("file", recordedBlob, "mission-update.wav");
            const { response, queued } = await fetchWithOutbox(`${apiBaseUrl}/fieldworker/mission/${activeMission.id}/voice-update`, {
               method: "POST",
               headers: {
                  "Authorization": `Bearer ${token}`,
               },
               body: formData,
            });

            if (queued) {
              setRecordedBlob(null);
              toast({ title: "Voice update queued", description: "Will sync when online." });
              return;
            }

            if (!response?.ok) {
               throw new Error("Failed to submit voice update");
            }
            setRecordedBlob(null);
         }

         await fetchActiveMission();
      } catch (err: any) {
         setUpdateError(err?.message || "Failed to submit update");
      } finally {
         setIsSubmitting(false);
      }
   };

  if (loading) return <div className="flex items-center justify-center h-64"><Sparkles className="animate-spin text-[#5A57FF]" /></div>;
  
  if (!activeMission) return (
    <div className="bg-white rounded-[2.5rem] p-16 text-center border border-slate-100 shadow-sm animate-in fade-in zoom-in duration-500">
       <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-slate-300" />
       </div>
       <h3 className="text-2xl font-bold text-[#1A1A3D]">No assignments yet</h3>
       <p className="text-slate-500 mt-2 max-w-xs mx-auto">Stand by for real-time mission dispatch from your coordinator.</p>
          {noMissionReason && (
             <p className="text-xs text-amber-600 mt-4 font-semibold">{noMissionReason}</p>
          )}
          {lastMission && (
             <div className="mt-6 max-w-md mx-auto bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Latest Assigned Mission</p>
                <p className="text-sm font-bold text-[#1A1A3D] mt-1">{lastMission.title || lastMission.id}</p>
                <p className="text-xs text-slate-500 mt-1">Status: <span className="font-bold uppercase">{lastMission.status || "unknown"}</span></p>
                <p className="text-xs text-slate-500">Updated: {lastMission.updatedAt ? new Date(lastMission.updatedAt).toLocaleString() : "N/A"}</p>
             </div>
          )}
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* LEFT COLUMN - MISSION DETAILS */}
      <div className="lg:w-[60%] space-y-8">
        
        {/* Mission Header Card */}
        <div className="bg-gradient-to-br from-[#5A57FF] to-purple-600 rounded-[2.5rem] p-10 text-white shadow-xl shadow-indigo-500/10 relative overflow-hidden group">
           <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full backdrop-blur-md">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    <span className="text-[9px] font-black uppercase tracking-widest leading-none">ID: {activeMission.id.slice(0, 8)}</span>
                 </div>
                 <Badge className="bg-emerald-500/20 text-emerald-400 border-none font-black text-[9px] tracking-widest uppercase px-4 py-1">Mission Live</Badge>
              </div>
              
              <div className="space-y-3">
                 <h1 className="text-4xl font-bold tracking-tight">{activeMission.title || "Emergency Response"}</h1>
                 <p className="text-[#E0E7FF] font-medium max-w-lg leading-relaxed italic opacity-80">
                    {activeMission.description || "Mission details unavailable."}
                 </p>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                 <div className="w-10 h-10 rounded-xl bg-white/20 p-1 backdrop-blur-sm flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#E0E7FF]">Assigned Coordinator</p>
                    <p className="text-sm font-bold">{activeMission.creatorName || "Coordinator"} · Live</p>
                 </div>
              </div>
           </div>
           
           <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl opacity-50 group-hover:scale-150 transition-transform duration-1000" />
        </div>

        {/* Mission Info Grid */}
        <div className="grid grid-cols-2 gap-6">
           <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-[#5A57FF]">
                    <MapPin className="w-4 h-4" />
                 </div>
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zone Location</p>
                    <p className="text-sm font-bold text-[#1A1A3D]">{activeMission.zoneName || activeMission.zoneId || "Assigned Sector"}</p>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                    <FileText className="w-4 h-4" />
                 </div>
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Need Type</p>
                    <p className="text-sm font-bold text-[#1A1A3D]">{activeMission.needType}</p>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                    <AlertTriangle className="w-4 h-4" />
                 </div>
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Priority</p>
                    <p className="text-sm font-bold text-[#1A1A3D]">{activeMission.priority || "High"}</p>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                    <Clock className="w-4 h-4" />
                 </div>
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Est. Duration</p>
                    <p className="text-sm font-bold text-[#1A1A3D]">{activeMission.estimatedDurationMinutes || 0} Minutes</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Empathy Brief Card */}
        <div className="bg-[#F3F2FF] border border-indigo-100 rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden">
           <div className="flex items-center gap-3 text-[#5A57FF] relative z-10">
              <Sparkles className="w-6 h-6" />
              <h3 className="text-xl font-bold uppercase tracking-widest">Your Mission Brief</h3>
           </div>
           
           <div className="space-y-6 relative z-10">
              <p className="text-lg text-slate-600 leading-relaxed font-medium italic">
                 "{activeMission.instructions || activeMission.notes || activeMission.description || "No additional mission brief available."}"
              </p>
              
              <div className="flex flex-wrap gap-4">
                 <Badge className="bg-white text-indigo-600 border-none px-4 py-1.5 rounded-xl font-bold text-xs ring-1 ring-indigo-100">
                   Priority: {activeMission.priority || "unknown"}
                 </Badge>
                 <Badge className="bg-white text-indigo-600 border-none px-4 py-1.5 rounded-xl font-bold text-xs ring-1 ring-indigo-100 italic">
                   Audience: {activeMission.targetAudience || "fieldworker"}
                 </Badge>
              </div>

              {activeMission.notes && (
                <button className="text-[11px] font-black text-[#5A57FF] uppercase tracking-widest flex items-center gap-2 group">
                   View latest mission notes <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
           </div>
           <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-[#5A57FF]/5 rounded-full blur-2xl" />
        </div>

        {/* Navigation Card */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-indigo-500/5 p-8 flex flex-col md:flex-row gap-8 items-center">
           <div className="w-full md:w-1/3 h-44 rounded-3xl overflow-hidden relative group shrink-0 border border-slate-100">
             <MapPicker
               initialLocation={missionLocation}
               onLocationSelect={(loc) => {
                 setMissionLocation({ lat: loc.lat, lng: loc.lng });
               }}
             />
           </div>
           
           <div className="flex-1 space-y-6">
              <div className="space-y-1">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Destination Sector</p>
                 <p className="text-lg font-bold text-[#1A1A3D]">{activeMission.location?.address || activeMission.zoneName || activeMission.zoneId || "Assigned destination"}</p>
              </div>
              <div className="flex items-center gap-8">
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-[#10B981] uppercase tracking-widest">Active Status</p>
                    <p className="text-xl font-black text-[#1A1A3D] capitalize">{status.replace('_', ' ')}</p>
                 </div>
                 <div className="w-px h-10 bg-slate-100" />
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Need ID</p>
                    <p className="text-xl font-black text-[#1A1A3D]">{activeMission.id ? `#${String(activeMission.id).slice(0, 8)}` : "N/A"}</p>
                 </div>
              </div>
              <Button 
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${missionLocation.lat},${missionLocation.lng}`, '_blank')}
                className="w-full h-14 bg-[#5A57FF] hover:bg-[#4845E0] rounded-2xl font-bold flex gap-2 shadow-lg shadow-indigo-100"
              >
                 <Navigation className="w-4 h-4" /> Open in Google Maps
              </Button>
           </div>
        </div>

        {/* Field Update Section */}
        <div className="bg-white rounded-[2rem] p-10 border border-slate-100 shadow-sm space-y-8">
           <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-[#1A1A3D]">Log a Field Update</h3>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                         <button
                            onClick={() => setUpdateMode("voice")}
                            className={cn(
                               "px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2",
                               updateMode === "voice" ? "bg-white text-[#5A57FF] shadow-sm" : "text-slate-400"
                            )}
                         >
                            <Mic className="w-3.5 h-3.5" /> Voice
                         </button>
                         <button
                            onClick={() => setUpdateMode("text")}
                            className={cn(
                               "px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2",
                               updateMode === "text" ? "bg-white text-[#5A57FF] shadow-sm" : "text-slate-400"
                            )}
                         >
                            <FileText className="w-3.5 h-3.5" /> Text
                         </button>
              </div>
           </div>

                {updateMode === "text" ? (
                   <Textarea
                      value={updateText}
                      onChange={(event) => setUpdateText(event.target.value)}
                      placeholder="What's happening on ground..."
                      className="min-h-[140px] rounded-3xl bg-slate-50 border-transparent text-slate-600 font-medium p-8 focus:bg-white focus:ring-2 focus:ring-[#5A57FF]/10"
                   />
                ) : (
                   <div className="min-h-[140px] rounded-3xl bg-slate-50 border border-slate-100 text-slate-600 font-medium p-8 flex flex-col gap-4 items-start justify-center">
                        <p className="text-sm font-bold text-[#1A1A3D]">Record a voice update for the timeline</p>
                        <div className="flex gap-3">
                            {!isRecording ? (
                                 <Button onClick={handleStartRecording} className="h-11 px-5 rounded-xl bg-[#5A57FF] hover:bg-[#4845E0] text-white font-bold text-xs uppercase tracking-widest">
                                     Start Recording
                                 </Button>
                            ) : (
                                 <Button onClick={handleStopRecording} className="h-11 px-5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs uppercase tracking-widest">
                                     Stop Recording
                                 </Button>
                            )}
                            {recordedBlob && <span className="text-xs text-emerald-600 font-bold self-center">Voice clip ready</span>}
                        </div>
                   </div>
                )}

                {updateError && (
                   <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                      {updateError}
                   </div>
                )}

           <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Quick Status</p>
              <div className="flex flex-wrap gap-4">
                 {[
                   { label: "En Route", value: "en_route" },
                            { label: "On Ground", value: "on_ground" }
                 ].map((s) => (
                    <button 
                      key={s.value}
                      onClick={() => handleStatusUpdate(s.value)}
                      disabled={isSubmitting}
                      className={cn(
                        "px-6 py-3 rounded-2xl text-xs font-bold transition-all border shadow-sm",
                        status === s.value 
                          ? "bg-[#5A57FF] text-white border-[#5A57FF]" 
                          : "bg-white text-slate-500 border-slate-100 hover:border-indigo-100"
                      )}
                    >
                       {s.label}
                    </button>
                 ))}
              </div>
           </div>

           <Button
             onClick={submitFieldUpdate}
             disabled={isSubmitting}
             className="w-full h-16 bg-gradient-to-r from-[#5A57FF] to-indigo-600 rounded-[1.5rem] font-bold text-lg shadow-xl shadow-indigo-500/10"
           >
              {isSubmitting ? "Submitting..." : "Submit Intelligence Update"}
           </Button>
        </div>
      </div>

      {/* RIGHT COLUMN - Timeline & Close Mission */}
      <div className="lg:w-[40%] space-y-8">
        
        {/* Update Timeline Card */}
        <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm h-fit">
           <div className="flex items-center justify-between mb-10">
              <h4 className="text-xl font-bold text-[#1A1A3D]">Mission Timeline</h4>
              <Badge variant="outline" className="text-[9px] font-black tracking-widest uppercase border-slate-200 text-[#5A57FF]/60 px-3 flex items-center gap-1.5">
                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> Real-time Feed
              </Badge>
           </div>
           
           <div className="space-y-2">
              {updates.map((u, i) => (
                <UpdateRow 
                   key={i} 
                   time={u.timestamp ? new Date(u.timestamp).toLocaleTimeString() : "Now"} 
                   status={u.status || u.type} 
                   text={u.text || u.transcript || `Mission status changed to ${u.status || u.type}`} 
                   type={u.type === 'voice_update' ? 'field' : 'system'} 
                />
              ))}
              {updates.length === 0 && (
                <div className="text-center py-20 opacity-20">
                   <p className="text-sm font-bold">Waiting for updates...</p>
                </div>
              )}
           </div>
        </div>

        {/* Close Mission or Done State */}
        {status === "completed" ? (
           <div className="bg-emerald-500 rounded-[2.5rem] p-10 text-white shadow-xl shadow-emerald-500/20 space-y-8 animate-in zoom-in duration-500">
              <div className="space-y-2">
                 <h4 className="text-2xl font-bold">Mission Complete</h4>
                 <p className="text-emerald-50 font-medium italic opacity-80">Please provide final verification</p>
              </div>
              
              <div className="space-y-6 pt-4">
                 <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Families Impacted</p>
                    <input 
                      type="number" 
                      value={familiesHelped}
                      onChange={(e) => setFamiliesHelped(parseInt(e.target.value))}
                      className="w-full bg-white/10 border border-white/20 p-5 rounded-2xl text-white font-bold focus:bg-white/20 outline-none"
                    />
                 </div>
                 <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Closing Notes</p>
                    <textarea 
                      value={completionNotes}
                      onChange={(e) => setCompletionNotes(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 p-5 rounded-2xl text-white font-medium min-h-[100px] focus:bg-white/20 outline-none"
                      placeholder="Summarize the outcome..."
                    />
                 </div>
                 
                 <Button 
                    onClick={() => handleCompleteMission('success')}
                    disabled={isSubmitting}
                    className="w-full h-16 bg-white text-emerald-600 hover:bg-emerald-50 rounded-2xl font-bold text-lg flex gap-2"
                  >
                    {isSubmitting ? "Finalizing..." : "Submit & Close Mission"} <Check className="w-6 h-6" />
                 </Button>
              </div>
           </div>
        ) : (
           <div className="p-2">
              <Button variant="outline" className="w-full h-16 border-red-100 hover:bg-red-50 text-red-500 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex gap-3 shadow-none">
                 <AlertTriangle className="w-5 h-5" /> Report Safety Issue / Emergency
              </Button>
           </div>
        )}

      </div>
    </div>
  );
};