import { API_BASE_URL } from "@/lib/config";
import React, { useEffect, useState } from "react";
import {
   AlertTriangle,
   Calendar,
   CheckCircle2,
   Clock,
   Database,
   ChevronDown,
   Edit3,
   Eye,
   Grid,
   Loader2,
   MapPin,
   Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@/components/ui/select";
import { fetchWithOutbox } from "@/lib/offline-outbox";

const StatusPill = ({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count?: number }) => (
   <button
      onClick={onClick}
      className={cn(
         "px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-2",
         active
            ? "bg-[#5A57FF] text-white border-[#5A57FF] shadow-lg shadow-indigo-500/20"
            : "bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:text-slate-600"
      )}
   >
      {label}
      {count !== undefined && (
         <span className={cn("px-2 py-0.5 rounded-full text-[10px]", active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400")}>{count}</span>
      )}
   </button>
);

const formatDate = (isoString?: string) => {
   if (!isoString) return { date: "Unknown", time: "" };
   const date = new Date(isoString);
   const now = new Date();

   const isToday = date.toDateString() === now.toDateString();
   const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();

   const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
   const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

   if (isToday) return { date: "Today", time: timeStr };
   if (isYesterday) return { date: "Yesterday", time: timeStr };

   return { date: date.toLocaleDateString([], options), time: timeStr };
};

const getCanonicalReport = (report: any) => {
   const extracted = report?.extractedData && typeof report.extractedData === "object" ? report.extractedData : {};
   const location = extracted.location && typeof extracted.location === "object"
      ? extracted.location
      : report?.location && typeof report.location === "object"
         ? report.location
         : {};

   return {
      zoneId: report?.zoneId || extracted.zoneId || "Unknown",
      needType: extracted.needType || report?.needType || "General",
      severity: (extracted.severity || report?.severity || "medium").toString(),
      familiesAffected: extracted.familiesAffected ?? report?.familiesAffected ?? 0,
      location: {
         lat: location.lat ?? 0,
         lng: location.lng ?? 0,
         address: location.address || report?.location?.address || "",
         landmark: location.landmark || report?.location?.landmark || "",
      },
      landmark: extracted.landmark || report?.landmark || location.landmark || "",
      additionalNotes: extracted.additionalNotes || report?.additionalNotes || "",
      safetySignals: Array.isArray(extracted.safetySignals) ? extracted.safetySignals : (report?.safetySignals || []),
      confidence: extracted.confidence ?? report?.confidence ?? 0,
      fieldConfidences: extracted.fieldConfidences || report?.fieldConfidences || { needType: 0, severity: 0, families: 0 },
      transcript: extracted.transcript || report?.transcript || "",
      transcriptEnglish: extracted.transcriptEnglish || report?.transcriptEnglish || "",
      sourceType: extracted.sourceType || report?.sourceType || report?.inputType || "scan",
      inputType: report?.inputType || extracted.sourceType || "scan",
      imageUrl: extracted.imageUrl || report?.imageUrl || null,
      voiceUrl: extracted.voiceUrl || report?.voiceUrl || null,
      status: report?.status || "synced",
      createdAt: report?.createdAt,
   };
};

const makeFormState = (report: any) => {
   const canonical = getCanonicalReport(report);
   return {
      zoneId: canonical.zoneId,
      needType: canonical.needType,
      severity: canonical.severity,
      familiesAffected: String(canonical.familiesAffected ?? 0),
      address: canonical.location.address || "",
      landmark: canonical.landmark || "",
      additionalNotes: canonical.additionalNotes || "",
      safetySignals: canonical.safetySignals.join(", "),
      transcript: canonical.transcript || "",
      transcriptEnglish: canonical.transcriptEnglish || "",
      confidence: String(canonical.confidence ?? 0),
      sourceType: canonical.sourceType,
      lat: canonical.location.lat ?? 0,
      lng: canonical.location.lng ?? 0,
   };
};

export const MyReports = ({ onNewReport }: { onNewReport: () => void }) => {
   const [filter, setFilter] = useState("All");
   const [searchTerm, setSearchTerm] = useState("");
   const [zoneFilter, setZoneFilter] = useState("all");
   const [timeFilter, setTimeFilter] = useState("7d");
   const [reports, setReports] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [dialogOpen, setDialogOpen] = useState(false);
   const [editMode, setEditMode] = useState(false);
   const [selectedReport, setSelectedReport] = useState<any | null>(null);
   const [formState, setFormState] = useState<any>(null);
   const [saving, setSaving] = useState(false);
   const [saveError, setSaveError] = useState<string | null>(null);
   const [counts, setCounts] = useState({
      synced: 0,
      queued: 0,
      processing: 0,
   });

   const apiBaseUrl = API_BASE_URL;
   const token = localStorage.getItem("nexus_access_token");

   const fetchReports = async () => {
      try {
         const response = await fetch(`${apiBaseUrl}/fieldworker/reports`, {
            headers: {
               Authorization: `Bearer ${token}`,
            },
         });
         if (response.ok) {
            const data = await response.json();
            const fetchedReports = data.reports || [];
            setReports(fetchedReports);

            setCounts({
               synced: fetchedReports.filter((r: any) => r.status === "synced" || !r.status).length,
               queued: fetchedReports.filter((r: any) => r.status === "queued").length,
               processing: fetchedReports.filter((r: any) => r.status === "processing").length,
            });
         }
      } catch (err) {
         console.error("Failed to fetch intelligence history", err);
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => {
      fetchReports();
      const intervalId = window.setInterval(fetchReports, 15000);
      return () => window.clearInterval(intervalId);
   }, [apiBaseUrl, token]);

   const uniqueZones = Array.from(
      new Set(
         reports
            .map((report) => getCanonicalReport(report).zoneId)
            .filter(Boolean)
      )
   );

   const now = Date.now();
   const filteredReports = reports.filter((report) => {
      const canonical = getCanonicalReport(report);
      const statusMatch = filter === "All" || (report.status || "synced").toLowerCase() === filter.toLowerCase();
      const zoneMatch = zoneFilter === "all" || canonical.zoneId === zoneFilter;
      const reportCreated = report.createdAt ? new Date(report.createdAt).getTime() : 0;
      const timeMatch = timeFilter === "all"
         ? true
         : timeFilter === "7d"
            ? reportCreated >= now - (7 * 24 * 60 * 60 * 1000)
            : reportCreated >= now - (30 * 24 * 60 * 60 * 1000);
      const query = searchTerm.trim().toLowerCase();
      const searchMatch = !query
         ? true
         : [
            String(report.id || "").toLowerCase(),
            String(canonical.zoneId || "").toLowerCase(),
            String(canonical.location.address || "").toLowerCase(),
            String(canonical.needType || "").toLowerCase(),
         ].some((value) => value.includes(query));
      return statusMatch && zoneMatch && timeMatch && searchMatch;
   });

   const openReport = (report: any, mode: "view" | "edit" = "view") => {
      setSelectedReport(report);
      setFormState(makeFormState(report));
      setEditMode(mode === "edit");
      setSaveError(null);
      setDialogOpen(true);
   };

   const closeDialog = () => {
      setDialogOpen(false);
      setEditMode(false);
      setSaveError(null);
      setSelectedReport(null);
      setFormState(null);
   };

   const handleResubmit = async () => {
      if (!selectedReport || !formState) return;

      setSaving(true);
      setSaveError(null);

      try {
         const safetySignals = formState.safetySignals
            ? String(formState.safetySignals).split(",").map((item: string) => item.trim()).filter(Boolean)
            : [];

         const payload = {
            zoneId: formState.zoneId,
            needType: formState.needType,
            severity: String(formState.severity).toLowerCase(),
            familiesAffected: Number(formState.familiesAffected || 0),
            location: {
               lat: Number(formState.lat || 0),
               lng: Number(formState.lng || 0),
               address: formState.address,
               landmark: formState.landmark,
            },
            inputType: formState.sourceType === "voice" ? "voice" : "ocr",
            sourceType: formState.sourceType === "voice" ? "voice" : "scan",
            transcript: formState.transcript || null,
            transcriptEnglish: formState.transcriptEnglish || null,
            landmark: formState.landmark || null,
            additionalNotes: formState.additionalNotes || null,
            extractedData: {
               sourceType: formState.sourceType === "voice" ? "voice" : "scan",
               needType: formState.needType,
               severity: String(formState.severity).toLowerCase(),
               familiesAffected: Number(formState.familiesAffected || 0),
               location: {
                  lat: Number(formState.lat || 0),
                  lng: Number(formState.lng || 0),
                  address: formState.address,
                  landmark: formState.landmark,
               },
               landmark: formState.landmark || null,
               additionalNotes: formState.additionalNotes || null,
               safetySignals,
               confidence: Number(formState.confidence || 0),
               fieldConfidences: selectedReport?.fieldConfidences || { needType: 0, severity: 0, families: 0 },
               transcript: formState.transcript || null,
               transcriptEnglish: formState.transcriptEnglish || null,
               imageUrl: selectedReport?.imageUrl || null,
               voiceUrl: selectedReport?.voiceUrl || null,
            },
            confidence: Number(formState.confidence || 0),
            safetySignals,
            fieldConfidences: selectedReport?.fieldConfidences || { needType: 0, severity: 0, families: 0 },
            imageUrl: selectedReport?.imageUrl || null,
            voiceUrl: selectedReport?.voiceUrl || null,
         };

         const { response, queued } = await fetchWithOutbox(`${apiBaseUrl}/fieldworker/reports/${selectedReport.id}`, {
            method: "PATCH",
            headers: {
               "Content-Type": "application/json",
               Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
         });

         if (queued) {
            const queuedReport = { ...selectedReport, status: "queued", updatedAt: new Date().toISOString() };
            setReports((prev) => {
               const next = prev.map((report) => (report.id === queuedReport.id ? queuedReport : report));
               setCounts({
                  synced: next.filter((r: any) => r.status === "synced" || !r.status).length,
                  queued: next.filter((r: any) => r.status === "queued").length,
                  processing: next.filter((r: any) => r.status === "processing").length,
               });
               return next;
            });
            setSelectedReport(queuedReport);
            setFormState(makeFormState(queuedReport));
            setEditMode(false);
            setDialogOpen(false);
            return;
         }

         if (!response?.ok) {
            throw new Error("Failed to resubmit report");
         }

         const data = await response.json();
         const updatedReport = data.report || data;
         setReports((prev) => prev.map((report) => (report.id === updatedReport.id ? updatedReport : report)));
         setSelectedReport(updatedReport);
         setFormState(makeFormState(updatedReport));
         setEditMode(false);
         setDialogOpen(false);
      } catch (err: any) {
         setSaveError(err.message || "Failed to save changes");
      } finally {
         setSaving(false);
      }
   };

   const canonicalSelectedReport = selectedReport ? getCanonicalReport(selectedReport) : null;

   return (
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
         {counts.queued > 0 && (
            <div className="bg-amber-50 border border-amber-100 p-5 rounded-[2.5rem] flex items-center justify-between shadow-sm">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                     <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                     <p className="text-sm font-bold text-amber-900">{counts.queued} report{counts.queued !== 1 ? "s" : ""} waiting to sync</p>
                     <p className="text-xs text-amber-700/70 font-medium">Automatic upload will resume when connection is stable</p>
                  </div>
               </div>
               <Button variant="ghost" className="text-amber-600 border border-amber-200 bg-white hover:bg-amber-50 font-bold text-xs uppercase tracking-widest px-6 h-12 rounded-2xl">
                  Force Sync Now
               </Button>
            </div>
         )}

         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
               <h1 className="text-4xl font-bold text-[#1A1A3D] tracking-tight">Intelligence History</h1>
               <p className="text-slate-500 font-medium mt-1 italic">Manage and track your field submissions</p>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
               <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                     placeholder="Search Report ID or Zone..."
                     value={searchTerm}
                     onChange={(event) => setSearchTerm(event.target.value)}
                     className="pl-12 h-14 rounded-2xl border-slate-100 bg-white shadow-sm focus:ring-[#5A57FF]"
                  />
               </div>
               <Button onClick={onNewReport} className="h-14 px-8 rounded-2xl bg-gradient-to-r from-[#5A57FF] to-purple-600 font-bold shadow-xl shadow-indigo-100 flex gap-2 text-white">
                  New Report <Grid className="w-4 h-4" />
               </Button>
            </div>
         </div>

         <div className="flex flex-wrap items-center gap-4">
            <StatusPill label="All Reports" active={filter === "All"} onClick={() => setFilter("All")} count={reports.length} />
            <StatusPill label="Synced" active={filter === "Synced"} onClick={() => setFilter("Synced")} count={counts.synced} />
            <StatusPill label="Queued" active={filter === "Queued"} onClick={() => setFilter("Queued")} count={counts.queued} />
            <StatusPill label="Processing" active={filter === "Processing"} onClick={() => setFilter("Processing")} count={counts.processing} />

            <div className="h-10 w-px bg-slate-200 mx-2 hidden lg:block" />

            <div className="flex gap-4">
               <Select value={zoneFilter} onValueChange={setZoneFilter}>
                  <SelectTrigger className="h-12 w-[160px] rounded-2xl bg-white border-slate-100 shadow-sm font-bold text-xs">
                     <SelectValue placeholder="All Zones" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">All Zones</SelectItem>
                     {uniqueZones.map((zone) => (
                        <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                     ))}
                  </SelectContent>
               </Select>
               <div className="relative min-w-[150px]">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <Select value={timeFilter} onValueChange={setTimeFilter}>
                     <SelectTrigger className="h-12 px-10 pl-12 rounded-2xl bg-white border-slate-100 shadow-sm font-bold text-xs text-slate-500 flex items-center gap-2">
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
            </div>
         </div>

         <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-indigo-500/5 overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-slate-50/50">
                        <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-10">Report ID</th>
                        <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Zone / Location</th>
                        <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Need Type</th>
                        <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Families</th>
                        <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Severity</th>
                        <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Submitted</th>
                        <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="p-8 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-10">Actions</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {loading ? (
                        <tr>
                           <td colSpan={8} className="p-20 text-center">
                              <div className="flex flex-col items-center gap-4 text-slate-400">
                                 <Loader2 className="w-10 h-10 animate-spin" />
                                 <p className="text-xs font-black uppercase tracking-widest">Refreshing intelligence history...</p>
                              </div>
                           </td>
                        </tr>
                     ) : filteredReports.length > 0 ? (
                        filteredReports.map((report) => {
                           const timeInfo = formatDate(report.createdAt);
                           const canonical = getCanonicalReport(report);
                           return (
                              <tr key={report.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                                 <td className="p-8 pl-10 font-mono text-[10px] font-bold text-slate-400">#{report.id?.slice(-8).toUpperCase()}</td>
                                 <td className="p-8">
                                    <div className="flex items-center gap-3">
                                       <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-[#5A57FF]">
                                          <MapPin className="w-4 h-4" />
                                       </div>
                                       <span className="font-bold text-[#1A1A3D] text-sm">{canonical.zoneId || canonical.location.address || "Unknown"}</span>
                                    </div>
                                 </td>
                                 <td className="p-8">
                                    <Badge className="bg-[#F3F2FF] text-[#5A57FF] border-none px-4 py-1.5 rounded-xl font-bold text-xs uppercase">{canonical.needType || "General"}</Badge>
                                 </td>
                                 <td className="p-8 text-center">
                                    <span className="font-black text-[#1A1A3D] text-sm">{canonical.familiesAffected || 0}</span>
                                 </td>
                                 <td className="p-8">
                                    <div className="flex items-center gap-2">
                                       <div
                                          className={cn(
                                             "w-2 h-2 rounded-full",
                                             canonical.severity?.toLowerCase() === "critical"
                                                ? "bg-red-500 animate-pulse"
                                                : canonical.severity?.toLowerCase() === "high"
                                                   ? "bg-amber-500"
                                                   : canonical.severity?.toLowerCase() === "medium"
                                                      ? "bg-blue-500"
                                                      : "bg-emerald-500"
                                          )}
                                       />
                                       <span
                                          className={cn(
                                             "text-xs font-black uppercase tracking-widest",
                                             canonical.severity?.toLowerCase() === "critical"
                                                ? "text-red-500"
                                                : canonical.severity?.toLowerCase() === "high"
                                                   ? "text-amber-600"
                                                   : canonical.severity?.toLowerCase() === "medium"
                                                      ? "text-blue-600"
                                                      : "text-emerald-600"
                                          )}
                                       >
                                          {canonical.severity || "Medium"}
                                       </span>
                                    </div>
                                 </td>
                                 <td className="p-8">
                                    <div className="flex flex-col">
                                       <span className="text-sm font-bold text-[#1A1A3D]">{timeInfo.date}</span>
                                       <span className="text-[10px] font-medium text-slate-400">{timeInfo.time}</span>
                                    </div>
                                 </td>
                                 <td className="p-8">
                                    {(report.status || "synced").toLowerCase() === "synced" ? (
                                       <Badge className="bg-emerald-50 text-emerald-600 border-none px-4 py-1.5 rounded-full font-black text-[9px] tracking-widest uppercase flex w-fit gap-2">
                                          Synced <CheckCircle2 className="w-3 h-3" />
                                       </Badge>
                                    ) : (report.status || "").toLowerCase() === "queued" ? (
                                       <Badge className="bg-amber-50 text-amber-500 border-none px-4 py-1.5 rounded-full font-black text-[9px] tracking-widest uppercase flex w-fit gap-2">
                                          Queued <Clock className="w-3 h-3" />
                                       </Badge>
                                    ) : (
                                       <Badge className="bg-indigo-50 text-[#5A57FF] border-none px-4 py-1.5 rounded-full font-black text-[9px] tracking-widest uppercase flex w-fit gap-2 animate-pulse">
                                          Processing <Loader2 className="w-3 h-3 animate-spin" />
                                       </Badge>
                                    )}
                                 </td>
                                 <td className="p-8 pr-10 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                       <button
                                          type="button"
                                          onClick={() => openReport(report, "view")}
                                          className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-[#5A57FF] hover:border-indigo-100 transition-all shadow-sm"
                                       >
                                          <Eye className="w-4 h-4" />
                                       </button>
                                       <button
                                          type="button"
                                          onClick={() => openReport(report, "edit")}
                                          className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-[#5A57FF] hover:border-indigo-100 transition-all shadow-sm"
                                       >
                                          <Edit3 className="w-4 h-4" />
                                       </button>
                                    </div>
                                 </td>
                              </tr>
                           );
                        })
                     ) : (
                        <tr>
                           <td colSpan={8} className="p-32 text-center">
                              <div className="flex flex-col items-center gap-4 text-slate-300">
                                 <Database className="w-12 h-12 opacity-20" />
                                 <div className="space-y-1">
                                    <p className="text-sm font-black uppercase tracking-widest text-slate-400">Zero Intel History</p>
                                    <p className="text-[10px] font-bold text-slate-400/60 uppercase tracking-[0.2em]">Start scanning to populate field intelligence</p>
                                 </div>
                              </div>
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>

            <div className="p-6 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
               <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                  {loading ? "Counting reports..." : filteredReports.length > 0 ? `Showing ${filteredReports.length} of ${reports.length} intelligence submissions` : "No submissions found"}
               </p>
               <div className="flex gap-2">
                  <Button variant="outline" className="h-10 px-6 rounded-xl border-slate-200 font-bold text-xs" disabled>
                     Previous
                  </Button>
                  <Button variant="outline" className="h-10 px-6 rounded-xl border-slate-200 font-bold text-xs hover:bg-[#F3F2FF] hover:text-[#5A57FF] hover:border-indigo-100" disabled={reports.length < 20}>
                     Next
                  </Button>
               </div>
            </div>
         </div>

         <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
            <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] p-0 overflow-hidden bg-white rounded-[2rem] border-slate-100">
               <div className="border-b border-slate-100 px-6 py-5 flex items-start justify-between gap-4">
                  <DialogHeader className="text-left space-y-2">
                     <DialogTitle className="text-2xl font-bold text-[#1A1A3D]">
                        {editMode ? "Edit and Resubmit Report" : "Submitted Report"}
                     </DialogTitle>
                     <DialogDescription>
                        Review the submitted document, make edits, and send the updated version back to the backend.
                     </DialogDescription>
                  </DialogHeader>

                  <div className="flex items-center gap-2 shrink-0">
                     {!editMode ? (
                        <Button type="button" onClick={() => setEditMode(true)} className="h-11 px-4 rounded-xl bg-[#5A57FF] hover:bg-[#4845E0] text-white font-bold">
                           Edit Report
                        </Button>
                     ) : (
                        <Button type="button" onClick={() => setEditMode(false)} variant="outline" className="h-11 px-4 rounded-xl border-slate-200 font-bold">
                           View Only
                        </Button>
                     )}
                  </div>
               </div>

               <ScrollArea className="max-h-[calc(92vh-92px)]">
                  <div className="p-6 space-y-6">
                     {saveError && (
                        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                           {saveError}
                        </div>
                     )}

                     {canonicalSelectedReport && !editMode && (
                        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                           <div className="space-y-5">
                              <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50/60 p-5">
                                 <div className="flex items-center justify-between gap-4 mb-5">
                                    <div>
                                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Document Preview</p>
                                       <h3 className="text-xl font-bold text-[#1A1A3D] mt-1">{canonicalSelectedReport.needType}</h3>
                                    </div>
                                    <Badge className="bg-[#F3F2FF] text-[#5A57FF] border-none px-4 py-1.5 rounded-full font-black text-[9px] tracking-widest uppercase">
                                       {canonicalSelectedReport.sourceType}
                                    </Badge>
                                 </div>

                                 <div className="grid grid-cols-2 gap-3">
                                    <InfoTile label="Zone" value={canonicalSelectedReport.zoneId} />
                                    <InfoTile label="Severity" value={canonicalSelectedReport.severity} />
                                    <InfoTile label="Families" value={String(canonicalSelectedReport.familiesAffected)} />
                                    <InfoTile label="Confidence" value={`${canonicalSelectedReport.confidence}%`} />
                                    <InfoTile label="Location" value={canonicalSelectedReport.location.address || canonicalSelectedReport.zoneId} />
                                    <InfoTile label="Landmark" value={canonicalSelectedReport.landmark || "Not set"} />
                                 </div>
                              </div>

                              <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 space-y-4">
                                 <div className="flex items-center justify-between gap-4">
                                    <div>
                                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Report Summary</p>
                                       <p className="text-sm text-slate-500 mt-1">A concise view of the submitted report.</p>
                                    </div>
                                    <Badge className="bg-emerald-50 text-emerald-600 border-none px-4 py-1.5 rounded-full font-black text-[9px] tracking-widest uppercase">
                                       {selectedReport?.status || "synced"}
                                    </Badge>
                                 </div>

                                 <div className="grid gap-3 sm:grid-cols-2">
                                    <DetailRow label="Submitted At" value={formatDate(selectedReport?.createdAt).date} secondary={formatDate(selectedReport?.createdAt).time} />
                                    <DetailRow label="Source Type" value={canonicalSelectedReport.sourceType} />
                                    <DetailRow label="Need Type" value={canonicalSelectedReport.needType} />
                                    <DetailRow label="Safety Signals" value={canonicalSelectedReport.safetySignals.length > 0 ? canonicalSelectedReport.safetySignals.join(", ") : "None"} />
                                 </div>

                                 <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location</p>
                                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                          {canonicalSelectedReport.location.lat}, {canonicalSelectedReport.location.lng}
                                       </span>
                                    </div>
                                    <p className="text-sm font-semibold text-[#1A1A3D] break-words">
                                       {canonicalSelectedReport.location.address || "No address provided"}
                                    </p>
                                    <p className="text-sm text-slate-500 break-words">
                                       {canonicalSelectedReport.landmark || "No landmark provided"}
                                    </p>
                                 </div>
                              </div>
                           </div>

                           <div className="space-y-5">
                              <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 space-y-4">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quick Details</p>
                                 <DetailRow label="Status" value={selectedReport?.status || "synced"} />
                                 <DetailRow label="Severity" value={canonicalSelectedReport.severity} />
                                 <DetailRow label="Families Affected" value={String(canonicalSelectedReport.familiesAffected)} />
                                 <DetailRow label="Location Coordinates" value={`${canonicalSelectedReport.location.lat}, ${canonicalSelectedReport.location.lng}`} />
                              </div>

                              <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 space-y-4">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transcript</p>
                                 <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 whitespace-pre-wrap min-h-24">
                                    {canonicalSelectedReport.transcript || canonicalSelectedReport.transcriptEnglish || "No transcript available for this report."}
                                 </div>
                              </div>

                              <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 space-y-4">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes</p>
                                 <p className="text-sm text-slate-600 leading-relaxed">
                                    {canonicalSelectedReport.additionalNotes || "No additional notes were attached to this submission."}
                                 </p>
                              </div>
                           </div>
                        </div>
                     )}

                     {formState && editMode && (
                        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                           <div className="space-y-5">
                              <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50/60 p-5 space-y-4">
                                 <div className="flex items-center justify-between gap-4">
                                    <div>
                                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Editable Fields</p>
                                       <h3 className="text-xl font-bold text-[#1A1A3D] mt-1">Update the report</h3>
                                    </div>
                                    <Badge className="bg-white text-slate-500 border border-slate-100 px-4 py-1.5 rounded-full font-black text-[9px] tracking-widest uppercase">
                                       {formState.sourceType}
                                    </Badge>
                                 </div>

                                 <div className="grid gap-4 sm:grid-cols-2">
                                    <FieldInput label="Zone" value={formState.zoneId} onChange={(value) => setFormState((prev: any) => ({ ...prev, zoneId: value }))} />
                                    <FieldInput label="Need Type" value={formState.needType} onChange={(value) => setFormState((prev: any) => ({ ...prev, needType: value }))} />
                                    <div className="space-y-2">
                                       <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Severity</Label>
                                       <Select value={formState.severity} onValueChange={(value) => setFormState((prev: any) => ({ ...prev, severity: value }))}>
                                          <SelectTrigger className="h-12 rounded-2xl bg-white border-slate-100 shadow-sm font-semibold">
                                             <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                             <SelectItem value="low">Low</SelectItem>
                                             <SelectItem value="medium">Medium</SelectItem>
                                             <SelectItem value="high">High</SelectItem>
                                             <SelectItem value="critical">Critical</SelectItem>
                                          </SelectContent>
                                       </Select>
                                    </div>
                                    <FieldInput label="Families Affected" type="number" value={formState.familiesAffected} onChange={(value) => setFormState((prev: any) => ({ ...prev, familiesAffected: value }))} />
                                    <FieldInput label="Address" value={formState.address} onChange={(value) => setFormState((prev: any) => ({ ...prev, address: value }))} />
                                    <FieldInput label="Landmark" value={formState.landmark} onChange={(value) => setFormState((prev: any) => ({ ...prev, landmark: value }))} />
                                 </div>

                                 <TextareaBlock
                                    label="Additional Notes"
                                    value={formState.additionalNotes}
                                    onChange={(value) => setFormState((prev: any) => ({ ...prev, additionalNotes: value }))}
                                    placeholder="Add any extra context, observations, or changes to the situation."
                                 />

                                 <TextareaBlock
                                    label="Safety Signals"
                                    value={formState.safetySignals}
                                    onChange={(value) => setFormState((prev: any) => ({ ...prev, safetySignals: value }))}
                                    placeholder="comma,separated,safety,signals"
                                 />

                                 {formState.sourceType === "voice" && (
                                    <>
                                       <TextareaBlock
                                          label="Transcript"
                                          value={formState.transcript}
                                          onChange={(value) => setFormState((prev: any) => ({ ...prev, transcript: value }))}
                                          placeholder="Voice transcript"
                                       />
                                       <TextareaBlock
                                          label="Transcript English"
                                          value={formState.transcriptEnglish}
                                          onChange={(value) => setFormState((prev: any) => ({ ...prev, transcriptEnglish: value }))}
                                          placeholder="English translation"
                                       />
                                    </>
                                 )}
                              </div>
                           </div>

                           <div className="space-y-5">
                              <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 space-y-4">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Submission Summary</p>
                                 <DetailRow label="Current Source" value={formState.sourceType} />
                                 <DetailRow label="Confidence" value={`${formState.confidence}%`} />
                                 <DetailRow label="Latitude" value={String(formState.lat)} />
                                 <DetailRow label="Longitude" value={String(formState.lng)} />
                                 <DetailRow label="Image URL" value={selectedReport?.imageUrl ? "Available" : "Not attached"} />
                                 <DetailRow label="Voice URL" value={selectedReport?.voiceUrl ? "Available" : "Not attached"} />
                              </div>

                              <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5 space-y-4">
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resubmit Preview</p>
                                 <pre className="max-h-80 overflow-auto rounded-2xl bg-slate-950 px-4 py-4 text-[11px] leading-6 text-slate-100">{JSON.stringify({
                                    zoneId: formState.zoneId,
                                    needType: formState.needType,
                                    severity: formState.severity,
                                    familiesAffected: formState.familiesAffected,
                                    location: {
                                       lat: formState.lat,
                                       lng: formState.lng,
                                       address: formState.address,
                                       landmark: formState.landmark,
                                    },
                                    additionalNotes: formState.additionalNotes,
                                    safetySignals: formState.safetySignals,
                                    transcript: formState.transcript,
                                    transcriptEnglish: formState.transcriptEnglish,
                                 }, null, 2)}</pre>
                              </div>
                           </div>
                        </div>
                     )}

                     <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                        {editMode ? (
                           <>
                              <Button type="button" variant="outline" className="h-12 px-5 rounded-2xl font-bold" onClick={() => setEditMode(false)}>
                                 Cancel
                              </Button>
                              <Button type="button" onClick={handleResubmit} disabled={saving} className="h-12 px-6 rounded-2xl bg-[#5A57FF] hover:bg-[#4845E0] font-bold text-white">
                                 {saving ? "Saving..." : "Resubmit Changes"}
                              </Button>
                           </>
                        ) : (
                           <Button type="button" variant="outline" className="h-12 px-5 rounded-2xl font-bold" onClick={closeDialog}>
                              Close
                           </Button>
                        )}
                     </div>
                  </div>
               </ScrollArea>
            </DialogContent>
         </Dialog>
      </div>
   );
};

const InfoTile = ({ label, value }: { label: string; value: string }) => (
   <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#1A1A3D] break-words">{value}</p>
   </div>
);

const DetailRow = ({ label, value, secondary }: { label: string; value: string; secondary?: string }) => (
   <div className="rounded-2xl bg-slate-50 px-4 py-3 border border-slate-100">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-[#1A1A3D] break-words">{value}</p>
      {secondary && <p className="text-[11px] text-slate-400 mt-1">{secondary}</p>}
   </div>
);

const FieldInput = ({
   label,
   value,
   onChange,
   type = "text",
}: {
   label: string;
   value: string;
   onChange: (value: string) => void;
   type?: string;
}) => (
   <div className="space-y-2">
      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</Label>
      <Input
         type={type}
         value={value}
         onChange={(event) => onChange(event.target.value)}
         className="h-12 rounded-2xl bg-white border-slate-100 shadow-sm font-semibold"
      />
   </div>
);

const TextareaBlock = ({
   label,
   value,
   onChange,
   placeholder,
}: {
   label: string;
   value: string;
   onChange: (value: string) => void;
   placeholder?: string;
}) => (
   <div className="space-y-2">
      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</Label>
      <Textarea
         value={value}
         onChange={(event) => onChange(event.target.value)}
         placeholder={placeholder}
         className="min-h-[110px] rounded-2xl bg-white border-slate-100 shadow-sm font-medium"
      />
   </div>
);