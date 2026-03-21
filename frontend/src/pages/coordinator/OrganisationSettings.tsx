import React, { useState } from "react";
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
  Users, 
  Pencil, 
  Trash2, 
  Search,
  Sparkles,
  Link as LinkIcon,
  Mail,
  Globe,
  CheckCircle2,
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
  ChevronRight,
  Monitor,
  Mic,
  MessageSquare,
  Phone,
  FileText,
  Target
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const OrganisationSettings = () => {
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(["food", "health", "mental"]);

  const toggleCategory = (id: string) => {
    setHasChanges(true);
    setSelectedCategories(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const categories = [
    { id: "food", label: "Food Security", icon: Utensils },
    { id: "health", label: "Healthcare", icon: Stethoscope },
    { id: "edu", label: "Education", icon: Book },
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

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7FF] font-['Plus_Jakarta_Sans']">
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardTopBar breadcrumb="Settings / Organisation" />
        
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[780px] mx-auto p-8 space-y-10 pb-24">
            
            {/* Header */}
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
                disabled={!hasChanges}
                className={cn(
                  "h-11 px-6 rounded-xl font-bold transition-all shadow-lg",
                  hasChanges 
                    ? "bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white shadow-indigo-200" 
                    : "bg-slate-200 text-slate-400 border-none cursor-not-allowed"
                )}
              >
                Save Changes
              </Button>
            </div>

            {/* CARD 1: NGO Identity */}
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
                          <Input onChange={() => setHasChanges(true)} defaultValue="Global Reach Initiative" className="bg-slate-50 border-slate-100 rounded-xl font-bold text-[#1A1A3D] h-11 focus:bg-white" />
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">REG NUMBER</Label>
                          <Input onChange={() => setHasChanges(true)} defaultValue="NGO-88291-ZX" className="bg-slate-50 border-slate-100 rounded-xl font-bold text-[#1A1A3D] h-11 focus:bg-white" />
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">FOUNDED YEAR</Label>
                          <Input onChange={() => setHasChanges(true)} defaultValue="2012" className="bg-slate-50 border-slate-100 rounded-xl font-bold text-[#1A1A3D] h-11 focus:bg-white" />
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">NGO TYPE</Label>
                          <select className="flex h-11 w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold text-[#1A1A3D] focus:bg-white outline-none">
                             <option>Social Services</option>
                             <option>Healthcare</option>
                             <option>Education</option>
                          </select>
                       </div>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">DESCRIPTION</Label>
                       <Textarea onChange={() => setHasChanges(true)} className="bg-slate-50 border-slate-100 rounded-2xl font-medium text-[#1A1A3D] min-h-[100px] focus:bg-white resize-none" defaultValue="Facilitating cross-border community orchestration and intelligence-driven aid distribution for displaced populations in Southeast Asia." />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">WEBSITE</Label>
                          <div className="relative">
                             <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                             <Input onChange={() => setHasChanges(true)} defaultValue="https://globalreach.org" className="pl-10 bg-slate-50 border-slate-100 rounded-xl font-bold text-[#1A1A3D] h-11 focus:bg-white" />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">PRIMARY EMAIL</Label>
                          <div className="relative">
                             <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                             <Input onChange={() => setHasChanges(true)} defaultValue="contact@globalreach.org" className="pl-10 bg-slate-50 border-slate-100 rounded-xl font-bold text-[#1A1A3D] h-11 focus:bg-white" />
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="md:w-[160px] space-y-4">
                    <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center block">NGO LOGO</Label>
                    <div className="aspect-square w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 gap-2 cursor-pointer hover:bg-slate-100 transition-colors group">
                       <Upload className="w-6 h-6 group-hover:scale-110 transition-transform" />
                       <span className="text-[10px] font-black uppercase text-center px-4">Upload Logo</span>
                    </div>
                 </div>
              </div>
              <div className="flex justify-end pr-0">
                 <Button variant="ghost" className="text-[#4F46E5] font-black uppercase text-[10px] tracking-widest py-6 px-8 hover:bg-indigo-50">Save Identity</Button>
              </div>
            </div>

            {/* CARD 2: Service Zones */}
            <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-8">
              <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[#4F46E5]">
                       <MapPin className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-black text-[#1A1A3D] uppercase tracking-widest">Service Zones</h3>
                 </div>
                 <Button variant="ghost" className="text-[#4F46E5] font-black uppercase text-[10px] tracking-widest hover:bg-indigo-50 flex gap-2">
                    <Plus className="w-4 h-4" /> Add Zone
                 </Button>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-none">
                 {[
                   { name: "Central Metro", location: "Singapore City, Ward 04", needs: 24, vols: 142 },
                   { name: "Harbor District", location: "Jurong West, Ward 12", needs: 8, vols: 56 }
                 ].map((zone) => (
                    <div key={zone.name} className="min-w-[240px] bg-white rounded-2xl border border-slate-100 p-6 space-y-6 group hover:border-indigo-200 hover:shadow-sm transition-all">
                       <div className="flex justify-between items-start">
                          <Badge className="bg-[#DCFCE7] text-[#166534] border-none font-black text-[9px] uppercase px-2 py-0.5 tracking-widest">Active</Badge>
                          <div className="flex gap-1">
                             <button className="text-slate-300 hover:text-slate-500 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                             <button className="text-slate-300 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
                          </div>
                       </div>
                       <div className="space-y-1">
                          <h4 className="text-[15px] font-black text-[#1A1A3D]">{zone.name}</h4>
                          <p className="text-[11px] font-medium text-slate-400">{zone.location}</p>
                       </div>
                       <div className="flex gap-6 border-t border-slate-50 pt-4">
                          <div className="space-y-0.5">
                             <p className="text-[15px] font-black text-[#1A1A3D]">{zone.needs}</p>
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Needs</p>
                          </div>
                          <div className="space-y-0.5">
                             <p className="text-[15px] font-black text-[#1A1A3D]">{zone.vols}</p>
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Volunteers</p>
                          </div>
                       </div>
                    </div>
                 ))}
                 <div className="min-w-[240px] rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300 gap-3 cursor-pointer hover:border-slate-200 hover:bg-slate-50 transition-all">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Create New Zone</span>
                 </div>
              </div>
            </div>

            {/* CARD 3: Need Categories */}
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

            {/* CARD 4: Data Collection */}
            <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-8">
               <div className="space-y-1">
                 <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[#4F46E5]">
                       <FileText className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-black text-[#1A1A3D] uppercase tracking-widest">Data Collection Methods</h3>
                 </div>
                 <p className="text-xs font-medium text-slate-400">How do your field workers submit reports?</p>
               </div>

               <div className="space-y-3">
                  {[
                    { id: "ocr", label: "Paper Survey Scan", desc: "OCR processing of field documents", icon: Monitor, defaultChecked: true },
                    { id: "voice", label: "Voice Reports", desc: "AI-transcribed audio interviews", icon: Mic },
                    { id: "sms", label: "SMS Reporting", desc: "Two-way text based data entry", icon: MessageSquare, defaultChecked: true },
                    { id: "ivr", label: "IVR Calls", desc: "Interactive voice response surveys", icon: Phone },
                    { id: "digital", label: "Digital Forms", desc: "Direct mobile application input", icon: FileText, defaultChecked: true },
                  ].map((method) => (
                     <div key={method.id} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100 group hover:bg-white hover:border-indigo-100 transition-all">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#4F46E5] group-hover:shadow-sm transition-all">
                              <method.icon className="w-5 h-5" />
                           </div>
                           <div className="space-y-0.5">
                              <p className="text-sm font-bold text-[#1A1A3D]">{method.label}</p>
                              <p className="text-[11px] font-medium text-slate-400 leading-none">{method.desc}</p>
                           </div>
                        </div>
                        <Switch defaultChecked={method.defaultChecked} className="data-[state=checked]:bg-[#4F46E5]" onCheckedChange={() => setHasChanges(true)} />
                     </div>
                  ))}
               </div>
            </div>

            {/* CARD 5: Connected NGOs */}
            <div className="bg-white rounded-[2rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 space-y-8">
               <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[#4F46E5]">
                       <LinkIcon className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-black text-[#1A1A3D] uppercase tracking-widest">Connected NGOs</h3>
                 </div>
                 <Button variant="ghost" className="text-[#4F46E5] font-black uppercase text-[10px] tracking-widest hover:bg-indigo-50">
                    + Invite NGO
                 </Button>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#4F46E5] flex items-center justify-center text-white font-black text-xs">AS</div>
                        <div className="space-y-0.5">
                           <p className="text-sm font-bold text-[#1A1A3D]">Alliance South</p>
                           <p className="text-[10px] font-medium text-slate-400">Partner since Jan 2023</p>
                        </div>
                     </div>
                     <Badge className="bg-[#DCFCE7] text-[#166534] border-none font-bold text-[9px] uppercase px-3 py-1 tracking-widest">Collaboration Active</Badge>
                  </div>

                  <div className="p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col md:flex-row gap-6 relative overflow-hidden">
                     <div className="space-y-3 flex-1 relative z-10">
                        <div className="flex items-center gap-2">
                           <Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" />
                           <span className="text-[10px] font-black text-[#4F46E5] uppercase tracking-widest">Intelligence Suggestion</span>
                        </div>
                        <h4 className="text-sm font-bold text-[#1A1A3D]">CareNet NGO</h4>
                        <p className="text-xs text-[#64748B] leading-relaxed pr-8 font-medium">CareNet shares 85% zone overlap and complementary "Elder Care" resources. Strategic partnership recommended for Q3.</p>
                        <Button className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-black text-[10px] uppercase tracking-widest h-9 px-6 rounded-lg mt-2">Connect with CareNet</Button>
                     </div>
                     <div className="absolute top-0 right-0 p-8 opacity-20 hidden md:block">
                        <Sparkles className="w-16 h-16 text-[#4F46E5]" />
                     </div>
                  </div>
               </div>
            </div>

            {/* CARD 6: Public Profile */}
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
                    <Switch defaultChecked className="data-[state=checked]:bg-[#4F46E5]" />
                 </div>
               </div>

               <div className="space-y-8">
                  <div className="p-10 bg-[#F8F7FF] rounded-[2.5rem] border border-slate-100 space-y-8 text-center max-w-lg mx-auto overflow-hidden relative">
                     <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-indigo-400/5 rounded-full blur-3xl -mt-40" />
                     <div className="relative z-10 flex flex-col items-center gap-4">
                        <div className="w-20 h-20 rounded-[2rem] bg-[#8BBD70] flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-[#8BBD70]/20">GRI</div>
                        <div className="space-y-2">
                           <h3 className="text-2xl font-black text-[#1A1A3D]">Global Reach Initiative</h3>
                           <p className="text-sm font-bold text-[#4F46E5] tracking-wide">Bridging gaps, Building futures.</p>
                        </div>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-sm italic">"Our mission is to create resilient data networks that empower local leaders to act with precision and empathy in times of crisis."</p>
                        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md pt-4">
                           <div className="flex-1 bg-white p-3.5 rounded-2xl shadow-sm border border-slate-50 flex items-center justify-center gap-2">
                              <Share2 className="w-4 h-4 text-indigo-400" />
                              <span className="text-[11px] font-black text-slate-600">@globalreach_ngo</span>
                           </div>
                           <div className="flex-1 bg-white p-3.5 rounded-2xl shadow-sm border border-slate-50 flex items-center justify-center gap-2">
                              <Zap className="w-4 h-4 text-[#D97706]" />
                              <span className="text-[11px] font-black text-slate-600">12.4k IMPACT SCORE</span>
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