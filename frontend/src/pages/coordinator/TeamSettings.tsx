import React, { useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Users, 
  Plus, 
  Shield, 
  UserCircle, 
  Eye, 
  Pencil, 
  Trash2, 
  MoreVertical,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  ShieldCheck,
  MapPin,
  Check,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

const TeamSettings = () => {
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const teamMembers = [
    { name: "Sarah Coordinator", email: "sarah@nexus-ngo.org", role: "Admin", zones: ["All zones"], lastActive: "Active now", initials: "SC", color: "bg-purple-100 text-purple-600", isSelf: true },
    { name: "Rahul M.", email: "rahul@nexus-ngo.org", role: "Coordinator", zones: ["Hebbal", "Yelahanka"], lastActive: "2 hours ago", initials: "RM", color: "bg-indigo-100 text-indigo-600" },
    { name: "Ananya S.", email: "ananya@nexus-ngo.org", role: "Coordinator", zones: ["Jalahalli"], lastActive: "Yesterday", initials: "AS", color: "bg-blue-100 text-blue-600" },
    { name: "Dev K.", email: "dev@nexus-ngo.org", role: "Viewer", zones: ["All zones"], lastActive: "3 days ago", initials: "DK", color: "bg-slate-100 text-slate-600" },
    { name: "Meera T.", email: "meera@nexus-ngo.org", role: "Coordinator", zones: ["Thanisandra"], lastActive: "5 days ago", initials: "MT", color: "bg-teal-100 text-teal-600" },
    { name: "invited@ngo.org", email: "Invitation sent", role: "TBD", zones: ["--"], lastActive: "PENDING", initials: "@", color: "bg-amber-50 text-amber-500", isPending: true },
  ];

  const permissions = [
    { feature: "View dashboard", admin: true, coord: true, viewer: true },
    { feature: "Create missions", admin: true, coord: true, viewer: false },
    { feature: "Dispatch volunteers", admin: true, coord: true, viewer: false },
    { feature: "View reports", admin: true, coord: true, viewer: true },
    { feature: "Export data", admin: true, coord: true, viewer: false },
    { feature: "Manage team", admin: true, coord: false, viewer: false },
    { feature: "Billing", admin: true, coord: false, viewer: false },
    { feature: "Delete data", admin: true, coord: false, viewer: false },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7FF] font-['Plus_Jakarta_Sans']">
      <DashboardTopBar 
        breadcrumb="Settings / Team" 
        rightElement={
          <Sheet open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <SheetTrigger asChild>
              <Button className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] text-white font-black text-xs uppercase tracking-widest px-6 h-11 rounded-xl shadow-lg shadow-indigo-200/50 flex gap-2">
                <Plus className="w-4 h-4" /> Invite Member
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-[440px] p-0 border-l border-slate-100 font-['Plus_Jakarta_Sans']">
              <div className="flex flex-col h-full bg-white">
                <div className="p-8 border-b border-slate-50">
                  <SheetTitle className="text-2xl font-black text-[#1A1A3D]">Invite a team member</SheetTitle>
                  <p className="text-sm text-slate-400 mt-1 font-medium">Add members to work on your NGO's missions.</p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">EMAIL ADDRESSES</Label>
                    <Input placeholder="rahul@ngo.org, ananya@ngo.org" className="bg-slate-50 border-slate-100 rounded-xl h-12 focus:bg-white font-medium" />
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ASSIGN ROLE</Label>
                    <RadioGroup defaultValue="coordinator" className="space-y-3">
                      {[
                        { id: "admin", label: "Admin", desc: "Full access, billing, settings", icon: ShieldCheck, color: "text-purple-600" },
                        { id: "coordinator", label: "Coordinator", desc: "Missions, volunteers, reports", icon: UserCircle, color: "text-indigo-600" },
                        { id: "viewer", label: "Viewer", desc: "Read-only access to dashboard", icon: Eye, color: "text-slate-500" },
                      ].map((role) => (
                        <div key={role.id} className="relative group">
                          <RadioGroupItem value={role.id} id={role.id} className="peer sr-only" />
                          <Label
                            htmlFor={role.id}
                            className="flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-50 bg-slate-50/50 cursor-pointer transition-all peer-data-[state=checked]:border-[#4F46E5] peer-data-[state=checked]:bg-indigo-50/30 group-hover:bg-white group-hover:border-slate-100"
                          >
                            <div className={cn("w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm", role.color)}>
                              <role.icon className="w-5 h-5" />
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-sm font-black text-[#1A1A3D]">{role.label}</p>
                              <p className="text-[11px] text-slate-400 font-medium">{role.desc}</p>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ZONE ACCESS</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">All Zones</span>
                        <Checkbox className="data-[state=checked]:bg-[#4F46E5] rounded-md" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {["Central Metro", "Harbor District", "Hebbal", "Yelahanka"].map((zone) => (
                        <div key={zone} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <Checkbox id={zone} className="data-[state=checked]:bg-[#4F46E5] rounded-md" />
                          <Label htmlFor={zone} className="text-[11px] font-bold text-[#1A1A3D] cursor-pointer uppercase tracking-wider">{zone}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">PERSONAL MESSAGE (OPTIONAL)</Label>
                    <Textarea placeholder="Add a note to the invite email..." className="bg-slate-50 border-slate-100 rounded-2xl min-h-[100px] resize-none focus:bg-white font-medium text-sm" />
                  </div>
                </div>

                <div className="p-8 bg-slate-50/50 border-t border-slate-100 space-y-3">
                  <Button className="w-full h-12 bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-200/50">
                    Send Invitation
                  </Button>
                  <Button variant="ghost" className="w-full text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-transparent hover:text-[#1A1A3D]" onClick={() => setIsInviteOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        }
      />
      
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto p-8 space-y-10 pb-24">
          
          {/* Header */}
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-[#4F46E5]">
                <Users className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-bold text-[#1A1A3D]">Team</h1>
            </div>
            <p className="text-[#64748B] font-medium text-base">Manage who has access to your NGO's Nexus workspace</p>
          </div>

          {/* Role Legend Card */}
          <div className="bg-white rounded-[2rem] p-6 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100">
            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
              {[
                { label: "Admin", color: "bg-purple-600", desc: "Full access, billing, settings", dot: "bg-purple-100" },
                { label: "Coordinator", color: "bg-[#4F46E5]", desc: "Missions, volunteers, reports", dot: "bg-indigo-100" },
                { label: "Viewer", color: "bg-slate-400", desc: "Read-only access to dashboard", dot: "bg-slate-100" },
              ].map((role) => (
                <div key={role.label} className="flex-1 px-4 py-4 md:py-0 first:pl-0 last:pr-0 space-y-1.5 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <div className={cn("w-2 h-2 rounded-full", role.color)} />
                    <span className="text-[11px] font-black uppercase tracking-widest text-[#1A1A3D]">{role.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed">{role.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Team Members List */}
          <div className="bg-white rounded-[2rem] shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-[#4F46E5] border-none">
                <TableRow className="hover:bg-[#4F46E5] border-none">
                  <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-white/70">Name</TableHead>
                  <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-white/70">Role</TableHead>
                  <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-white/70 text-center">Zones</TableHead>
                  <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-white/70 text-right">Last Active</TableHead>
                  <TableHead className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-white/70 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((member, i) => (
                  <TableRow key={member.name} className={cn("border-slate-50", i % 2 !== 0 ? "bg-[#F8F9FA]" : "bg-white")}>
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0", member.color)}>
                          {member.initials}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-[#1A1A3D]">{member.name}</p>
                            {member.isSelf && (
                              <Badge className="bg-indigo-100 text-[#4F46E5] border-none text-[8px] font-black uppercase px-1.5 py-0">You</Badge>
                            )}
                          </div>
                          <p className="text-[11px] font-medium text-slate-400 leading-tight">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <Badge className={cn(
                        "border-none text-[9px] font-black uppercase px-2 py-0.5 tracking-widest",
                        member.role === "Admin" ? "bg-purple-100 text-purple-600" :
                        member.role === "Coordinator" ? "bg-indigo-100 text-[#4F46E5]" :
                        member.role === "Viewer" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-600"
                      )}>
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 px-6 text-center">
                      <div className="flex flex-wrap justify-center gap-1">
                        {member.zones.map((zone) => (
                          <Badge key={zone} variant="outline" className="text-[9px] border-slate-200 text-slate-500 font-bold px-2 py-0.5 bg-white">{zone}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6 text-right">
                      {member.isPending ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Pending</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1.5">
                            {member.lastActive === "Active now" && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                            <span className={cn("text-[11px] font-bold", member.lastActive === "Active now" ? "text-emerald-600" : "text-slate-400")}>
                                {member.lastActive}
                            </span>
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {member.isPending ? (
                          <>
                            <Button variant="ghost" className="h-8 text-[#4F46E5] font-black text-[9px] uppercase tracking-widest hover:bg-indigo-50 px-2">Resend</Button>
                            <Button variant="ghost" className="h-8 text-red-400 hover:text-red-500 hover:bg-red-50 px-2"><X className="w-4 h-4" /></Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" className="h-8 w-8 p-0 text-slate-300 hover:text-[#4F46E5] hover:bg-indigo-50"><Pencil className="w-4 h-4" /></Button>
                            {!member.isSelf && (
                              <Button variant="ghost" className="h-8 w-8 p-0 text-slate-300 hover:text-red-400 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-5 border-t border-slate-50 flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] bg-white">
              <span>5 members · 1 pending invite</span>
              <div className="flex gap-2">
                <Button disabled variant="outline" className="h-8 px-3 text-[10px] uppercase font-black tracking-widest border-slate-100 text-slate-300">Prev</Button>
                <Button disabled variant="outline" className="h-8 px-3 text-[10px] uppercase font-black tracking-widest border-slate-100 text-slate-300">Next</Button>
              </div>
            </div>
          </div>

          {/* Permissions Matrix */}
          <div className="bg-white rounded-[2rem] shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 overflow-hidden">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="permissions" className="border-none">
                <AccordionTrigger className="px-8 py-6 hover:no-underline group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[#4F46E5]">
                      <Shield className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-black text-[#1A1A3D] uppercase tracking-widest">What can each role do?</h3>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-8 pb-8">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-50 hover:bg-transparent">
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#1A1A3D] py-4">Feature</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#1A1A3D] text-center py-4">Admin</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#1A1A3D] text-center py-4">Coord.</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-[#1A1A3D] text-center py-4">Viewer</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {permissions.map((p) => (
                          <TableRow key={p.feature} className="border-slate-50 hover:bg-slate-50/30">
                            <TableCell className="text-xs font-bold text-slate-500 py-4 capitalize">{p.feature}</TableCell>
                            <TableCell className="text-center py-4">
                              <div className="flex justify-center">
                                {p.admin ? <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Check className="w-3 h-3 stroke-[3]" /></div> : <X className="w-4 h-4 text-slate-200" />}
                              </div>
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <div className="flex justify-center">
                                {p.coord ? <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Check className="w-3 h-3 stroke-[3]" /></div> : <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-300"><X className="w-3 h-3 stroke-[3]" /></div>}
                              </div>
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <div className="flex justify-center">
                                {p.viewer ? <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Check className="w-3 h-3 stroke-[3]" /></div> : <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-300"><X className="w-3 h-3 stroke-[3]" /></div>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TeamSettings;