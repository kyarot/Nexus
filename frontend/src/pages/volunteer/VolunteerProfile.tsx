import React, { useEffect, useMemo, useState } from "react";
import {
  Edit2,
  Globe,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Minus,
  Monitor,
  Navigation,
  Plus,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  getVolunteerProfile,
  updateVolunteerProfile,
  type VolunteerSkillDetail,
} from "@/lib/coordinator-api";

type AvailabilityState = {
  monFri: { morning: boolean; afternoon: boolean; evening: boolean };
  satSun: { morning: boolean; afternoon: boolean; evening: boolean };
};

const DEFAULT_AVAILABILITY: AvailabilityState = {
  monFri: { morning: false, afternoon: false, evening: true },
  satSun: { morning: true, afternoon: true, evening: true },
};

const AVOID_OPTIONS = [
  "Terminal Illness cases",
  "Animal rescues",
  "High-noise environments",
  "Night-shift patrolling",
];

const intensityOptions = [
  {
    label: "light",
    title: "Light",
    desc: "Socializing, distribution, logistics",
    color: "border-emerald-500 bg-emerald-50/30",
    iconColor: "bg-emerald-500",
  },
  {
    label: "moderate",
    title: "Moderate",
    desc: "Teaching, basic advocacy, first-aid",
    color: "border-amber-500 bg-amber-50/30",
    iconColor: "bg-amber-500",
  },
  {
    label: "intensive",
    title: "Intensive",
    desc: "Crisis management, trauma support",
    color: "border-red-500 bg-red-50/30",
    iconColor: "bg-red-500",
  },
] as const;

const transportOptions = [
  { icon: Zap, label: "Two Wheeler" },
  { icon: Monitor, label: "Public Transit" },
  { icon: Navigation, label: "Walking" },
] as const;

const skillCardColor = (index: number) => {
  const colors = [
    "bg-[#FDF2E9] text-[#93522E]",
    "bg-[#F5F3FF] text-[#4F46E5]",
    "bg-[#EFF6FF] text-[#1E40AF]",
    "bg-[#F0FDF4] text-[#166534]",
  ];
  return colors[index % colors.length];
};

const formatMemberSince = (value?: string | null) => {
  if (!value) {
    return "Member since recently";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Member since recently";
  }
  return `Member since ${new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(parsed)}`;
};

const sanitizeSkills = (skills: VolunteerSkillDetail[], fallbackSkills: string[]) => {
  if (skills.length) {
    return skills.map((skill) => ({
      name: skill.name,
      level: Math.min(3, Math.max(1, skill.level || 2)) as 1 | 2 | 3,
    }));
  }
  return fallbackSkills.map((name) => ({ name, level: 2 as 1 | 2 | 3 }));
};

