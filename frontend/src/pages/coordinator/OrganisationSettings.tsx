import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Building2,
  Upload,
  Plus,
  MapPin,
  Pencil,
  Sparkles,
  Link as LinkIcon,
  Globe,
  X,
  Share2,
  Utensils,
  Stethoscope,
  Book,
  Home,
  Brain,
  ShieldCheck,
  UserRound,
  AlertTriangle,
  Accessibility,
  Baby,
  Briefcase,
  Zap,
  Target,
  Check,
  Save,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  createCollaborationRequest,
  createCoordinatorZone,
  decideCollaborationRequest,
  getCoordinatorZones,
  getNgoProfile,
  listCollaborationPartners,
  listCollaborationRequests,
  listDiscoverableNgos,
  patchNgoProfile,
  updateCoordinatorZone,
  type CollaborationRequestItem,
  type CoordinatorZone,
  type NgoProfile,
} from "@/lib/coordinator-api";

type ZoneDraft = {
  name: string;
  ward: string;
  city: string;
};

const OrganisationSettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const user = useMemo(() => {
    try {
      const raw = localStorage.getItem("nexus_user");
      return raw ? (JSON.parse(raw) as { ngoId?: string }) : {};
    } catch {
      return {};
    }
  }, []);

  const ngoId = String(user.ngoId || "").trim();

  const [hasChanges, setHasChanges] = useState(false);
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [identityForm, setIdentityForm] = useState({
    name: "",
    city: "",
    description: "",
    website: "",
    primaryEmail: "",
    logoUrl: "",
  });
  const [zoneDrafts, setZoneDrafts] = useState<Record<string, ZoneDraft>>({});
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const ngoQuery = useQuery({
    queryKey: ["ngo-profile", ngoId],
    queryFn: () => getNgoProfile(ngoId),
    enabled: Boolean(ngoId),
  });

  const zonesQuery = useQuery({
    queryKey: ["coordinator-zones-for-org-settings"],
    queryFn: () => getCoordinatorZones(),
    enabled: Boolean(ngoId),
  });

  const discoverableNgosQuery = useQuery({
    queryKey: ["discoverable-ngos"],
    queryFn: () => listDiscoverableNgos(),
    enabled: Boolean(ngoId),
  });

  const partnersQuery = useQuery({
    queryKey: ["collaboration-partners"],
    queryFn: () => listCollaborationPartners(),
    enabled: Boolean(ngoId),
  });

  const collaborationRequestsQuery = useQuery({
    queryKey: ["collaboration-requests"],
    queryFn: () => listCollaborationRequests("all", "all"),
    enabled: Boolean(ngoId),
  });

  useEffect(() => {
    const ngo = ngoQuery.data;
    if (!ngo) return;

    setIdentityForm((prev) => ({
      ...prev,
      name: ngo.name || "",
      city: ngo.city || "",
      description: ngo.description || "",
      website: ngo.website || "",
      primaryEmail: ngo.primaryEmail || "",
      logoUrl: ngo.logoUrl || "",
    }));
    setIsDiscoverable(Boolean(ngo.publicDiscoverable));
    setSelectedCategories(Array.isArray(ngo.needCategories) ? ngo.needCategories : []);
    setHasChanges(false);
  }, [ngoQuery.data]);

  useEffect(() => {
    const zones = zonesQuery.data?.zones || [];
    const drafts: Record<string, ZoneDraft> = {};
    for (const zone of zones) {
      drafts[zone.id] = {
        name: zone.name || "",
        ward: zone.ward || "",
        city: zone.city || "",
      };
    }
    setZoneDrafts(drafts);
  }, [zonesQuery.data]);

  const saveNgoMutation = useMutation({
    mutationFn: (payload: Partial<NgoProfile>) => patchNgoProfile(ngoId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ngo-profile", ngoId] });
      toast({ title: "Organisation updated", description: "NGO identity and categories saved." });
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const saveZoneMutation = useMutation({
    mutationFn: ({ zoneId, payload }: { zoneId: string; payload: ZoneDraft }) =>
      updateCoordinatorZone(zoneId, {
        name: payload.name,
        ward: payload.ward,
        city: payload.city,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["coordinator-zones-for-org-settings"] });
      toast({ title: "Zone updated", description: "Service zone details saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Zone save failed", description: error.message, variant: "destructive" });
    },
  });

  const createZoneMutation = useMutation({
    mutationFn: () =>
      createCoordinatorZone({
        name: `New Zone ${((zonesQuery.data?.zones?.length || 0) + 1)}`,
        city: identityForm.city || "",
        ward: "",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["coordinator-zones-for-org-settings"] });
      toast({ title: "Zone created", description: "A new service zone was added." });
    },
    onError: (error: Error) => {
      toast({ title: "Create zone failed", description: error.message, variant: "destructive" });
    },
  });

  const createCollaborationMutation = useMutation({
    mutationFn: ({ targetNgoId, message }: { targetNgoId: string; message?: string }) =>
      createCollaborationRequest({ targetNgoId, message }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["collaboration-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["discoverable-ngos"] }),
      ]);
      toast({ title: "Request sent", description: "Collaboration request sent successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Request failed", description: error.message, variant: "destructive" });
    },
  });

  const decideCollaborationMutation = useMutation({
    mutationFn: ({ requestId, decision }: { requestId: string; decision: "accepted" | "rejected" }) =>
      decideCollaborationRequest(requestId, { decision }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["collaboration-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["collaboration-partners"] }),
        queryClient.invalidateQueries({ queryKey: ["discoverable-ngos"] }),
      ]);
      toast({ title: "Request updated", description: "Collaboration decision saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Decision failed", description: error.message, variant: "destructive" });
    },
  });

  const toggleCategory = (id: string) => {
    setHasChanges(true);
    setSelectedCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const saveAll = () => {
    const zoneNames = (zonesQuery.data?.zones || []).map((zone) => zoneDrafts[zone.id]?.name || zone.name).filter(Boolean);
    saveNgoMutation.mutate({
      name: identityForm.name,
      city: identityForm.city,
      publicDiscoverable: isDiscoverable,
      description: identityForm.description,
      website: identityForm.website,
      primaryEmail: identityForm.primaryEmail,
      logoUrl: identityForm.logoUrl,
      needCategories: selectedCategories,
      zones: zoneNames,
    });
  };

  const onLogoSelected = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload an image under 2MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setIdentityForm((prev) => ({ ...prev, logoUrl: String(reader.result || "") }));
      setHasChanges(true);
    };
    reader.readAsDataURL(file);
  };

  const categories = [
    { id: "food", label: "Food Security", icon: Utensils },
    { id: "health", label: "Healthcare", icon: Stethoscope },
    { id: "education", label: "Education", icon: Book },
    { id: "shelter", label: "Shelter", icon: Home },
    { id: "mental", label: "Mental Health", icon: Brain },
    { id: "women", label: "Women Safety", icon: ShieldCheck },
    { id: "elder", label: "Elder Care", icon: UserRound },
    { id: "substance", label: "Substance Risk", icon: AlertTriangle },
    { id: "disability", label: "Disability", icon: Accessibility },
    { id: "child", label: "Child Protection", icon: Baby },
    { id: "livelihood", label: "Livelihood", icon: Briefcase },
    { id: "disaster", label: "Disaster Relief", icon: Zap },
  ];

  const allRequests = collaborationRequestsQuery.data?.requests || [];
  const pendingIncoming = allRequests.filter((item: CollaborationRequestItem) => item.toNgoId === ngoId && item.status === "pending");
  const pendingOutgoingIds = new Set(
    allRequests
      .filter((item: CollaborationRequestItem) => item.fromNgoId === ngoId && item.status === "pending")
      .map((item: CollaborationRequestItem) => item.toNgoId)
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7FF] font-['Plus_Jakarta_Sans']">
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardTopBar breadcrumb="Settings / Organisation" />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[780px] mx-auto p-8 space-y-10 pb-24">
            <div className="flex items-center justify-between gap-6 pb-2">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-[#4F46E5]">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <h1 className="text-3xl font-bold text-[#1A1A3D]">Organisation Settings</h1>
                </div>
                <p className="text-[#64748B] font-medium text-base">Manage your NGO profile, zones, and platform presence</p>
              </div>
              <Button
                disabled={!hasChanges || saveNgoMutation.isPending}
                onClick={saveAll}
                className={cn(
                  "h-11 px-6 rounded-xl font-bold transition-all shadow-lg",
                  hasChanges
                    ? "bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white shadow-indigo-200"
                    : "bg-slate-200 text-slate-400 border-none cursor-not-allowed"
                )}
              >
                {saveNgoMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>

            <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-8">
              <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[#4F46E5]">
                  <UserRound className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-[#1A1A3D] uppercase tracking-widest">NGO Identity</h3>
              </div>

              <div className="flex flex-col md:flex-row gap-8">
                <div className="space-y-6 flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">NGO NAME</Label>
                      <Input
                        value={identityForm.name}
                        onChange={(e) => {
                          setHasChanges(true);
                          setIdentityForm((prev) => ({ ...prev, name: e.target.value }));
                        }}
                        className="bg-slate-50 border-slate-100 rounded-xl font-bold text-[#1A1A3D] h-11 focus:bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">CITY</Label>
                      <Input
                        value={identityForm.city}
                        onChange={(e) => {
                          setHasChanges(true);
                          setIdentityForm((prev) => ({ ...prev, city: e.target.value }));
                        }}
                        className="bg-slate-50 border-slate-100 rounded-xl font-bold text-[#1A1A3D] h-11 focus:bg-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">DESCRIPTION</Label>
                    <Textarea
                      value={identityForm.description}
                      onChange={(e) => {
                        setHasChanges(true);
                        setIdentityForm((prev) => ({ ...prev, description: e.target.value }));
                      }}
                      className="bg-slate-50 border-slate-100 rounded-2xl font-medium text-[#1A1A3D] min-h-[100px] focus:bg-white resize-none"
                      placeholder="Describe your NGO mission"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">WEBSITE</Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          value={identityForm.website}
                          onChange={(e) => {
                            setHasChanges(true);
                            setIdentityForm((prev) => ({ ...prev, website: e.target.value }));
                          }}
                          className="pl-10 bg-slate-50 border-slate-100 rounded-xl font-bold text-[#1A1A3D] h-11 focus:bg-white"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">PRIMARY EMAIL</Label>
                      <Input
                        value={identityForm.primaryEmail}
                        onChange={(e) => {
                          setHasChanges(true);
                          setIdentityForm((prev) => ({ ...prev, primaryEmail: e.target.value }));
                        }}
                        className="bg-slate-50 border-slate-100 rounded-xl font-bold text-[#1A1A3D] h-11 focus:bg-white"
                        placeholder="contact@ngo.org"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:w-[160px] space-y-4">
                  <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center block">NGO LOGO</Label>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onLogoSelected(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="aspect-square w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 gap-2 hover:border-indigo-300 transition-colors"
                  >
                    {identityForm.logoUrl ? (
                      <img src={identityForm.logoUrl} alt="NGO Logo" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      <>
                        <Upload className="w-6 h-6" />
                        <span className="text-[10px] font-black uppercase text-center px-4">Upload Logo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-8">
              <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[#4F46E5]">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-black text-[#1A1A3D] uppercase tracking-widest">Service Zones</h3>
                </div>
                <Button
                  variant="ghost"
                  className="text-[#4F46E5] font-black uppercase text-[10px] tracking-widest hover:bg-indigo-50 flex gap-2"
                  disabled={createZoneMutation.isPending}
                  onClick={() => createZoneMutation.mutate()}
                >
                  <Plus className="w-4 h-4" /> {createZoneMutation.isPending ? "Adding..." : "Add Zone"}
                </Button>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-none">
                {(zonesQuery.data?.zones || []).map((zone: CoordinatorZone) => {
                  const draft = zoneDrafts[zone.id] || { name: zone.name, ward: zone.ward || "", city: zone.city || "" };
                  return (
                    <div key={zone.id} className="min-w-[300px] bg-white rounded-2xl border border-slate-100 p-6 space-y-4 hover:border-indigo-200 hover:shadow-sm transition-all">
                      <div className="flex justify-between items-start">
                        <Badge className="bg-[#DCFCE7] text-[#166534] border-none font-black text-[9px] uppercase px-2 py-0.5 tracking-widest">Active</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[#4F46E5]"
                          disabled={saveZoneMutation.isPending}
                          onClick={() => saveZoneMutation.mutate({ zoneId: zone.id, payload: draft })}
                        >
                          <Save className="w-3.5 h-3.5 mr-1" /> Save
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Input
                          value={draft.name}
                          onChange={(e) =>
                            setZoneDrafts((prev) => ({ ...prev, [zone.id]: { ...draft, name: e.target.value } }))
                          }
                          className="bg-slate-50 border-slate-100 rounded-xl font-bold text-[#1A1A3D] h-10"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={draft.ward}
                            onChange={(e) =>
                              setZoneDrafts((prev) => ({ ...prev, [zone.id]: { ...draft, ward: e.target.value } }))
                            }
                            placeholder="Ward"
                            className="bg-slate-50 border-slate-100 rounded-xl h-10"
                          />
                          <Input
                            value={draft.city}
                            onChange={(e) =>
                              setZoneDrafts((prev) => ({ ...prev, [zone.id]: { ...draft, city: e.target.value } }))
                            }
                            placeholder="City"
                            className="bg-slate-50 border-slate-100 rounded-xl h-10"
                          />
                        </div>
                      </div>

                      <div className="flex gap-6 border-t border-slate-50 pt-4">
                        <div className="space-y-0.5">
                          <p className="text-[15px] font-black text-[#1A1A3D]">{zone.topNeeds?.length || 0}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Needs</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[15px] font-black text-[#1A1A3D]">{zone.activeMissions || 0}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Missions</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-8">
              <div className="space-y-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[#4F46E5]">
                    <Target className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-black text-[#1A1A3D] uppercase tracking-widest">Need Categories</h3>
                </div>
                <p className="text-xs font-medium text-slate-400">What types of needs does your NGO serve?</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all active:scale-[0.98]",
                      selectedCategories.includes(cat.id)
                        ? "bg-[#4F46E5] border-[#4F46E5] text-white shadow-lg shadow-indigo-100"
                        : "bg-slate-50/50 border-transparent text-slate-500 hover:bg-slate-50 hover:border-slate-100"
                    )}
                  >
                    <cat.icon className={cn("w-4 h-4", selectedCategories.includes(cat.id) ? "text-white" : "text-[#4F46E5]")} />
                    <span className="text-[11px] font-bold uppercase tracking-widest leading-none">{cat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-8">
              <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[#4F46E5]">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-black text-[#1A1A3D] uppercase tracking-widest">Connected NGOs</h3>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {partnersQuery.data?.total || 0} Active Partners
                </span>
              </div>

              <div className="space-y-4">
                {(partnersQuery.data?.partners || []).length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-500 font-medium">
                    No active collaborations yet.
                  </div>
                ) : (
                  (partnersQuery.data?.partners || []).map((partner) => (
                    <div key={partner.id} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-4">
                        {partner.logoUrl ? (
                          <img src={partner.logoUrl} alt={partner.name} className="w-10 h-10 rounded-xl object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-[#4F46E5] flex items-center justify-center text-white font-black text-xs">
                            {partner.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-[#1A1A3D]">{partner.name}</p>
                          <p className="text-[10px] font-medium text-slate-400">{partner.city || "Regional partner"}</p>
                        </div>
                      </div>
                      <Badge className="bg-[#DCFCE7] text-[#166534] border-none font-bold text-[9px] uppercase px-3 py-1 tracking-widest">Collaboration Active</Badge>
                    </div>
                  ))
                )}

                {pendingIncoming.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Incoming Requests</p>
                    {pendingIncoming.map((request) => (
                      <div key={request.id} className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-[#1A1A3D]">{request.fromNgoName}</p>
                            <p className="text-xs text-slate-500">{request.message || "Requested to collaborate"}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-8 px-3 text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700"
                              disabled={decideCollaborationMutation.isPending}
                              onClick={() => decideCollaborationMutation.mutate({ requestId: request.id, decision: "accepted" })}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-[10px] font-black uppercase tracking-widest"
                              disabled={decideCollaborationMutation.isPending}
                              onClick={() => decideCollaborationMutation.mutate({ requestId: request.id, decision: "rejected" })}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" />
                    <span className="text-[10px] font-black text-[#4F46E5] uppercase tracking-widest">Discoverable NGOs</span>
                  </div>
                  {(discoverableNgosQuery.data?.ngos || []).slice(0, 5).map((ngo) => {
                    const isPending = pendingOutgoingIds.has(ngo.id);
                    return (
                      <div key={ngo.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                          <p className="text-sm font-bold text-[#1A1A3D]">{ngo.name}</p>
                          <p className="text-[10px] text-slate-500">{ngo.city || "City unavailable"}</p>
                        </div>
                        {ngo.isPartner ? (
                          <Badge className="bg-[#DCFCE7] text-[#166534] border-none font-bold text-[9px] uppercase px-3 py-1 tracking-widest">Connected</Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="h-8 px-3 text-[10px] font-black uppercase tracking-widest bg-[#4F46E5] hover:bg-[#4338CA]"
                            disabled={isPending || createCollaborationMutation.isPending}
                            onClick={() => createCollaborationMutation.mutate({ targetNgoId: ngo.id })}
                          >
                            {isPending ? "Requested" : "Request"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-8">
              <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[#4F46E5]">
                    <Globe className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-black text-[#1A1A3D] uppercase tracking-widest">Public Profile</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Discoverable</span>
                  <Switch
                    checked={isDiscoverable}
                    onCheckedChange={(checked) => {
                      setIsDiscoverable(checked);
                      setHasChanges(true);
                    }}
                    className="data-[state=checked]:bg-[#4F46E5]"
                  />
                </div>
              </div>

              <div className="space-y-8">
                <div className="p-10 bg-[#F8F7FF] rounded-[2.5rem] border border-slate-100 space-y-8 text-center max-w-lg mx-auto overflow-hidden relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-indigo-400/5 rounded-full blur-3xl -mt-40" />
                  <div className="relative z-10 flex flex-col items-center gap-4">
                    {identityForm.logoUrl ? (
                      <img src={identityForm.logoUrl} alt="NGO Logo" className="w-20 h-20 rounded-[2rem] object-cover shadow-lg shadow-[#8BBD70]/20" />
                    ) : (
                      <div className="w-20 h-20 rounded-[2rem] bg-[#8BBD70] flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-[#8BBD70]/20">GRI</div>
                    )}
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-[#1A1A3D]">{identityForm.name || "Organisation"}</h3>
                      <p className="text-sm font-bold text-[#4F46E5] tracking-wide">Bridging gaps, Building futures.</p>
                    </div>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-sm italic">
                      "{identityForm.description || "Our mission is to create resilient data networks that empower local leaders to act with precision and empathy in times of crisis."}"
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md pt-4">
                      <div className="flex-1 bg-white p-3.5 rounded-2xl shadow-sm border border-slate-50 flex items-center justify-center gap-2">
                        <Share2 className="w-4 h-4 text-indigo-400" />
                        <span className="text-[11px] font-black text-slate-600">{identityForm.website || "Website not set"}</span>
                      </div>
                      <div className="flex-1 bg-white p-3.5 rounded-2xl shadow-sm border border-slate-50 flex items-center justify-center gap-2">
                        <Zap className="w-4 h-4 text-[#D97706]" />
                        <span className="text-[11px] font-black text-slate-600">{identityForm.primaryEmail || "Email not set"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganisationSettings;
