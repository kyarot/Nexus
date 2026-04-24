import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, ClipboardList, Heart, Eye, EyeOff, Hexagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const roles = [
  { id: "coordinator", label: "NGO Coordinator", icon: Building2, desc: "Manage teams and operations" },
  { id: "fieldworker", label: "Field Worker", icon: ClipboardList, desc: "Collect field data" },
  { id: "volunteer", label: "Volunteer", icon: Heart, desc: "Execute missions" },
] as const;

const cities = ["Bengaluru", "Mumbai", "Delhi", "Chennai", "Hyderabad", "Kolkata", "Pune", "Ahmedabad"];
const needCategories = ["food", "health", "education", "shelter", "mental_health", "women_safety"];
const dataChannels = ["paper", "voice", "sms", "digital"];

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState("coordinator");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [primaryLanguage, setPrimaryLanguage] = useState("English");

  const [joinMode, setJoinMode] = useState<"create" | "join">("create");
  const [ngoId, setNgoId] = useState("");
  const [ngoName, setNgoName] = useState("");
  const [city, setCity] = useState("");
  const [zoneInput, setZoneInput] = useState("");
  const [phone, setPhone] = useState("");

  const [selectedNeedCategories, setSelectedNeedCategories] = useState<string[]>([]);
  const [selectedDataChannels, setSelectedDataChannels] = useState<string[]>([]);

  const [additionalLanguagesInput, setAdditionalLanguagesInput] = useState("");

  const [volunteerSkillsInput, setVolunteerSkillsInput] = useState("");
  const [travelRadius, setTravelRadius] = useState(5);
  const [emotionalCapacity, setEmotionalCapacity] = useState<"light" | "moderate" | "intensive">("moderate");
  const [avoidCategoriesInput, setAvoidCategoriesInput] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [ngoOptions, setNgoOptions] = useState<Array<{ id: string; name: string; city?: string | null }>>([]);
  const [loadingNgos, setLoadingNgos] = useState(false);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  const zones = zoneInput.split(",").map((v) => v.trim()).filter(Boolean);
  const additionalLanguages = additionalLanguagesInput.split(",").map((v) => v.trim()).filter(Boolean);
  const volunteerSkills = volunteerSkillsInput.split(",").map((v) => v.trim()).filter(Boolean);
  const avoidCategories = avoidCategoriesInput.split(",").map((v) => v.trim()).filter(Boolean);

  const toggleChip = (
    value: string,
    selected: string[],
    setter: (next: string[]) => void,
  ) => {
    setter(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  useEffect(() => {
    const loadNgos = async () => {
      setLoadingNgos(true);
      try {
        const response = await fetch(`${apiBaseUrl}/auth/signup/ngos`);
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        const options = Array.isArray(data) ? data : [];
        setNgoOptions(options);
      } catch {
        // Keep signup usable even if NGO lookup fails.
      } finally {
        setLoadingNgos(false);
      }
    };

    void loadNgos();
  }, [apiBaseUrl]);

  const handleSignup = async () => {
    setErrorMessage("");
    setIsSubmitting(true);

    const basePayload = {
      name,
      email,
      password,
      role: selectedRole,
      primary_language: primaryLanguage,
      zones,
    };

    const payload = selectedRole === "coordinator"
      ? {
          ...basePayload,
          ngo_id: joinMode === "join" ? ngoId : null,
          create_new_ngo: joinMode === "create",
          ngo_name: joinMode === "create" ? ngoName : null,
          city: joinMode === "create" ? city : null,
          need_categories: selectedNeedCategories,
          data_channels: selectedDataChannels,
          phone: phone || null,
        }
      : selectedRole === "fieldworker"
        ? {
            ...basePayload,
            zones: [],
            ngo_id: ngoId,
            additional_languages: additionalLanguages,
            offline_zones: [],
            phone,
          }
        : {
            ...basePayload,
            ngo_id: ngoId,
            skills: volunteerSkills,
            travel_radius: travelRadius,
            emotional_capacity: emotionalCapacity,
            avoid_categories: avoidCategories,
            additional_languages: additionalLanguages,
            phone,
          };

    console.log("[Auth] Signup payload", payload);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      console.log("[Auth] Signup response", response.status, data);

      if (!response.ok) {
        throw new Error(data?.detail || "Sign up failed");
      }

      localStorage.setItem("nexus_access_token", data.accessToken);
      localStorage.setItem("nexus_user", JSON.stringify(data.user));
      navigate(data.redirectPath || "/dashboard");
    } catch (error) {
      console.error("[Auth] Signup failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Signup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8">
      <Link to="/" className="flex items-center gap-2 mb-8">
        <img src="/logo.png" alt="NEXUS Logo" className="h-6 w-6 rounded-sm" />
        <span className="text-lg font-bold text-foreground">NEXUS</span>
      </Link>

      <div className="w-full max-w-[560px] rounded-card border bg-card p-8 shadow-card space-y-6">
        {step === 1 ? (
          <>
            <h2 className="text-xl font-bold text-foreground">Create your Nexus account</h2>
            <div className="grid grid-cols-3 gap-3">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-card border p-4 text-center transition-all",
                    selectedRole === role.id ? "border-primary bg-primary-light shadow-card" : "border-border hover:border-primary/30"
                  )}
                >
                  <role.icon className={cn("h-5 w-5", selectedRole === role.id ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-xs font-semibold text-foreground">{role.label}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Full Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ravi Kumar" className="mt-1 rounded-button" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@ngo.org" className="mt-1 rounded-button" />
              </div>
            </div>

            <div>
              <Label>Primary Language</Label>
              <select value={primaryLanguage} onChange={(e) => setPrimaryLanguage(e.target.value)} className="mt-1 flex h-10 w-full rounded-button border border-input bg-background px-3 py-2 text-sm">
                {["English", "Hindi", "Kannada", "Tamil", "Telugu"].map((lang) => <option key={lang} value={lang}>{lang}</option>)}
              </select>
            </div>

            <div>
              <Label>Password</Label>
              <div className="relative mt-1">
                <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="rounded-button pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button variant="gradient" className="w-full" size="lg" onClick={() => setStep(2)}>Continue →</Button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-foreground">
              {selectedRole === "coordinator" ? "Coordinator Setup" : selectedRole === "fieldworker" ? "Field Worker Setup" : "Volunteer Setup"}
            </h2>

            {selectedRole === "coordinator" ? (
              <div className="space-y-4">
                <div className="rounded-card border p-4 space-y-2">
                  <Label>Join existing NGO or create new</Label>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2"><input type="radio" checked={joinMode === "create"} onChange={() => setJoinMode("create")} />Create new</label>
                    <label className="flex items-center gap-2"><input type="radio" checked={joinMode === "join"} onChange={() => setJoinMode("join")} />Join existing</label>
                  </div>
                </div>

                {joinMode === "join" ? (
                  <div>
                    <Label>Select NGO</Label>
                    <select
                      value={ngoId}
                      onChange={(e) => setNgoId(e.target.value)}
                      className="mt-1 flex h-10 w-full rounded-button border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">{loadingNgos ? "Loading NGOs..." : "Select NGO"}</option>
                      {ngoOptions.map((ngo) => (
                        <option key={ngo.id} value={ngo.id}>
                          {ngo.name}{ngo.city ? ` (${ngo.city})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div><Label>NGO Name</Label><Input value={ngoName} onChange={(e) => setNgoName(e.target.value)} className="mt-1 rounded-button" /></div>
                    <div>
                      <Label>City</Label>
                      <select value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 flex h-10 w-full rounded-button border border-input bg-background px-3 py-2 text-sm">
                        <option value="">Select city</option>
                        {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </>
                )}

                <div><Label>Operating Zones (comma separated)</Label><Input value={zoneInput} onChange={(e) => setZoneInput(e.target.value)} className="mt-1 rounded-button" /></div>

                <div>
                  <Label>Need Categories</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {needCategories.map((cat) => (
                      <button key={cat} onClick={() => toggleChip(cat, selectedNeedCategories, setSelectedNeedCategories)} className={cn("rounded-pill border px-3 py-1.5 text-xs", selectedNeedCategories.includes(cat) ? "border-primary bg-primary text-white" : "border-border")}>{cat}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Data Channels</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {dataChannels.map((channel) => (
                      <button key={channel} onClick={() => toggleChip(channel, selectedDataChannels, setSelectedDataChannels)} className={cn("rounded-pill border px-3 py-1.5 text-xs", selectedDataChannels.includes(channel) ? "border-primary bg-primary text-white" : "border-border")}>{channel}</button>
                    ))}
                  </div>
                </div>

                <div><Label>Phone (optional)</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 rounded-button" /></div>
              </div>
            ) : selectedRole === "fieldworker" ? (
              <div className="space-y-4">
                <div>
                  <Label>Select NGO</Label>
                  <select
                    value={ngoId}
                    onChange={(e) => setNgoId(e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-button border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">{loadingNgos ? "Loading NGOs..." : "Select NGO"}</option>
                    {ngoOptions.map((ngo) => (
                      <option key={ngo.id} value={ngo.id}>
                        {ngo.name}{ngo.city ? ` (${ngo.city})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div><Label>Additional Languages (comma separated)</Label><Input value={additionalLanguagesInput} onChange={(e) => setAdditionalLanguagesInput(e.target.value)} className="mt-1 rounded-button" /></div>
                <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 rounded-button" /></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Select NGO</Label>
                  <select
                    value={ngoId}
                    onChange={(e) => setNgoId(e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-button border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">{loadingNgos ? "Loading NGOs..." : "Select NGO"}</option>
                    {ngoOptions.map((ngo) => (
                      <option key={ngo.id} value={ngo.id}>
                        {ngo.name}{ngo.city ? ` (${ngo.city})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div><Label>Zones of Comfort (comma separated)</Label><Input value={zoneInput} onChange={(e) => setZoneInput(e.target.value)} className="mt-1 rounded-button" /></div>
                <div><Label>Skills (comma separated)</Label><Input value={volunteerSkillsInput} onChange={(e) => setVolunteerSkillsInput(e.target.value)} className="mt-1 rounded-button" /></div>
                <div><Label>Travel Radius (km)</Label><Input type="number" value={travelRadius} onChange={(e) => setTravelRadius(Number(e.target.value || 5))} className="mt-1 rounded-button" /></div>
                <div>
                  <Label>Emotional Capacity</Label>
                  <select value={emotionalCapacity} onChange={(e) => setEmotionalCapacity(e.target.value as "light" | "moderate" | "intensive")} className="mt-1 flex h-10 w-full rounded-button border border-input bg-background px-3 py-2 text-sm">
                    <option value="light">Light</option>
                    <option value="moderate">Moderate</option>
                    <option value="intensive">Intensive</option>
                  </select>
                </div>
                <div><Label>Avoid Categories (comma separated)</Label><Input value={avoidCategoriesInput} onChange={(e) => setAvoidCategoriesInput(e.target.value)} className="mt-1 rounded-button" /></div>
                <div><Label>Additional Languages (comma separated)</Label><Input value={additionalLanguagesInput} onChange={(e) => setAdditionalLanguagesInput(e.target.value)} className="mt-1 rounded-button" /></div>
                <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 rounded-button" /></div>
              </div>
            )}

            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
              <Button variant="gradient" className="flex-1" size="lg" onClick={handleSignup} disabled={isSubmitting}>
                {isSubmitting ? "Creating account..." : "Create account →"}
              </Button>
            </div>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Already have an account? <Link to="/login" className="text-primary font-semibold">Sign in</Link>
        </p>
      </div>

      <div className="mt-6 flex items-center gap-2 text-muted-foreground text-sm">
        <Hexagon className="h-4 w-4" />
        Nexus role-based onboarding
      </div>
    </div>
  );
}
