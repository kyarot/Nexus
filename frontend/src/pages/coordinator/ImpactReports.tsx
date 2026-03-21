import { useState } from "react";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { StatMetricCard } from "@/components/coordinator/StatMetricCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { FileText, Download, Send, Info, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const chartData = [
  { month: "Oct", score: 78 }, { month: "Nov", score: 72 }, { month: "Dec", score: 68 },
  { month: "Jan", score: 62 }, { month: "Feb", score: 55 }, { month: "Mar", score: 48 },
];

const ledgerData = [
  { mission: "M-247", zone: "Hebbal North", type: "Food", before: 89, after: 52, volunteer: "Priya R.", date: "Mar 18" },
  { mission: "M-243", zone: "Yelahanka", type: "Health", before: 72, after: 58, volunteer: "Arjun M.", date: "Mar 16" },
  { mission: "M-239", zone: "Jalahalli", type: "Education", before: 58, after: 61, volunteer: "Deepa S.", date: "Mar 14" },
  { mission: "M-235", zone: "Malleswaram", type: "Shelter", before: 45, after: 30, volunteer: "Karthik B.", date: "Mar 12" },
];

export default function ImpactReports() {
  const [period, setPeriod] = useState("3m");

  return (
    <div className="flex flex-col h-full">
      <DashboardTopBar breadcrumb="Impact Reports" />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">Impact Reports</h1>
            <Button variant="gradient" size="sm"><FileText className="h-4 w-4 mr-1" />Generate Grant Report →</Button>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-card-gap">
            <StatMetricCard label="Missions Completed" value="312" accent="green" delta="89% success" />
            <StatMetricCard label="Families Reached" value="2,847" accent="indigo" delta="+234 this month" />
            <StatMetricCard label="Avg Need Score Reduction" value="-34%" accent="green" deltaDirection="down" delta="Improving" />
            <StatMetricCard label="Cost per Intervention" value="₹847" accent="amber" delta="12% below target" />
          </div>

          {/* Trust Fabric */}
          <div className="rounded-card border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-semibold text-foreground">Verified Impact Ledger</h3>
              <button className="text-muted-foreground hover:text-foreground"><Info className="h-3.5 w-3.5" /></button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mission</TableHead><TableHead>Zone</TableHead><TableHead>Type</TableHead>
                  <TableHead>Before</TableHead><TableHead>After</TableHead><TableHead>Change</TableHead>
                  <TableHead>Volunteer</TableHead><TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerData.map(r => {
                  const change = r.after - r.before;
                  return (
                    <TableRow key={r.mission}>
                      <TableCell className="font-data text-xs">{r.mission}</TableCell>
                      <TableCell className="text-sm">{r.zone}</TableCell>
                      <TableCell><Badge variant={r.type === "Food" ? "destructive" : r.type === "Health" ? "secondary" : "success"} className="text-[10px]">{r.type}</Badge></TableCell>
                      <TableCell className="font-data">{r.before}</TableCell>
                      <TableCell className="font-data">{r.after}</TableCell>
                      <TableCell className={cn("font-data font-semibold", change < 0 ? "text-success" : "text-destructive")}>{change > 0 ? "+" : ""}{change}</TableCell>
                      <TableCell className="text-sm">{r.volunteer}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.date}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Chart */}
          <div className="rounded-card border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Need Score Over Time — Hebbal North</h3>
              <div className="flex gap-1">
                {["1m", "3m", "6m", "1y"].map(p => (
                  <button key={p} onClick={() => setPeriod(p)} className={cn("rounded-pill px-2.5 py-1 text-[11px] font-medium", period === p ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}>{p}</button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(220 9% 64%)" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(220 9% 64%)" />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="hsl(243 76% 59%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Living Constitution */}
          <div className="rounded-card border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Auto-Generated Policy Brief</h3>
                <button className="text-xs text-primary hover:underline mt-0.5">How it works →</button>
              </div>
              <Badge variant="success">March 2026 · Acknowledged by DC Office</Badge>
            </div>
            <div className="rounded-lg border bg-background p-4 text-sm text-foreground leading-relaxed space-y-2">
              <p className="font-semibold">Monthly Community Intelligence Brief — March 2026</p>
              <p>1. Food security remains the top need across 4 zones, affecting ~800 families.</p>
              <p>2. Health indicators rising in Yelahanka East — clinic walk-ins up 23%.</p>
              <p>3. Education attendance dropping in Hebbal North — linked to food insecurity.</p>
              <p className="text-muted-foreground">... 7 more items</p>
            </div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="ghost"><Download className="h-4 w-4 mr-1" />Download PDF</Button>
              <Button size="sm" variant="gradient"><Send className="h-4 w-4 mr-1" />Send to District Collector</Button>
            </div>
          </div>

          {/* Grant Report Generator */}
          <div className="rounded-card border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">Generate Grant Report</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="text-xs text-muted-foreground">Organization</label><p className="text-sm font-medium text-foreground">Bengaluru Community NGO</p></div>
              <div>
                <label className="text-xs text-muted-foreground">Period</label>
                <select className="mt-1 flex h-9 w-full rounded-button border border-input bg-background px-3 py-1 text-sm">
                  <option>Last 3 months</option><option>Last 6 months</option><option>Last year</option>
                </select>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              {["Include zone maps", "Include volunteer data", "Include cost analysis"].map(c => (
                <label key={c} className="flex items-center gap-2 text-sm text-foreground"><Checkbox defaultChecked />{c}</label>
              ))}
            </div>
            <Button variant="gradient">Generate PDF Report</Button>
          </div>
        </div>

        {/* Right mini panel */}
        <div className="hidden xl:block w-[260px] shrink-0 border-l bg-card overflow-y-auto p-5 space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Report Summary</h4>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Missions</span><span className="font-data font-semibold">312</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Zones Covered</span><span className="font-data font-semibold">24</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">NGOs Involved</span><span className="font-data font-semibold">12</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Reports Generated</span><span className="font-data font-semibold">8</span></div>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground mb-1">Last generated</p>
            <div className="h-20 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">PDF Preview</div>
            <p className="text-[11px] text-muted-foreground mt-1">Feb 2026 Grant Report</p>
          </div>
        </div>
      </div>
    </div>
  );
}
