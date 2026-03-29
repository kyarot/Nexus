import React, { useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  Plus, 
  Search, 
  LayoutGrid, 
  List, 
  Map as MapIcon, 
  Filter, 
  MapPin, 
  User, 
  Phone, 
  AlertTriangle,
  X,
  ChevronRight,
  MoreHorizontal,
  Edit2,
  Share2,
  History,
  Box,
  Truck,
  Activity,
  Wind,
  Shield,
  Utensils,
  Droplets
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetClose
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

// Mock Data
const initialResources = [
  {
    id: "RES-001",
    name: "Food packets",
    category: "Food",
    quantity: 24,
    unit: "food packets",
    threshold: 10,
    location: "Asha warehouse",
    distance: "1.2km from Zone 4",
    contact: "Rajan Kumar",
    phone: "+91 98765-43210",
    zones: ["Zone 4", "Zone 7"],
    status: "Available",
    color: "bg-amber-500"
  },
  {
    id: "RES-002",
    name: "First aid kits",
    category: "Medical",
    quantity: 4,
    unit: "kits",
    threshold: 10,
    location: "Central Clinic Hub",
    distance: "0.4km from Zone 2",
    contact: "Dr. Meena S.",
    phone: "+91 98765-11223",
    zones: ["Zone 2"],
    status: "Low stock",
    color: "bg-red-500"
  },
  {
    id: "RES-003",
    name: "Tarpaulins (Heavy)",
    category: "Shelter",
    quantity: 85,
    unit: "sheets",
    threshold: 20,
    location: "Metro Godown 4",
    distance: "4.5km from Zone 12",
    contact: "Suresh P.",
    phone: "+91 98765-99887",
    zones: ["Zone 12", "Zone 9"],
    status: "Available",
    color: "bg-blue-500"
  },
  {
    id: "RES-004",
    name: "NGO Vehicle (SUV)",
    category: "Transport",
    quantity: 2,
    unit: "active",
    threshold: 1,
    location: "HQ Parking Annex",
    distance: "0.0km - On Base",
    contact: "Driver Satish",
    phone: "+91 98765-66778",
    zones: ["Global"],
    status: "Available",
    color: "bg-green-500"
  },
  {
    id: "RES-005",
    name: "ORS Sachets",
    category: "Medical",
    quantity: 450,
    unit: "in stock",
    threshold: 100,
    location: "Asha warehouse",
    distance: "1.2km from Zone 4",
    contact: "Rajan Kumar",
    phone: "+91 98765-43210",
    zones: ["Zone 4"],
    status: "Available",
    color: "bg-red-500"
  },
  {
    id: "RES-006",
    name: "Mosquito Nets",
    category: "Shelter",
    quantity: 0,
    unit: "stock",
    threshold: 20,
    location: "Metro Godown 1",
    distance: "3.2km from Zone 7",
    contact: "Suresh P.",
    phone: "+91 98765-99887",
    zones: ["Zone 7", "Zone 11"],
    status: "Unavailable",
    color: "bg-blue-500"
  }
];

const ResourceInventory = () => {
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddResource, setShowAddResource] = useState(false);
  const [logUsageRes, setLogUsageRes] = useState<any>(null);
  const [resources, setResources] = useState(initialResources);

  const stats = [
    { label: "Total Resources", value: "12", sub: "TYPES", color: "border-indigo-500", icon: Package },
    { label: "Available Now", value: "08", sub: "TYPES", color: "border-green-500", icon: Shield },
    { label: "Low Stock", value: "03", sub: "ITEMS", color: "border-amber-500", icon: AlertTriangle },
    { label: "Zones Covered", value: "06", sub: "ZONES", color: "border-purple-500", icon: MapPin },
  ];

  const categories = ["All", "Food", "Medical", "Shelter", "Transport", "Equipment"];

  const filteredResources = resources.filter(res => {
    const matchesCategory = selectedCategory === "All" || res.category === selectedCategory;
    const matchesSearch = res.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          res.location.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F7FF] font-['Plus_Jakarta_Sans'] pb-12">
      <DashboardTopBar breadcrumb="Operations / Resources" />
      
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-[#4F46E5] shadow-sm">
                <Package className="w-6 h-6" />
              </div>
              <h1 className="text-[32px] font-bold text-[#1A1A3D]">Resource Inventory</h1>
            </div>
            <p className="text-[#64748B] font-medium text-base">Track and manage supplies available near your zones for volunteers. Real-time logistical oversight for coordinated relief efforts.</p>
          </div>
          
          <Button 
            onClick={() => setShowAddResource(true)}
            className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] hover:opacity-90 text-white font-bold h-12 px-6 rounded-xl flex gap-2 shadow-lg shadow-indigo-200"
          >
            <Plus className="w-5 h-5" /> Add Resource
          </Button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <div key={i} className={cn(
              "bg-white rounded-[1.25rem] p-6 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border-l-[4px] flex flex-col justify-between h-32 relative overflow-hidden group",
              s.color
            )}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-[#64748B] uppercase tracking-widest">{s.label}</span>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-[32px] font-bold text-[#1A1A3D] leading-none">{s.value}</span>
                <span className="text-[11px] font-black text-[#64748B]/50 uppercase tracking-widest">{s.sub}</span>
              </div>
              <s.icon className="absolute -bottom-2 -right-2 w-16 h-16 text-slate-100 opacity-20 group-hover:scale-110 transition-transform" />
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/50 p-2 rounded-2xl border border-white/50 backdrop-blur-sm">
           <div className="flex flex-wrap items-center gap-3">
              <select className="h-11 bg-white border-slate-200 rounded-xl px-4 text-xs font-bold text-[#1A1A3D] outline-none border transition-all focus:border-[#4F46E5] hover:border-slate-300">
                <option>All zones</option>
                <option>Zone 4 · Hebbal</option>
                <option>Zone 7 · Jalahalli</option>
              </select>

              <div className="h-11 flex bg-white/80 p-1 rounded-xl border border-slate-200 gap-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-4 rounded-lg text-xs font-bold transition-all",
                      selectedCategory === cat ? "bg-[#4F46E5] text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
           </div>

           <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search resources..." 
                  className="pl-10 h-11 bg-white border-slate-200 rounded-xl text-sm font-medium focus-visible:ring-indigo-500" 
                />
              </div>
              
              <div className="flex h-11 bg-white p-1 rounded-xl border border-slate-200 gap-1">
                <button 
                  onClick={() => setViewMode("grid")}
                  className={cn("p-2 rounded-lg transition-all", viewMode === "grid" ? "bg-indigo-50 text-[#4F46E5]" : "text-slate-400")}
                >
                  <LayoutGrid className="w-4.5 h-4.5" />
                </button>
                <button 
                  onClick={() => setViewMode("list")}
                  className={cn("p-2 rounded-lg transition-all", viewMode === "list" ? "bg-indigo-50 text-[#4F46E5]" : "text-slate-400")}
                >
                  <List className="w-4.5 h-4.5" />
                </button>
                <button 
                  onClick={() => setViewMode("map")}
                  className={cn("p-2 rounded-lg transition-all", viewMode === "map" ? "bg-indigo-50 text-[#4F46E5]" : "text-slate-400")}
                >
                  <MapIcon className="w-4.5 h-4.5" />
                </button>
              </div>

              <Button variant="ghost" className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold flex gap-2">
                 <Filter className="w-4 h-4" /> Advanced Filters
              </Button>
           </div>
        </div>

        {/* Content Section */}
        {viewMode === "map" ? (
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 overflow-hidden relative">
                <div className="flex justify-between items-start mb-6">
                   <div>
                      <h3 className="text-xl font-bold text-[#1A1A3D]">Live Zone Overview</h3>
                      <p className="text-sm text-slate-400 font-medium">Spatial distribution of current inventory levels across active coordination zones.</p>
                   </div>
                   <Button variant="outline" className="rounded-full font-bold text-xs bg-white">Expand To Full Map</Button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   <div className="lg:col-span-2 relative h-[500px] bg-[#E0E7FF] rounded-[2rem] overflow-hidden border border-slate-100">
                      <div className="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/light-v10/static/77.5946,12.9716,12/800x500@2x?access_token=pk.xxx')] bg-cover opacity-60 grayscale-[40%]" />
                      <div className="absolute inset-0">
                         {/* Zone Polygons Placeholder */}
                         <div className="absolute top-1/4 left-1/3 w-32 h-32 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-green-500/30 transition-all">
                            <Badge className="bg-white text-green-600 font-bold px-2 py-0 border-none shadow-sm">Z4</Badge>
                         </div>
                         <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-indigo-500/20 border-2 border-indigo-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-indigo-500/30 transition-all">
                            <Badge className="bg-white text-indigo-600 font-bold px-2 py-0 border-none shadow-sm">Z7</Badge>
                         </div>
                         <div className="absolute bottom-1/4 left-1/2 w-40 h-40 bg-red-500/10 border-2 border-red-500/40 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-500/20 transition-all">
                            <Badge className="bg-white text-red-600 font-bold px-2 py-0 border-none shadow-sm">Z12</Badge>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">ZONE AVAILABILITY Tooltip</h4>
                      {[
                        { zone: "Zone 4", status: "OPTIMAL", color: "text-[#10B981]", bg: "bg-green-500", pct: 82, desc: "82% resource saturation (High supply area)" },
                        { zone: "Zone 7", status: "STABLE", color: "text-[#4F46E5]", bg: "bg-indigo-500", pct: 54, desc: "54% resource saturation (Standard supply area)" },
                        { zone: "Zone 12", status: "CRITICAL", color: "text-red-500", bg: "bg-red-500", pct: 18, desc: "18% resource saturation (Immediate dispatch needed)" },
                      ].map(z => (
                        <div key={z.zone} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                           <div className="flex justify-between items-baseline">
                              <span className="text-[13px] font-black text-[#1A1A3D] uppercase tracking-tighter">{z.zone}</span>
                              <span className={cn("text-[11px] font-black", z.color)}>{z.status}</span>
                           </div>
                           <div className="h-2 w-full bg-indigo-100/50 rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full transition-all duration-1000", z.bg)} style={{ width: `${z.pct}%` }} />
                           </div>
                           <p className="text-[10px] text-slate-400 font-medium">{z.desc}</p>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        ) : filteredResources.length > 0 ? (
          <div className={cn(
            "animate-in fade-in slide-in-from-bottom-4 duration-500",
            viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" : "space-y-4"
          )}>
            {filteredResources.map((res) => (
              <div key={res.id} className={cn(
                "bg-white rounded-[1.5rem] shadow-[0_4px_24px_rgba(79,70,229,0.06)] border border-slate-100 overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative",
                viewMode === "list" && "flex items-center"
              )}>
                {/* Category strip */}
                <div className={cn("h-1.5 w-full absolute top-0 left-0", res.color)} />
                
                <div className={cn("p-6 w-full space-y-6", viewMode === "list" && "space-y-0 flex items-center justify-between")}>
                   {/* Row 1: Name & Category */}
                   <div className="flex justify-between items-start">
                      <div className={cn(viewMode === "list" && "w-1/4")}>
                         <div className="flex items-center gap-2 mb-1">
                            <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md", 
                              res.category === 'Food' ? 'bg-amber-50 text-amber-600' :
                              res.category === 'Medical' ? 'bg-red-50 text-red-600' :
                              res.category === 'Shelter' ? 'bg-blue-50 text-blue-600' :
                              'bg-green-50 text-green-600'
                            )}>
                              {res.category}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-300">{res.id}</span>
                         </div>
                         <h3 className="text-xl font-bold text-[#1A1A3D]">{res.name}</h3>
                      </div>
                      
                      <div className="text-right">
                         <div className="flex items-baseline justify-end gap-1.5 leading-none">
                            <span className="text-[32px] font-black text-[#4F46E5]">{res.quantity}</span>
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">IN STOCK</span>
                         </div>
                         {res.status === 'Low stock' && (
                           <p className="text-[10px] font-bold text-amber-500 flex items-center justify-end gap-1 mt-1">
                             <AlertTriangle className="w-3 h-3" /> Critical replenishment required
                           </p>
                         )}
                      </div>
                   </div>

                   {/* Row 2: Location & Dist */}
                   <div className={cn(
                     "space-y-4 pt-4 border-t border-slate-50",
                     viewMode === "list" && "border-t-0 p-0 flex-1 flex items-center justify-around space-y-0"
                   )}>
                      <div className="flex items-start gap-3">
                         <MapPin className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                         <div className="min-w-0">
                            <p className="text-[13px] font-bold text-[#1A1A3D] truncate">{res.location}</p>
                            <p className="text-[11px] font-medium text-slate-400">{res.distance}</p>
                         </div>
                      </div>

                      <div className="flex items-start gap-3">
                         <User className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                         <div>
                            <p className="text-[13px] font-bold text-[#1A1A3D] leading-tight">{res.contact}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-medium text-slate-400">
                               <Phone className="w-3 h-3" /> {res.phone}
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Row 3: Zone Chips */}
                   <div className={cn("flex flex-wrap gap-2", viewMode === "list" && "hidden")}>
                      {res.zones.map(z => (
                        <Badge key={z} variant="outline" className="bg-indigo-50/50 text-[#4F46E5] border-indigo-100/50 font-bold text-[10px] rounded-lg">
                          {z}
                        </Badge>
                      ))}
                   </div>

                   {/* Footer: Status & Actions */}
                   <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                         <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", 
                            res.status === 'Available' ? 'bg-green-500' :
                            res.status === 'Low stock' ? 'bg-amber-500' : 'bg-red-400'
                         )} />
                         <span className={cn("text-[11px] font-black uppercase tracking-widest",
                            res.status === 'Available' ? 'text-green-600' :
                            res.status === 'Low stock' ? 'text-amber-600' : 'text-slate-400'
                         )}>{res.status}</span>
                      </div>

                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                         <Button onClick={() => setLogUsageRes(res)} variant="ghost" className="h-9 px-4 rounded-xl hover:bg-indigo-50 text-[#4F46E5] font-bold text-[11px]">Log Usage</Button>
                         <Button variant="ghost" className="h-9 w-9 p-0 rounded-xl hover:bg-slate-50 text-slate-400"><Edit2 className="w-4 h-4" /></Button>
                         <Button variant="ghost" className="h-9 w-9 p-0 rounded-xl hover:bg-slate-50 text-slate-400"><Share2 className="w-4 h-4" /></Button>
                      </div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 space-y-6 animate-in fade-in duration-700">
            <div className="w-24 h-24 bg-slate-100 rounded-[2rem] flex items-center justify-center text-slate-300 border border-dashed border-slate-200">
              <Package className="w-12 h-12" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-[#1A1A3D]">No resources added yet</h3>
              <p className="max-w-md text-slate-400 font-medium text-sm">Add your first resource to help volunteers know what's available near each zone for coordinated relief efforts.</p>
            </div>
            <Button onClick={() => setShowAddResource(true)} className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white px-8 py-6 rounded-2xl font-bold shadow-xl">
               Add First Resource
            </Button>
          </div>
        )}
      </div>

      {/* ADD RESOURCE SLIDE-OVER */}
      <Sheet open={showAddResource} onOpenChange={setShowAddResource}>
        <SheetContent className="sm:max-w-lg p-0 flex flex-col bg-white border-l border-slate-100 font-['Plus_Jakarta_Sans'] overflow-hidden">
           <SheetHeader className="p-8 border-b border-slate-50">
              <div className="flex justify-between items-center">
                 <SheetTitle className="text-2xl font-bold text-[#1A1A3D]">Add New Resource</SheetTitle>
                 <SheetClose className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 focus:outline-none ring-0">
                    <X className="w-4 h-4" />
                 </SheetClose>
              </div>
              <p className="text-sm text-slate-400 mt-1">Register new supplies, transportation or equipment into the registry.</p>
           </SheetHeader>

           <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="space-y-2">
                 <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">RESOURCE NAME</label>
                 <Input placeholder="e.g., Heavy Tarpaulin sheets" className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-bold" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">CATEGORY</label>
                    <select className="flex h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm font-bold shadow-sm outline-none">
                       {categories.slice(1).map(c => <option key={c}>{c}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">UNIT TYPE</label>
                    <Input placeholder="e.g., Packets / Kits" className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-bold" />
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">INITIAL QUANTITY</label>
                    <Input type="number" defaultValue={0} className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-bold" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ALERT THRESHOLD</label>
                    <Input type="number" defaultValue={5} className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-bold" />
                 </div>
              </div>

              <div className="space-y-2">
                 <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">STORAGE LOCATION</label>
                    <button className="text-[10px] font-bold text-[#4F46E5] flex items-center gap-1"><MapIcon className="w-3 h-3" /> Select on map</button>
                 </div>
                 <Input placeholder="Warehouse name / Area" className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-bold" />
              </div>

              <div className="space-y-4">
                 <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ZONES SERVED</label>
                 <div className="grid grid-cols-2 gap-3">
                    {["Zone 1", "Zone 2", "Zone 4", "Zone 7", "Zone 9", "Zone 12"].map(z => (
                      <div key={z} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                         <input type="checkbox" className="h-4 w-4 rounded border-slate-200 text-[#4F46E5] focus:ring-[#4F46E5]" />
                         <span className="text-xs font-bold text-slate-600">{z}</span>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="space-y-6 pt-4 border-t border-slate-100">
                 <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Contact Information</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">POC NAME</label>
                       <Input placeholder="Name" className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-bold" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">POC PHONE</label>
                       <Input placeholder="Phone number" className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-bold" />
                    </div>
                 </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                 <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                       <p className="text-[13px] font-bold text-slate-700">Mark as available immediately</p>
                       <p className="text-[11px] text-slate-400">Items will be visible to active volunteers in these zones.</p>
                    </div>
                    <Switch defaultChecked />
                 </div>
              </div>
           </div>

           <div className="p-8 border-t border-slate-50 bg-white/80 backdrop-blur-md flex gap-4">
              <Button onClick={() => setShowAddResource(false)} variant="ghost" className="flex-1 py-7 rounded-2xl text-slate-500 font-bold border border-slate-100">Cancel</Button>
              <Button onClick={() => setShowAddResource(false)} className="flex-1 py-7 rounded-2xl bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white font-bold shadow-xl shadow-indigo-100">Add Resource</Button>
           </div>
        </SheetContent>
      </Sheet>

      {/* LOG USAGE SLIDE-OVER */}
      <Sheet open={!!logUsageRes} onOpenChange={() => setLogUsageRes(null)}>
        <SheetContent className="sm:max-w-md p-0 flex flex-col bg-white border-l border-slate-100 font-['Plus_Jakarta_Sans'] overflow-hidden">
           <div className="p-8 border-b border-slate-50 bg-[#F8F7FF]/50 relative overflow-hidden">
              <History className="absolute -bottom-4 -right-4 w-32 h-32 text-indigo-500/5 rotate-12" />
              <div className="flex justify-between items-center mb-6 relative z-10">
                 <h2 className="text-2xl font-bold text-[#1A1A3D]">Log usage</h2>
                 <SheetClose className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 focus:outline-none ring-0 border border-slate-100">
                    <X className="w-4 h-4" />
                 </SheetClose>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-indigo-100 flex items-center gap-4 relative z-10 shadow-sm">
                 <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", logUsageRes?.color)}>
                    <Package className="w-5 h-5" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{logUsageRes?.category}</p>
                    <p className="text-base font-bold text-[#1A1A3D]">{logUsageRes?.name}</p>
                 </div>
              </div>
           </div>

           <div className="flex-1 p-8 space-y-6 overflow-y-auto">
              <div className="space-y-2">
                 <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ASSIGNED MISSION</label>
                 <select className="flex h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm font-bold shadow-sm outline-none">
                    <option>M-047: Hebbal Food Distribution</option>
                    <option>M-051: Yelahanka First Aid</option>
                    <option>Standalone usage (No mission)</option>
                 </select>
              </div>

              <div className="space-y-2">
                 <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">QUANTITY USED</label>
                 <div className="flex items-center gap-3">
                    <Input type="number" defaultValue={1} className="h-12 bg-slate-50/50 border-slate-200 rounded-xl font-bold text-lg text-center w-32" />
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{logUsageRes?.unit}</span>
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">VOLUNTEER COLLECTED</label>
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <Input placeholder="Search active volunteers..." className="pl-10 h-12 bg-slate-50/50 border-slate-200 rounded-xl font-bold" />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">INTERNAL NOTES</label>
                 <textarea className="w-full h-32 bg-slate-50/50 border border-slate-200 rounded-2xl p-4 text-sm font-medium resize-none placeholder:text-slate-300" placeholder="Reason for usage, item condition, etc." />
              </div>
           </div>

           <div className="p-8 border-t border-slate-50">
              <Button 
                onClick={() => {
                   setResources(prev => prev.map(r => r.id === logUsageRes.id ? {...r, quantity: Math.max(0, r.quantity - 1)} : r));
                   setLogUsageRes(null);
                }}
                className="w-full py-7 rounded-2xl bg-[#1E1B4B] text-white font-bold text-sm shadow-xl flex items-center justify-center gap-3"
              >
                Confirm Log & Update Inventory <ChevronRight className="w-4 h-4" />
              </Button>
           </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ResourceInventory;
