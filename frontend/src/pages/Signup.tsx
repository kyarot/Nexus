import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Hexagon, Building2, ClipboardList, Heart, Eye, EyeOff, CheckCircle2, Info, Camera, FileText, MessageCircle, Phone, Footprints, ArrowRight, Sparkles, Users, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const roles = [
  { id: "coordinator", label: "NGO Coordinator", icon: Building2, desc: "Manage teams, view insights & reports" },
  { id: "fieldworker", label: "Field Worker", icon: ClipboardList, desc: "Collect data, scan surveys, report" },
  { id: "volunteer", label: "Volunteer", icon: Heart, desc: "Execute missions, serve communities" },
] as const;

const cities = ["Bengaluru", "Mumbai", "Delhi", "Chennai", "Hyderabad", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Lucknow"];
const needCategories = ["Food", "Health", "Education", "Shelter", "Mental Health", "Women Safety", "Elder Care", "Substance Risk"];
const dataMethods = [
  { id: "paper", label: "Paper Surveys", icon: FileText },
  { id: "digital", label: "Digital Forms", icon: ClipboardList },
  { id: "whatsapp", label: "WhatsApp Reports", icon: MessageCircle },
  { id: "voice", label: "Voice Calls", icon: Phone },
  { id: "field", label: "Field Visits", icon: Footprints },
];

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState("coordinator");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [reportsPerWeek, setReportsPerWeek] = useState([50]);
  const [preSeed, setPreSeed] = useState(false);

  const passwordStrength = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const strengthColors = ["bg-destructive", "bg-warning", "bg-warning", "bg-success"];

  const toggleCategory = (c: string) => setSelectedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleMethod = (m: string) => setSelectedMethods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8">
      <Link to="/" className="flex items-center gap-2 mb-8">
        <img src="/logo.png" alt="NEXUS Logo" className="h-6 w-6 rounded-sm" />
        <span className="text-lg font-bold text-foreground">NEXUS</span>
      </Link>

      {/* Progress */}
      <div className="w-full max-w-[520px] mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Step {step} of 4</span>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={cn("h-1.5 flex-1 rounded-full transition-colors", s <= step ? "bg-primary" : "bg-border")} />
          ))}
        </div>
      </div>

      <div className="w-full max-w-[520px] rounded-card border bg-card p-8 shadow-card">
        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">Create your Nexus account</h2>
            <div>
              <p className="text-sm font-medium text-foreground mb-3">I am a...</p>
              <div className="grid grid-cols-3 gap-3">
                {roles.map(r => (
                  <button key={r.id} onClick={() => setSelectedRole(r.id)} className={cn("flex flex-col items-center gap-2 rounded-card border p-4 transition-all text-center", selectedRole === r.id ? "border-primary bg-primary-light shadow-card" : "border-border hover:border-primary/30")}>
                    <r.icon className={cn("h-6 w-6", selectedRole === r.id ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-xs font-semibold text-foreground">{r.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Full Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ravi Kumar" className="mt-1 rounded-button" /></div>
              <div><Label>Email</Label><Input type="email" placeholder="ravi@ngo.org" className="mt-1 rounded-button" /></div>
            </div>
            <div>
              <Label>Password</Label>
              <div className="relative mt-1">
                <Input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="rounded-button pr-10" />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><EyeOff className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 flex gap-1">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={cn("h-1 flex-1 rounded-full", i < passwordStrength ? strengthColors[passwordStrength - 1] : "bg-border")} />
                ))}
              </div>
            </div>
            <Button variant="gradient" className="w-full" size="lg" onClick={() => setStep(2)}>Continue →</Button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">Tell us about your NGO</h2>
            <div><Label>NGO Name</Label><Input placeholder="Community First Foundation" className="mt-1 rounded-button" /></div>
            <div>
              <Label>City</Label>
              <select className="mt-1 flex h-10 w-full rounded-button border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Select city</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><Label>Zone / Ward</Label><Input placeholder="Hebbal North, Zone 4" className="mt-1 rounded-button" /></div>
            <div><Label>How many volunteers do you coordinate?</Label><Input type="number" placeholder="25" className="mt-1 rounded-button" /></div>
            <div>
              <Label>Primary need categories</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {needCategories.map(c => (
                  <button key={c} onClick={() => toggleCategory(c)} className={cn("rounded-pill border px-3 py-1.5 text-xs font-medium transition-all", selectedCategories.includes(c) ? "border-primary bg-primary text-white" : "border-border text-foreground hover:border-primary/30")}>{c}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
              <Button variant="gradient" className="flex-1" size="lg" onClick={() => setStep(3)}>Continue →</Button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">How do you collect community data?</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {dataMethods.map(m => (
                <button key={m.id} onClick={() => toggleMethod(m.id)} className={cn("flex flex-col items-center gap-2 rounded-card border p-4 transition-all", selectedMethods.includes(m.id) ? "border-primary bg-primary-light shadow-card" : "border-border hover:border-primary/30")}>
                  <m.icon className={cn("h-5 w-5", selectedMethods.includes(m.id) ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-xs font-medium text-foreground text-center">{m.label}</span>
                </button>
              ))}
            </div>
            <div>
              <Label>How many field reports per week?</Label>
              <div className="mt-3 px-1">
                <Slider value={reportsPerWeek} onValueChange={setReportsPerWeek} max={500} step={10} />
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span className="font-semibold text-primary font-data">{reportsPerWeek[0]}</span>
                  <span>500</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-card border p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Pre-seed with ASHA/census data</span>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <Switch checked={preSeed} onCheckedChange={setPreSeed} />
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep(2)}>← Back</Button>
              <Button variant="gradient" className="flex-1" size="lg" onClick={() => setStep(4)}>Continue →</Button>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-light">
              <CheckCircle2 className="h-10 w-10 text-primary animate-fade-in" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Welcome to Nexus, {name || "there"}!</h2>
            <p className="text-sm text-muted-foreground">Your workspace is ready. Here's how to get started:</p>
            <div className="space-y-3 text-left">
              {[
                { icon: Camera, label: "Scan your first paper report" },
                { icon: Users, label: "Add your first volunteer" },
                { icon: MapIcon, label: "View your community map" },
              ].map((a, i) => (
                <button key={i} className="flex w-full items-center gap-3 rounded-card border p-4 text-left transition-all hover:border-primary/30 hover:shadow-card">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light shrink-0">
                    <a.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-foreground">{a.label}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
            <Button variant="gradient" className="w-full" size="lg" onClick={() => navigate("/dashboard")}>Go to dashboard →</Button>
          </div>
        )}
      </div>
    </div>
  );
}
