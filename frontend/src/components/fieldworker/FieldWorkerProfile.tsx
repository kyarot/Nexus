import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  User, 
  MapPin, 
  Globe, 
  Bell, 
  Settings, 
  LogOut, 
  Edit3, 
  Phone, 
  Mail, 
  Languages, 
  Trash2, 
  History,
  FileText,
  Zap,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  Wifi,
  WifiOff,
  CloudLightning,
  Database,
  Camera,
  Loader2
} from "lucide-react";
import { MapPicker } from "@/components/nexus/MapPicker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listNotifications, markNotificationRead, type NotificationItem } from "@/lib/ops-api";
import { useToast } from "@/hooks/use-toast";

const ProfileStat = ({ label, value, icon: Icon }: { label: string, value: string | number, icon: any }) => (
  <div className="bg-white rounded-[2.5rem] p-8 border border-slate-50 flex items-center justify-between shadow-sm flex-1">
    <div className="space-y-1">
       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{label}</p>
       <p className="text-3xl font-black text-[#1A1A3D]">{value}</p>
    </div>
    <div className="w-12 h-12 rounded-2xl bg-[#F3F2FF] flex items-center justify-center text-[#5A57FF]">
       <Icon className="w-6 h-6" />
    </div>
  </div>
);

const SettingCard = ({ title, children, icon: Icon, action }: { title: string, children: React.ReactNode, icon: any, action?: React.ReactNode }) => (
  <div className="bg-white rounded-[2.5rem] p-10 border border-slate-50 shadow-sm space-y-8 relative overflow-hidden group">
    <div className="flex items-center justify-between relative z-10">
       <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F3F2FF] flex items-center justify-center text-[#5A57FF]">
             <Icon className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold text-[#1A1A3D]">{title}</h3>
       </div>
       {action && <div className="z-10">{action}</div>}
    </div>
    <div className="relative z-10">{children}</div>
    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/20 rounded-full -mr-16 -mt-16 blur-3xl" />
  </div>
);

export const FieldWorkerProfile = () => {
   const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
   const [zoneOptions, setZoneOptions] = useState<string[]>([]);
   const [selectedZones, setSelectedZones] = useState<string[]>([]);
   const [selectedOfflineZones, setSelectedOfflineZones] = useState<string[]>([]);
    const [additionalLanguages, setAdditionalLanguages] = useState<string[]>([]);
    const [primaryLanguage, setPrimaryLanguage] = useState("English");
    const [languageDraft, setLanguageDraft] = useState("");
   const [isSavingZones, setIsSavingZones] = useState(false);
    const [isSavingLanguages, setIsSavingLanguages] = useState(false);
      const [isEditingProfile, setIsEditingProfile] = useState(false);
      const [isSavingProfile, setIsSavingProfile] = useState(false);
         const [profileNameDraft, setProfileNameDraft] = useState("");
      const [profilePhoneDraft, setProfilePhoneDraft] = useState("");
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState({
    activeMissions: 0,
    totalReports: 0,
    points: 12.8,
    zone: "N/A"
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
   const zoneSettingsRef = useRef<HTMLDivElement | null>(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
  const token = localStorage.getItem("nexus_access_token");

  useEffect(() => {
    const storedUser = localStorage.getItem("nexus_user");
    if (storedUser) {
         const parsed = JSON.parse(storedUser);
         setUser(parsed);
          setProfileNameDraft(String(parsed?.name || ""));
          setProfilePhoneDraft(String(parsed?.phone || ""));
          setCurrentLocation(parsed?.currentLocation || null);
         setSelectedZones(Array.isArray(parsed?.zones) ? parsed.zones : []);
         setSelectedOfflineZones(Array.isArray(parsed?.offlineZones) ? parsed.offlineZones : []);
             setAdditionalLanguages(Array.isArray(parsed?.additionalLanguages) ? parsed.additionalLanguages : []);
             setPrimaryLanguage(typeof parsed?.primaryLanguage === "string" ? parsed.primaryLanguage : "English");
    }

      const fetchProfile = async () => {
         try {
            const response = await fetch(`${apiBaseUrl}/auth/me`, {
               headers: {
                  "Authorization": `Bearer ${token}`,
               },
            });

            if (!response.ok) {
               return;
            }

            const data = await response.json();

            setProfileNameDraft(String(data?.name || ""));
            setProfilePhoneDraft(String(data?.phone || ""));
            setCurrentLocation(data?.currentLocation || null);
            setSelectedZones(Array.isArray(data?.zones) ? data.zones : []);
            setSelectedOfflineZones(Array.isArray(data?.offlineZones) ? data.offlineZones : []);
            setPrimaryLanguage(typeof data?.primaryLanguage === "string" ? data.primaryLanguage : "English");
            setAdditionalLanguages(Array.isArray(data?.additionalLanguages) ? data.additionalLanguages : []);
            localStorage.setItem("nexus_user", JSON.stringify(data));
         } catch (err) {
            console.error("Failed to fetch profile data", err);
         }
      };

      const fetchStats = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/fieldworker/stats`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setStats({
            activeMissions: data.activeMissions,
            totalReports: data.totalReports,
            points: data.points,
            zone: data.zone
          });
        }
      } catch (err) {
        console.error("Failed to fetch profile stats", err);
      }
    };

      const fetchNotifications = async () => {
         try {
            const data = await listNotifications(true);
            setNotifications((data.notifications || []).slice(0, 4));
         } catch (err) {
            console.error("Failed to fetch notifications", err);
         }
      };

      const fetchZoneOptions = async () => {
         try {
            const response = await fetch(`${apiBaseUrl}/fieldworker/profile/zone-options`, {
               headers: {
                  "Authorization": `Bearer ${token}`,
               },
            });

            if (!response.ok) {
               return;
            }

            const data = await response.json();
            setZoneOptions(Array.isArray(data?.zones) ? data.zones : []);
            if (Array.isArray(data?.selectedZones)) {
               setSelectedZones(data.selectedZones);
            }
            if (Array.isArray(data?.selectedOfflineZones)) {
               setSelectedOfflineZones(data.selectedOfflineZones);
            }
         } catch (err) {
            console.error("Failed to fetch available profile zones", err);
         }
      };

    void fetchProfile();
    fetchStats();
      fetchZoneOptions();
      void fetchNotifications();
   }, []);

   const currentZoneLabel = useMemo(
      () => selectedZones[0] || stats.zone || "No zone selected",
      [selectedZones, stats.zone]
   );

   const zoneSummary = useMemo(
      () => selectedZones.length ? selectedZones.join(", ") : "No zones selected",
      [selectedZones]
   );

   const toggleZone = (zoneName: string) => {
      setSelectedZones((current) =>
         current.includes(zoneName) ? current.filter((item) => item !== zoneName) : [...current, zoneName]
      );
   };

   const toggleOfflineZone = (zoneName: string) => {
      setSelectedOfflineZones((current) =>
         current.includes(zoneName) ? current.filter((item) => item !== zoneName) : [...current, zoneName]
      );
   };

   const saveZonePreferences = async () => {
      setIsSavingZones(true);
      try {
         const response = await fetch(`${apiBaseUrl}/auth/me`, {
            method: "PATCH",
            headers: {
               "Content-Type": "application/json",
               "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
               zones: selectedZones,
               offlineZones: selectedOfflineZones,
               volunteerProfileSettings: {
                  profileMeta: {
                     zoneLabel: selectedZones[0] || selectedOfflineZones[0] || null,
                  },
               },
               currentLocation,
            }),
         });

         if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.detail || "Failed to save zone preferences");
         }

         const updatedUser = {
            ...(user || {}),
            zones: selectedZones,
            offlineZones: selectedOfflineZones,
            volunteerProfileSettings: {
               ...(user?.volunteerProfileSettings || {}),
               profileMeta: {
                  ...(user?.volunteerProfileSettings?.profileMeta || {}),
                  zoneLabel: selectedZones[0] || selectedOfflineZones[0] || null,
               },
            },
         };
         setUser(updatedUser);
         localStorage.setItem("nexus_user", JSON.stringify(updatedUser));
         window.dispatchEvent(new Event("storage"));
         window.dispatchEvent(new Event("userUpdate"));
         toast({ title: "Zone preferences saved", description: "Field area and offline cache zones updated." });
      } catch (err) {
         console.error("Failed to save profile zones", err);
         toast({
            title: "Save failed",
            description: err instanceof Error ? err.message : "Could not save zone preferences",
            variant: "destructive",
         });
      } finally {
         setIsSavingZones(false);
      }
   };

   const saveLanguagePreferences = async () => {
      setIsSavingLanguages(true);
      try {
         const response = await fetch(`${apiBaseUrl}/auth/me`, {
            method: "PATCH",
            headers: {
               "Content-Type": "application/json",
               "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
               primaryLanguage,
               additionalLanguages,
            }),
         });

         if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.detail || "Failed to save language preferences");
         }

         const updatedUser = {
            ...(user || {}),
            primaryLanguage,
            additionalLanguages,
         };
         setUser(updatedUser);
         localStorage.setItem("nexus_user", JSON.stringify(updatedUser));
         window.dispatchEvent(new Event("storage"));
         window.dispatchEvent(new Event("userUpdate"));
         toast({ title: "Language preferences saved", description: "Translation defaults updated." });
      } catch (err) {
         console.error("Failed to save language preferences", err);
         toast({
            title: "Save failed",
            description: err instanceof Error ? err.message : "Could not save language preferences",
            variant: "destructive",
         });
      } finally {
         setIsSavingLanguages(false);
      }
   };

   const savePersonalInfo = async () => {
      if (!profileNameDraft.trim()) {
        toast({ title: "Name required", description: "Please enter your name.", variant: "destructive" });
        return;
      }

      setIsSavingProfile(true);
      try {
         const response = await fetch(`${apiBaseUrl}/auth/me`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: profileNameDraft.trim(),
              phone: profilePhoneDraft.trim() || null,
              currentLocation,
            }),
         });

         if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.detail || "Failed to save personal info");
         }

         const updatedUser = {
            ...(user || {}),
            name: profileNameDraft.trim(),
            phone: profilePhoneDraft.trim() || null,
         };
         setUser(updatedUser);
         localStorage.setItem("nexus_user", JSON.stringify(updatedUser));
         window.dispatchEvent(new Event("storage"));
         window.dispatchEvent(new Event("userUpdate"));
         setIsEditingProfile(false);
         toast({ title: "Profile updated", description: "Personal information saved." });
      } catch (err) {
         console.error("Failed to save profile info", err);
         toast({
            title: "Save failed",
            description: err instanceof Error ? err.message : "Could not save profile info",
            variant: "destructive",
         });
      } finally {
         setIsSavingProfile(false);
      }
   };

   const markSingleNotificationRead = async (item: NotificationItem) => {
      if (item.read) {
        return;
      }
      try {
        await markNotificationRead(item.id);
        setNotifications((current) =>
          current.map((row) => (row.id === item.id ? { ...row, read: true } : row))
        );
      } catch (err) {
        console.error("Failed to mark notification read", err);
      }
   };

   const addLanguage = () => {
      const value = languageDraft.trim();
      if (!value || additionalLanguages.includes(value)) {
        setLanguageDraft("");
        return;
      }
      setAdditionalLanguages((current) => [...current, value]);
      setLanguageDraft("");
   };

   const removeLanguage = (language: string) => {
      setAdditionalLanguages((current) => current.filter((item) => item !== language));
   };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

      if (!file.type.startsWith("image/")) {
         toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
         return;
      }
      if (file.size > 2 * 1024 * 1024) {
         toast({ title: "File too large", description: "Please upload an image under 2MB.", variant: "destructive" });
         return;
      }

    setIsUploading(true);

    try {
         const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("Failed to read image"));
            reader.readAsDataURL(file);
         });

         const response = await fetch(`${apiBaseUrl}/auth/me`, {
            method: "PATCH",
            headers: {
               "Content-Type": "application/json",
               "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ profilePhoto: dataUrl }),
         });

         if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.detail || "Avatar update failed");
         }

         const updatedUser = { ...user, profilePhoto: dataUrl, photoUrl: dataUrl };
         setUser(updatedUser);
         localStorage.setItem("nexus_user", JSON.stringify(updatedUser));
         window.dispatchEvent(new Event('storage'));
         window.dispatchEvent(new Event('userUpdate'));
         toast({ title: "Profile photo updated" });
    } catch (err) {
      console.error("Avatar upload failed", err);
         toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Avatar upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* LEFT COLUMN - Identity Card */}
      <div className="lg:w-[320px] space-y-8 shrink-0">
        
        <div className="bg-white rounded-[3rem] p-10 border border-slate-50 shadow-xl shadow-indigo-500/5 text-center space-y-8 relative overflow-hidden">
           <div className="relative w-40 h-40 mx-auto group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#5A57FF] to-purple-600 rounded-[2.5rem] rotate-6 group-hover:rotate-12 transition-transform duration-500" />
              
              {/* Profile Image Container */}
                     <div 
                        className="absolute inset-0 bg-white rounded-[2.5rem] overflow-hidden border-2 border-slate-100 shadow-sm cursor-pointer group/avatar"
                onClick={() => fileInputRef.current?.click()}
              >
                  {isUploading ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                       <Loader2 className="w-8 h-8 text-[#5A57FF] animate-spin" />
                    </div>
                  ) : (
                    <>
                      <img 
                                    src={user?.photoUrl || user?.profilePhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'User'}`} 
                        className="w-full h-full object-cover transition-all group-hover/avatar:scale-110 group-hover/avatar:blur-[2px]" 
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                         <Camera className="w-10 h-10 text-white drop-shadow-lg" />
                      </div>
                    </>
                  )}
              </div>
              
              {/* Hidden File Input */}
              <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef} 
                accept="image/*"
                onChange={handleImageUpload}
              />

              <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-emerald-500 border-4 border-white flex items-center justify-center text-white shadow-lg">
                  <CheckCircle2 className="w-5 h-5" />
              </div>
           </div>
           
           <div className="space-y-3">
              <div className="flex flex-col items-center gap-2">
                 <h2 className="text-3xl font-black text-[#1A1A3D] tracking-tight">{user?.name || "Field Worker"}</h2>
                 <Badge className="bg-amber-500 text-white border-none font-black text-[9px] tracking-[0.2em] uppercase px-4 py-1.5 h-6">Verified Personnel</Badge>
              </div>
              <p className="text-xs font-bold text-slate-400 flex items-center justify-center gap-1.5 uppercase tracking-widest">
                 <MapPin className="w-3.5 h-3.5" /> {currentZoneLabel}
              </p>
           </div>
           
           <div className="pt-8 border-t border-slate-50 grid grid-cols-2 gap-4">
              <div className="text-center">
                 <p className="text-2xl font-black text-[#1A1A3D]">{stats.totalReports}</p>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reports</p>
              </div>
              <div className="w-px h-8 bg-slate-100 mx-auto self-center" />
              <div className="text-center">
                 <p className="text-2xl font-black text-[#1A1A3D]">{stats.activeMissions}</p>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Missions</p>
              </div>
           </div>
        </div>

      <div ref={zoneSettingsRef} className="bg-white rounded-[2.5rem] p-8 border border-slate-50 shadow-sm space-y-6">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Current Location</p>
           
           <div className="h-64 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
             <MapPicker 
                onLocationSelect={(loc) => {
                  setCurrentLocation({ lat: loc.lat, lng: loc.lng });
                  if (loc.areaName && !selectedZones.includes(loc.areaName)) {
                    // Optionally auto-select zone
                  }
                }}
                initialLocation={currentLocation || undefined}
                radiusMeters={1000}
             />
           </div>

           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 italic">Assigned Area</p>
           <div className="space-y-4">
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mission/NGO Available Zones</p>
                 <div className="flex flex-wrap gap-2">
                               {zoneOptions.length ? zoneOptions.map((zone) => {
                                 const active = selectedZones.includes(zone);
                      return (
                        <button
                                       key={zone}
                          type="button"
                                       onClick={() => toggleZone(zone)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all",
                            active ? "bg-indigo-100 border-indigo-200 text-[#4338CA]" : "bg-white border-slate-200 text-slate-500 hover:border-indigo-200"
                          )}
                        >
                                       {zone}
                        </button>
                      );
                    }) : (
                      <div className="text-xs text-slate-400 font-medium">No zones discovered yet from missions/coordinator setup.</div>
                    )}
                 </div>
              </div>

              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Offline Pre-cache Zones</p>
                 <div className="flex flex-wrap gap-2">
                              {zoneOptions.length ? zoneOptions.map((zone) => {
                                 const active = selectedOfflineZones.includes(zone);
                      return (
                        <button
                                       key={`offline-${zone}`}
                          type="button"
                                       onClick={() => toggleOfflineZone(zone)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl border text-xs font-bold transition-all",
                            active ? "bg-emerald-100 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-500 hover:border-emerald-200"
                          )}
                        >
                                       {zone}
                        </button>
                      );
                    }) : null}
                 </div>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Selected: {zoneSummary}</p>
           </div>

                <Button
             variant="ghost"
             onClick={saveZonePreferences}
             disabled={isSavingZones}
             className="w-full h-12 text-[#5A57FF] font-bold text-[10px] uppercase tracking-widest gap-2"
           >
              {isSavingZones ? "Saving..." : "Save Zone Preferences"} <ChevronRight className="w-3 h-3" />
           </Button>
        </div>

      </div>

      {/* RIGHT COLUMN - Settings */}
      <div className="flex-1 space-y-8">
        
        {/* Statistics cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <ProfileStat label="Mission Points" value={(user?.impactPoints ?? stats.points)?.toFixed?.(1) || String(user?.impactPoints ?? stats.points ?? 0)} icon={Zap} />
           <ProfileStat label="Active Success" value={`${Math.round(Number(user?.successRate ?? 0))}%`} icon={CheckCircle2} />
        </div>

        {/* Personal info */}
        <SettingCard 
          title="Personal Information" 
          icon={User} 
               action={
                  <Button
                     variant="ghost"
                     className="text-[#5A57FF] font-bold text-xs flex gap-2 h-10 px-5 rounded-xl hover:bg-indigo-50"
                     onClick={() => {
                        if (isEditingProfile) {
                           setProfileNameDraft(String(user?.name || ""));
                           setProfilePhoneDraft(String(user?.phone || ""));
                        }
                        setIsEditingProfile((current) => !current);
                     }}
                  >
                     <Edit3 className="w-4 h-4" /> {isEditingProfile ? "Cancel" : "Edit Profile"}
                  </Button>
               }
        >
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-2 md:col-span-2">
                         <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</Label>
                         {isEditingProfile ? (
                            <Input value={profileNameDraft} onChange={(event) => setProfileNameDraft(event.target.value)} className="h-14 rounded-2xl" />
                         ) : (
                            <div className="flex items-center gap-3 bg-slate-50 px-5 h-14 rounded-2xl border border-transparent">
                                 <User className="w-4 h-4 text-slate-400" />
                                 <span className="text-sm font-bold text-[#1A1A3D] truncate">{user?.name || "loading..."}</span>
                            </div>
                         )}
                     </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</Label>
                 <div className="flex items-center gap-3 bg-slate-50 px-5 h-14 rounded-2xl border border-transparent">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-bold text-[#1A1A3D] truncate">{user?.email || "loading..."}</span>
                 </div>
              </div>
                     <div className="space-y-2">
                         <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone Number</Label>
                         {isEditingProfile ? (
                            <Input value={profilePhoneDraft} onChange={(event) => setProfilePhoneDraft(event.target.value)} placeholder="Add phone number" className="h-14 rounded-2xl" />
                         ) : (
                            <div className="flex items-center gap-3 bg-slate-50 px-5 h-14 rounded-2xl border border-transparent">
                                 <Phone className="w-4 h-4 text-slate-400" />
                                 <span className="text-sm font-bold text-[#1A1A3D] truncate">{user?.phone || "Not set"}</span>
                            </div>
                         )}
                     </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nexus Worker ID</Label>
                 <div className="flex items-center gap-3 bg-slate-50 px-5 h-14 rounded-2xl border border-transparent">
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-bold text-[#1A1A3D]">FW-{user?.id?.slice(-8) || "000000"}</span>
                 </div>
              </div>
           </div>
                {isEditingProfile && (
                   <div className="pt-6">
                      <Button onClick={savePersonalInfo} disabled={isSavingProfile} className="rounded-xl">
                         {isSavingProfile ? "Saving..." : "Save Personal Information"}
                      </Button>
                   </div>
                )}
        </SettingCard>

        {/* Language Preferences */}
        <SettingCard title="Operational Languages" icon={Languages}>
           <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Language</Label>
                    <select
                      value={primaryLanguage}
                      onChange={(e) => setPrimaryLanguage(e.target.value)}
                      className="flex h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#1A1A3D]"
                    >
                      {[
                        "English",
                        "Hindi",
                        "Kannada",
                        "Tamil",
                        "Telugu",
                        "Marathi",
                        "Bengali",
                      ].map((language) => (
                        <option key={language} value={language}>{language}</option>
                      ))}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Add Language</Label>
                    <div className="flex gap-2">
                      <Input value={languageDraft} onChange={(e) => setLanguageDraft(e.target.value)} placeholder="e.g. Marathi" className="rounded-2xl" />
                      <Button type="button" variant="outline" onClick={addLanguage}>Add</Button>
                    </div>
                 </div>
              </div>
              <div className="space-y-3">
                 <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transcribing For {currentZoneLabel}</Label>
                 <div className="flex flex-wrap gap-3">
                    <Badge className="bg-indigo-100 text-[#5A57FF] border-none px-4 py-2 font-bold text-xs rounded-xl">{primaryLanguage}</Badge>
                    {additionalLanguages.length ? additionalLanguages.map((language) => (
                      <button
                        key={language}
                        type="button"
                        onClick={() => removeLanguage(language)}
                        className="bg-white border border-slate-200 text-slate-600 px-4 py-2 font-bold text-xs rounded-xl hover:border-red-200 hover:text-red-500 transition-all"
                        title="Click to remove"
                      >
                        {language} ×
                      </button>
                    )) : (
                      <span className="text-xs text-slate-400 font-medium">No additional languages added.</span>
                    )}
                 </div>
                 <div className="pt-2">
                           <Button type="button" onClick={saveLanguagePreferences} disabled={isSavingLanguages} className="rounded-xl">
                      {isSavingLanguages ? "Saving..." : "Save Language Preferences"}
                   </Button>
                 </div>
              </div>
           </div>
        </SettingCard>

        {/* Notifications */}
        <SettingCard title="Incident Alerts" icon={Bell}>
           <div className="space-y-4">
              {notifications.length ? notifications.map((item) => (
                <button key={item.id} type="button" onClick={() => markSingleNotificationRead(item)} className="w-full text-left flex items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100 group hover:border-indigo-100 transition-all">
                   <div className="flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", item.read ? "bg-slate-100 text-slate-400" : "bg-amber-50 text-amber-600")}>
                         <Bell className="w-5 h-5" />
                      </div>
                      <div className="space-y-0.5">
                         <h4 className="font-bold text-[#1A1A3D] text-sm">{item.title}</h4>
                         <p className="text-[10px] text-slate-400 font-medium">{item.message}</p>
                      </div>
                   </div>
                   <Badge className={cn("border-none font-black text-[9px] tracking-[0.2em] uppercase px-3 py-1.5 h-6", item.read ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700")}>{item.read ? "Read" : "Unread"}</Badge>
                        </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-400 font-medium">
                  No live incident alerts yet.
                </div>
              )}
           </div>
        </SettingCard>

        {/* Offline Cache & Session */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <SettingCard title="Edge Cache" icon={WifiOff}>
              <div className="space-y-6">
                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="space-y-0.5">
                       <p className="text-xs font-bold text-[#1A1A3D]">{navigator.onLine ? "Online" : "Offline"}</p>
                       <p className="text-[10px] text-slate-400 font-medium">Automatic background uploads and local cache sync</p>
                    </div>
                    <Switch checked={navigator.onLine} disabled />
                 </div>
                 <div className="flex flex-col gap-3">
                              <button
                                 type="button"
                                 onClick={() => zoneSettingsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                                 className="w-full h-12 bg-indigo-50 text-[#5A57FF] font-bold text-xs rounded-2xl border border-indigo-100 flex items-center justify-center gap-3 group"
                              >
                       <MapPin className="w-4 h-4 group-hover:scale-110 transition-transform" /> Manage Zone Cache
                    </button>
                    <p className="text-[9px] text-center font-bold text-slate-400 uppercase tracking-widest italic">{selectedOfflineZones.length ? `${selectedOfflineZones.length} offline zone(s) cached` : "No offline zones cached yet"}</p>
                 </div>
              </div>
           </SettingCard>
           
           <SettingCard title="Field Session" icon={Smartphone}>
              <div className="space-y-6">
                 <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                       <p className="text-xs font-bold text-emerald-900">Instance Active</p>
                       <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest">{user?.name?.split(" ")[0]}'s Device</p>
                    </div>
                 </div>
                 <Button variant="outline" className="w-full h-12 border-red-100 text-red-500 hover:bg-red-50 font-black text-[10px] uppercase tracking-widest gap-2 rounded-2xl" onClick={() => {
                   localStorage.removeItem("nexus_access_token");
                   localStorage.removeItem("nexus_user");
                   window.location.href = "/login";
                 }}>
                    <LogOut className="w-4 h-4" /> Terminate Session
                 </Button>
              </div>
           </SettingCard>
        </div>

      </div>

    </div>
  );
};