const VolunteerProfilePage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDirty, setIsDirty] = useState(false);
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [zoneLabel, setZoneLabel] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [radius, setRadius] = useState([12]);
  const [maxMissions, setMaxMissions] = useState(5);
  const [skills, setSkills] = useState<Array<{ name: string; level: 1 | 2 | 3 }>>([]);
  const [availability, setAvailability] = useState<AvailabilityState>(DEFAULT_AVAILABILITY);
  const [transportModes, setTransportModes] = useState<string[]>(["Two Wheeler"]);
  const [preferredIntensity, setPreferredIntensity] = useState<"light" | "moderate" | "intensive">("moderate");
  const [avoidCategories, setAvoidCategories] = useState<string[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState({
    pushNotifications: true,
    emailDigest: true,
    smsAlerts: false,
  });

  const profileQuery = useQuery({
    queryKey: ["volunteer-profile"],
    queryFn: getVolunteerProfile,
    refetchInterval: 15000,
  });

  const profile = profileQuery.data;

  useEffect(() => {
    if (!profile || isDirty) {
      return;
    }

    const settings = profile.volunteerProfileSettings;
    setName(profile.name || "");
    setPhone(profile.phone || "");
    setCity(settings?.profileMeta?.city || "");
    setZoneLabel(settings?.profileMeta?.zoneLabel || profile.zones?.[0] || "");
    setProfilePhoto(profile.profilePhoto || null);
    setIsAvailable((profile.availability || "available").toLowerCase() === "available");
    setRadius([Math.max(1, Math.min(25, profile.travelRadius || 12))]);
    setMaxMissions(settings?.maxMissionsPerWeek ?? 5);
    setSkills(sanitizeSkills(settings?.skillDetails || [], profile.skills || []));
    setAvailability({
      monFri: settings?.availabilityWindows?.monFri || DEFAULT_AVAILABILITY.monFri,
      satSun: settings?.availabilityWindows?.satSun || DEFAULT_AVAILABILITY.satSun,
    });
    setTransportModes(settings?.travelPreferences?.transportModes?.length ? settings.travelPreferences.transportModes : ["Two Wheeler"]);
    setPreferredIntensity(settings?.emotionalPreferences?.preferredMissionIntensity || "moderate");
    setAvoidCategories(profile.avoidCategories || []);
    setNotificationPreferences({
      pushNotifications: settings?.notificationPreferences?.pushNotifications ?? true,
      emailDigest: settings?.notificationPreferences?.emailDigest ?? true,
      smsAlerts: settings?.notificationPreferences?.smsAlerts ?? false,
    });
  }, [profile, isDirty]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateVolunteerProfile({
        name,
        phone,
        profilePhoto,
        availability: isAvailable ? "available" : "unavailable",
        travelRadius: radius[0],
        skills: skills.map((skill) => skill.name),
        avoidCategories,
        emotionalCapacity: preferredIntensity === "light" ? 40 : preferredIntensity === "intensive" ? 85 : 65,
        volunteerProfileSettings: {
          skillDetails: skills,
          availabilityWindows: availability,
          maxMissionsPerWeek: maxMissions,
          travelPreferences: {
            transportModes,
          },
          emotionalPreferences: {
            preferredMissionIntensity: preferredIntensity,
          },
          notificationPreferences,
          profileMeta: {
            city,
            zoneLabel,
          },
        },
      }),
    onSuccess: () => {
      setIsDirty(false);
      setIsEditingPersonal(false);
      queryClient.invalidateQueries({ queryKey: ["volunteer-profile"] });
      toast({ title: "Profile updated", description: "Volunteer profile synced with Firestore." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const stats = useMemo(() => {
    const missionsCompleted = profile?.missionsCompleted || 0;
    const successRate = Math.round(profile?.successRate || 0);
    const impactPoints = profile?.impactPoints || 0;
    return [
      { label: "Missions Completed", value: String(missionsCompleted) },
      { label: "Success Rate", value: `${successRate}%` },
      { label: "Impact Points", value: String(impactPoints) },
    ];
  }, [profile]);

  const languages = useMemo(() => {
    const list = [profile?.primaryLanguage, ...(profile?.additionalLanguages || [])].filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [profile]);

  const connectedProvider = profile?.volunteerProfileSettings?.accountMeta?.connectedProvider;
  const connectedEmail = profile?.volunteerProfileSettings?.accountMeta?.connectedEmail;
  const passwordChangedAt = profile?.volunteerProfileSettings?.accountMeta?.passwordLastChangedAt;

  const toggleAvailabilitySlot = (period: "monFri" | "satSun", slot: "morning" | "afternoon" | "evening", checked: boolean) => {
    setIsDirty(true);
    setAvailability((prev) => ({
      ...prev,
      [period]: {
        ...prev[period],
        [slot]: checked,
      },
    }));
  };

  const toggleTransport = (label: string) => {
    setIsDirty(true);
    setTransportModes((prev) => (prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]));
  };

  const toggleAvoidCategory = (label: string, checked: boolean) => {
    setIsDirty(true);
    setAvoidCategories((prev) => (checked ? Array.from(new Set([...prev, label])) : prev.filter((item) => item !== label)));
  };

  const updateSkillLevel = (index: number, level: 1 | 2 | 3) => {
    setIsDirty(true);
    setSkills((prev) => prev.map((skill, skillIndex) => (skillIndex === index ? { ...skill, level } : skill)));
  };

  const removeSkill = (index: number) => {
    setIsDirty(true);
    setSkills((prev) => prev.filter((_, skillIndex) => skillIndex !== index));
  };

  const addSkill = () => {
    setIsDirty(true);
    setSkills((prev) => [...prev, { name: `Skill ${prev.length + 1}`, level: 2 }]);
  };

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7FF]">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading volunteer profile...
        </div>
      </div>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7FF] p-8">
        <div className="bg-white rounded-3xl border border-red-100 p-8 text-center max-w-xl w-full">
          <p className="text-red-600 font-bold mb-2">Could not load volunteer profile</p>
          <p className="text-slate-500 text-sm mb-6">{(profileQuery.error as Error)?.message || "Please retry."}</p>
          <Button onClick={() => profileQuery.refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 p-8 bg-[#F8F7FF] min-h-screen font-['Plus_Jakarta_Sans']">
      <div className="w-full lg:w-[380px] flex-shrink-0">
        <div className="bg-white rounded-[2rem] shadow-[0_4px_24px_rgba(79,70,229,0.08)] overflow-hidden border border-slate-100 flex flex-col min-h-[800px]">
          <div className="h-[120px] bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] w-full" />

          <div className="px-8 -mt-10 relative flex flex-col items-center">
            <div className="w-[80px] h-[80px] rounded-full border-[3px] border-white shadow-lg overflow-hidden bg-white mb-4">
              <img
                src={profilePhoto || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150"}
                alt={name || "Volunteer"}
                className="w-full h-full object-cover"
              />
            </div>
            <h2 className="text-[20px] font-bold text-[#1A1A3D]">{name || "Volunteer"}</h2>
            <Badge className="mt-2 bg-[#4F46E5] text-white border-none py-1 px-4 rounded-full text-[10px] font-black uppercase tracking-widest ring-0">
              {profile.role}
            </Badge>
            <div className="flex items-center gap-1.5 mt-3 text-slate-400">
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-[13px] font-medium">{(city || "Bengaluru") + " · " + (zoneLabel || "Zone")}</span>
            </div>

            <div
              className="mt-8 w-full p-1 bg-slate-100 rounded-2xl flex relative cursor-pointer group"
              onClick={() => {
                setIsDirty(true);
                setIsAvailable((prev) => !prev);
              }}
            >
              <div
                className={cn(
                  "flex-1 py-3 text-center rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 z-10",
                  isAvailable ? "bg-[#9AF7C9] text-[#1B4D3E] shadow-sm" : "text-slate-400 group-hover:text-slate-600",
                )}
              >
                Available for Missions
              </div>
              <div
                className={cn(
                  "flex-1 py-3 text-center rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 z-10",
                  !isAvailable ? "bg-white text-slate-600 shadow-sm" : "text-slate-400 group-hover:text-slate-600",
                )}
              >
                Unavailable
              </div>
            </div>

            <div className="w-full mt-10 space-y-6">
              <div className="h-[1px] bg-slate-100 w-full" />
              <div className="flex justify-around text-center">
                {stats.map((s, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="text-[24px] font-black text-[#4F46E5] leading-none mb-1">{s.value}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.label.split(" ")[0]}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.label.split(" ")[1]}</span>
                  </div>
                ))}
              </div>
              <div className="h-[1px] bg-slate-100 w-full" />
            </div>

            <div className="w-full mt-8">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">LANGUAGES</p>
              <div className="flex flex-wrap gap-2">
                {languages.length ? (
                  languages.map((language, index) => (
                    <Badge
                      key={`${language}-${index}`}
                      variant={index === 0 ? "default" : "outline"}
                      className={cn(
                        "px-3 py-1 rounded-full text-[11px] font-bold",
                        index === 0
                          ? "bg-[#9AF7C9] text-[#1B4D3E] border-none"
                          : "border-slate-200 text-slate-500 bg-transparent",
                      )}
                    >
                      {language}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="border-slate-200 text-slate-500 bg-transparent px-3 py-1 rounded-full text-[11px] font-bold">
                    Not set
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-auto pt-10 pb-8 flex flex-col items-center w-full">
              <p className="text-[12px] text-slate-400 mb-6 italic">{formatMemberSince(profile.createdAt)}</p>
              <Button
                variant="ghost"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !isDirty}
                className="w-full border border-slate-200 rounded-xl text-[13px] font-bold text-[#1A1A3D] py-6 hover:bg-slate-50"
              >
                {saveMutation.isPending ? "Saving..." : isDirty ? "Save Profile Changes" : "Profile Synced"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 pb-20">
        <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-slate-100">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-[1.5rem] font-bold text-[#1A1A3D]">Personal Information</h3>
            <button
              className="flex items-center gap-2 text-[#4F46E5] font-bold text-sm hover:opacity-80 transition-opacity"
              onClick={() => setIsEditingPersonal((prev) => !prev)}
            >
              {isEditingPersonal ? "Done" : "Edit"} <Edit2 className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-10 gap-x-12">
            {[
              { label: "FULL NAME", value: name, setValue: setName },
              { label: "EMAIL ADDRESS", value: profile.email, setValue: undefined },
              { label: "PHONE NUMBER", value: phone, setValue: setPhone },
              { label: "CITY", value: city, setValue: setCity },
              { label: "WARD / ZONE", value: zoneLabel, setValue: setZoneLabel },
            ].map((f, i) => (
              <div key={i} className="flex flex-col gap-2">
                <span className="text-[11px] font-black text-slate-400 tracking-widest uppercase">{f.label}</span>
                {isEditingPersonal && f.setValue ? (
                  <input
                    value={f.value || ""}
                    onChange={(event) => {
                      setIsDirty(true);
                      f.setValue?.(event.target.value);
                    }}
                    className="text-[15px] font-bold text-[#1A1A3D] border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#4F46E5]/30"
                  />
                ) : (
                  <span className="text-[15px] font-bold text-[#1A1A3D]">{f.value || "Not set"}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-slate-100">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-[1.5rem] font-bold text-[#1A1A3D]">Volunteer Skills</h3>
            <button className="text-[#4F46E5] font-bold text-sm" onClick={addSkill}>Add</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {skills.map((skill, i) => (
              <div key={`${skill.name}-${i}`} className={cn("p-6 rounded-[1.5rem] flex items-center justify-between", skillCardColor(i))}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", skill.level === 3 ? "bg-current" : "bg-current/40")} />
                    <span className="text-[15px] font-black tracking-tight">{skill.name}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map((dot) => (
                      <button
                        key={dot}
                        onClick={() => updateSkillLevel(i, dot as 1 | 2 | 3)}
                        className={cn("w-2.5 h-2.5 rounded-full transition-all", dot <= skill.level ? "bg-black/80" : "bg-black/10")}
                      />
                    ))}
                  </div>
                </div>
                <button onClick={() => removeSkill(i)}>
                  <X className="w-4 h-4 opacity-40 cursor-pointer hover:opacity-100" />
                </button>
              </div>
            ))}
            <button
              onClick={addSkill}
              className="border-2 border-dashed border-slate-200 p-6 rounded-[1.5rem] flex items-center justify-center gap-2 text-slate-400 font-bold text-sm cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <Plus className="w-5 h-5" /> Add new skill
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-slate-100">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-[1.5rem] font-bold text-[#1A1A3D]">Availability Windows</h3>
            <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Max Missions/Week</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setIsDirty(true);
                    setMaxMissions((prev) => Math.max(0, prev - 1));
                  }}
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-[#4F46E5]"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-sm font-black text-[#4F46E5] w-8 text-center">{String(maxMissions).padStart(2, "0")}</span>
                <button
                  onClick={() => {
                    setIsDirty(true);
                    setMaxMissions((prev) => Math.min(14, prev + 1));
                  }}
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-[#4F46E5]"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="pb-6 text-left font-black">DAY</th>
                  <th className="pb-6 text-center font-black">MORNING</th>
                  <th className="pb-6 text-center font-black">AFTERNOON</th>
                  <th className="pb-6 text-center font-black">EVENING</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { day: "Mon - Fri", key: "monFri" as const },
                  { day: "Sat - Sun", key: "satSun" as const },
                ].map((row) => (
                  <tr key={row.key}>
                    <td className="py-4 text-[15px] font-bold text-[#1A1A3D]">{row.day}</td>
                    {(["morning", "afternoon", "evening"] as const).map((slot) => (
                      <td key={slot} className="py-4">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={availability[row.key][slot]}
                            onCheckedChange={(checked) => toggleAvailabilitySlot(row.key, slot, checked === true)}
                            className="w-6 h-6 rounded-lg border-slate-200 data-[state=checked]:bg-[#4F46E5] data-[state=checked]:border-[#4F46E5]"
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-slate-100 flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <h3 className="text-[1.5rem] font-bold text-[#1A1A3D] mb-10">Travel Preferences</h3>

            <div className="space-y-8">
              <div>
                <div className="flex justify-between items-end mb-4">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">TRAVEL RADIUS</span>
                  <span className="text-[1.5rem] font-black text-[#4640DE]">
                    {radius[0]} <span className="text-sm font-bold opacity-60">km</span>
                  </span>
                </div>
                <Slider
                  value={radius}
                  onValueChange={(values) => {
                    setIsDirty(true);
                    setRadius(values);
                  }}
                  max={25}
                  min={1}
                  step={1}
                  className="[&_[role=slider]]:bg-[#4F46E5] [&_[role=slider]]:border-[#4F46E5]"
                />
                <div className="flex justify-between mt-2 text-[10px] font-black text-slate-300 tracking-widest">
                  <span>1KM</span>
                  <span>25KM</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-4">TRANSPORT MODES</span>
                <div className="flex flex-wrap gap-3">
                  {transportOptions.map((m, i) => (
                    <Badge
                      key={i}
                      onClick={() => toggleTransport(m.label)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-3 rounded-xl border transition-all cursor-pointer ring-0",
                        transportModes.includes(m.label)
                          ? "bg-[#4F46E5] text-white border-[#4F46E5]"
                          : "bg-transparent text-slate-500 border-slate-200 hover:border-slate-300",
                      )}
                    >
                      <m.icon className="w-4 h-4" />
                      <span className="text-xs font-black uppercase tracking-widest">{m.label}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="w-full md:w-[260px] h-[300px] bg-[#E0E7FF] rounded-[1.5rem] overflow-hidden relative shadow-inner">
            <div className="absolute inset-0 opacity-40 bg-[url('https://www.google.com/maps/vt/pb=!1m5!1m4!1i12!2i2365!2i1575!4i256!2m3!1e0!2sm!3i625206676!3m17!2sen!3sUS!5e18!12m4!1e68!2m2!1sset!2sRoadmap!12m3!1e37!2m1!1ssmartmaps!12m4!1e26!2m2!1s1i1!2s1!4e0!5m4!1e0!8m2!1i1100!2i1100!6m6!1e12!2i2!26b1!39b1!44e1!50e0!23i1301813')] bg-cover" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-[#4F46E5]/10 border-2 border-[#4F46E5]/40 rounded-full animate-pulse flex items-center justify-center">
                <div className="w-2 h-2 bg-[#4F46E5] rounded-full shadow-[0_0_10px_#4F46E5]" />
              </div>
            </div>
            <div className="absolute bottom-4 left-4 right-4 bg-white/80 backdrop-blur-sm p-3 rounded-xl border border-white/40">
              <p className="text-[10px] font-black text-[#1A1A3D] uppercase tracking-widest">Active Coverage</p>
              <p className="text-xs font-bold text-slate-500">{radius[0]}km around {zoneLabel || "assigned zone"}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-slate-100">
          <h3 className="text-[1.5rem] font-bold text-[#1A1A3D] mb-2">Emotional Capacity Settings</h3>
          <p className="text-sm text-slate-400 mb-10">Help us match you to missions that suit your wellbeing</p>

          <div className="space-y-10">
            <div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-6">PREFERRED MISSION INTENSITY</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {intensityOptions.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setIsDirty(true);
                      setPreferredIntensity(opt.label);
                    }}
                    className={cn(
                      "p-6 rounded-[1.5rem] border-2 transition-all cursor-pointer hover:shadow-md h-full flex flex-col text-left",
                      opt.color,
                      preferredIntensity === opt.label ? "ring-2 ring-offset-2 ring-[#4F46E5]/40" : "",
                    )}
                  >
                    <div className={cn("w-10 h-1 rounded-full mb-6", opt.iconColor)} />
                    <h4 className="text-[18px] font-black text-[#1A1A3D] mb-2 tracking-tight">{opt.title}</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-bold uppercase tracking-tight">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-6">I PREFER NOT TO WORK WITH</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                {AVOID_OPTIONS.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 group cursor-pointer">
                    <Checkbox
                      id={`check-${i}`}
                      checked={avoidCategories.includes(item)}
                      onCheckedChange={(checked) => toggleAvoidCategory(item, checked === true)}
                      className="w-6 h-6 rounded-lg border-slate-200 data-[state=checked]:bg-[#4F46E5] data-[state=checked]:border-[#4F46E5]"
                    />
                    <label htmlFor={`check-${i}`} className="text-[14px] font-bold text-slate-600 group-hover:text-[#1A1A3D] transition-colors cursor-pointer">
                      {item}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-slate-100">
          <h3 className="text-[1.5rem] font-bold text-[#1A1A3D] mb-10">Notification Preferences</h3>

          <div className="space-y-8">
            {[
              {
                title: "Push Notifications",
                desc: "Real-time alerts for urgent local missions",
                key: "pushNotifications" as const,
              },
              {
                title: "Email Digest",
                desc: "Weekly impact summary and scheduled events",
                key: "emailDigest" as const,
              },
              {
                title: "SMS Alerts",
                desc: "Critical disaster-response coordination",
                key: "smsAlerts" as const,
              },
            ].map((notif, i) => (
              <div key={i} className="flex items-center justify-between pb-8 border-b border-slate-50 last:border-0 last:pb-0">
                <div>
                  <h4 className="text-[15px] font-black text-[#1A1A3D] mb-1">{notif.title}</h4>
                  <p className="text-[13px] text-slate-400 font-medium">{notif.desc}</p>
                </div>
                <Switch
                  checked={notificationPreferences[notif.key]}
                  onCheckedChange={(checked) => {
                    setIsDirty(true);
                    setNotificationPreferences((prev) => ({ ...prev, [notif.key]: checked }));
                  }}
                  className="data-[state=checked]:bg-[#4F46E5]"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.08)] border border-slate-100">
          <h3 className="text-[1.5rem] font-bold text-[#1A1A3D] mb-10">Account & Security</h3>

          <div className="space-y-10">
            <div className="flex items-center justify-between group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-[1rem] bg-[#F5F3FF] flex items-center justify-center text-[#4F46E5] group-hover:bg-[#4F46E5] group-hover:text-white transition-all">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[15px] font-black text-[#1A1A3D]">Password</h4>
                  <p className="text-[12px] text-slate-400 font-medium tracking-tight">
                    {passwordChangedAt ? `Last changed ${new Date(passwordChangedAt).toLocaleDateString()}` : "Last changed unavailable"}
                  </p>
                </div>
              </div>
              <button className="text-[13px] font-black text-[#4F46E5] uppercase tracking-widest">Update</button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-[1rem] bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-100">
                  {connectedProvider?.toLowerCase() === "google" ? (
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                  ) : (
                    <Globe className="w-5 h-5 text-slate-500" />
                  )}
                </div>
                <div>
                  <h4 className="text-[15px] font-black text-[#1A1A3D]">
                    {connectedProvider ? `Connected ${connectedProvider} Account` : "Connected Account"}
                  </h4>
                  <p className="text-[12px] text-slate-400 font-medium tracking-tight">{connectedEmail || profile.email}</p>
                </div>
              </div>
              <button className="text-[13px] font-black text-slate-400 uppercase tracking-widest hover:text-[#4F46E5]">Disconnect</button>
            </div>

            <div className="pt-8 border-t border-slate-50 flex items-center justify-between">
              <Button variant="ghost" className="text-slate-400 hover:text-slate-600 font-bold p-0 bg-transparent flex gap-2">
                <LogOut className="w-4 h-4" /> Sign out of all devices
              </Button>
              <button className="text-[13px] font-black text-red-400 uppercase tracking-widest hover:text-red-600 transition-colors">
                <Trash2 className="w-4 h-4 inline mr-1" /> Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {saveMutation.isPending && (
        <div className="fixed bottom-6 right-6 bg-[#1A1A3D] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Saving profile updates...
        </div>
      )}
    </div>
  );
};

export default VolunteerProfilePage;