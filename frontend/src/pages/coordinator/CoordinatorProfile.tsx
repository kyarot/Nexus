import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Mail, MapPin, Phone, Save, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getVolunteerProfile, updateVolunteerProfile } from "@/lib/coordinator-api";

const CoordinatorProfile = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const profileQuery = useQuery({
    queryKey: ["coordinator-profile"],
    queryFn: getVolunteerProfile,
    refetchInterval: 15000,
  });

  const profile = profileQuery.data;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  React.useEffect(() => {
    if (!profile || isDirty) return;
    setName(profile.name || "");
    setPhone(profile.phone || "");
    setProfilePhoto((profile as any).profilePhoto || (profile as any).photoUrl || null);
  }, [profile, isDirty]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateVolunteerProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        profilePhoto,
      }),
    onSuccess: () => {
      setIsDirty(false);
      const cached = localStorage.getItem("nexus_user");
      const parsed = cached ? JSON.parse(cached) : {};
      const updated = {
        ...parsed,
        name: name.trim(),
        phone: phone.trim() || null,
        profilePhoto,
        photoUrl: profilePhoto,
      };
      localStorage.setItem("nexus_user", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("userUpdate"));
      queryClient.invalidateQueries({ queryKey: ["coordinator-profile"] });
      toast({ title: "Profile saved", description: "Coordinator profile updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const roleLabel = useMemo(() => String(profile?.role || "coordinator").toUpperCase(), [profile?.role]);

  const onImageSelected = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Use an image under 2MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProfilePhoto(String(reader.result || ""));
      setIsDirty(true);
    };
    reader.readAsDataURL(file);
  };

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-600">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading profile...
      </div>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700">
          Could not load coordinator profile.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center gap-5">
          <div
            className="relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {profilePhoto ? (
              <img src={profilePhoto} alt={name || "Coordinator"} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-black text-xl">
                {(name || "CO").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 bg-black/25 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#1A1A3D]">My Profile</h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-indigo-600 text-white border-none">{roleLabel}</Badge>
              <span className="text-sm text-slate-500 flex items-center gap-1">
                <MapPin className="w-4 h-4" /> {profile.ngoId || "NGO"}
              </span>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => onImageSelected(event.target.files?.[0])}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Name</label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setIsDirty(true);
              }}
              className="mt-2"
            />
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Phone</label>
            <Input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setIsDirty(true);
              }}
              className="mt-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400" /> {profile.email}
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" /> {profile.primaryLanguage || "English"}
          </div>
        </div>

        <Button
          disabled={!isDirty || saveMutation.isPending || !name.trim()}
          onClick={() => saveMutation.mutate()}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {saveMutation.isPending ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </div>
  );
};

export default CoordinatorProfile;
