import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { StatMetricCard } from "@/components/coordinator/StatMetricCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { FileText, Download, Send, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  downloadImpactGrantReport,
  downloadImpactPolicyBrief,
  getImpactReportSummary,
  sendImpactPolicyBrief,
} from "@/lib/coordinator-api";
import { useToast } from "@/hooks/use-toast";

const formatNumber = (value: number) => value.toLocaleString();

const parseDate = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatShortDate = (value?: string | null) => {
  const parsed = parseDate(value);
  if (!parsed) {
    return "--";
  }
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function ImpactReports() {
  const [period, setPeriod] = useState("3m");
  const token = localStorage.getItem("nexus_access_token");
  const { toast } = useToast();
  const [exportState, setExportState] = useState({ grant: false, brief: false, send: false });

  const reportQuery = useQuery({
    queryKey: ["coordinator-impact-reports", token, period],
    enabled: Boolean(token),
    refetchInterval: 20_000,
    queryFn: () => getImpactReportSummary(period),
  });

  const report = reportQuery.data;
  const summary = report?.summary;
  const metrics = report?.metrics;
  const ledgerRows = report?.ledger ?? [];
  const chartData = report?.chart?.series ?? [];
  const policyBriefItems = report?.policyBrief?.items ?? [];
  const policyBadge = report?.policyBrief?.generatedAt
    ? `${formatShortDate(report?.policyBrief?.generatedAt)} · Auto-generated`
    : "Auto-generated";
  const orgName = report?.organization?.name || "Your NGO";
  const reportCount = summary?.reports ?? 0;
  const ngoCount = summary?.ngos ?? 0;
  const lastGenerated = report?.policyBrief?.generatedAt
    ? formatShortDate(report?.policyBrief?.generatedAt)
    : "Not generated";
  const missionsCount = summary?.missions ?? 0;
  const completedMissionsCount = summary?.completedMissions ?? 0;
  const missionSuccessRate = metrics?.missionSuccessRate ?? 0;
  const familiesReached = metrics?.familiesReached ?? 0;
  const avgNeedReduction = metrics?.avgNeedReduction ?? 0;
  const chartZoneName = report?.chart?.zoneName || "Zone";

  const costPerIntervention = null;
  const exportDisabled = !reportQuery.data;

  const downloadJson = (payload: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const buildFilename = (prefix: string) => {
    const stamp = new Date().toISOString().slice(0, 10);
    return `${prefix}-${period}-${stamp}.json`;
  };

  const handleDownloadGrant = async () => {
    if (exportDisabled || exportState.grant) {
      return;
    }
    setExportState((prev) => ({ ...prev, grant: true }));
    try {
      const payload = await downloadImpactGrantReport(period);
      downloadJson(payload, buildFilename("grant-report"));
      toast({ title: "Grant report ready", description: "Report exported as JSON." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to export grant report.";
      toast({ title: "Export failed", description: message, variant: "destructive" });
    } finally {
      setExportState((prev) => ({ ...prev, grant: false }));
    }
  };

  const handleDownloadBrief = async () => {
    if (exportDisabled || exportState.brief) {
      return;
    }
    setExportState((prev) => ({ ...prev, brief: true }));
    try {
      const payload = await downloadImpactPolicyBrief(period);
      downloadJson(payload, buildFilename("policy-brief"));
      toast({ title: "Policy brief ready", description: "Brief exported as JSON." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to export policy brief.";
      toast({ title: "Export failed", description: message, variant: "destructive" });
    } finally {
      setExportState((prev) => ({ ...prev, brief: false }));
    }
  };

  const handleSendBrief = async () => {
    if (exportDisabled || exportState.send) {
      return;
    }
    setExportState((prev) => ({ ...prev, send: true }));
    try {
      await sendImpactPolicyBrief(period, { recipient: "district_collector" });
      toast({ title: "Policy brief queued", description: "Sent to the district collector queue." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send policy brief.";
      toast({ title: "Send failed", description: message, variant: "destructive" });
    } finally {
      setExportState((prev) => ({ ...prev, send: false }));
    }
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardTopBar breadcrumb="Impact Reports" />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">Impact Reports</h1>
            <Button variant="gradient" size="sm" disabled={exportDisabled || exportState.grant} onClick={handleDownloadGrant}>
              <FileText className="h-4 w-4 mr-1" />Generate Grant Report →
            </Button>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-card-gap">
            <StatMetricCard
              label="Missions Completed"
              value={reportQuery.isLoading ? "--" : `${completedMissionsCount}`}
              accent="green"
              delta={missionsCount ? `${missionSuccessRate}% success` : "Awaiting missions"}
            />
            <StatMetricCard
              label="Families Reached"
              value={reportQuery.isLoading ? "--" : formatNumber(familiesReached)}
              accent="indigo"
              delta={completedMissionsCount ? `From ${completedMissionsCount} verified missions` : "Awaiting verified missions"}
            />
            <StatMetricCard
              label="Avg Need Score Reduction"
              value={reportQuery.isLoading ? "--" : `-${avgNeedReduction}%`}
              accent="green"
              deltaDirection="down"
              delta={ledgerRows.length ? "Improving" : "Not enough history"}
            />
            <StatMetricCard
              label="Cost per Intervention"
              value={costPerIntervention ? `₹${Math.round(costPerIntervention)}` : "--"}
              accent="amber"
              delta={costPerIntervention ? "Tracked" : "Cost data missing"}
            />
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
                {ledgerRows.map((row) => {
                  const change = row.change;
                  const missionId = typeof row.mission === "string" ? row.mission : "------";
                  return (
                    <TableRow key={missionId}>
                      <TableCell className="font-data text-xs">{missionId.slice(0, 6)}</TableCell>
                      <TableCell className="text-sm">{row.zone}</TableCell>
                      <TableCell>
                        <Badge variant={row.type === "Food" ? "destructive" : row.type === "Health" ? "secondary" : "success"} className="text-[10px]">
                          {row.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-data">{row.before}</TableCell>
                      <TableCell className="font-data">{row.after}</TableCell>
                      <TableCell className={cn("font-data font-semibold", change < 0 ? "text-success" : "text-destructive")}>
                        {change > 0 ? "+" : ""}{change}
                      </TableCell>
                      <TableCell className="text-sm">{row.volunteer}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.date}</TableCell>
                    </TableRow>
                  );
                })}
                {!ledgerRows.length ? (
                  <TableRow>
                    <TableCell className="text-sm text-muted-foreground" colSpan={8}>No verified mission outcomes yet.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          {/* Chart */}
          <div className="rounded-card border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Need Score Over Time — {chartZoneName}</h3>
              <div className="flex gap-1">
                {["1m", "3m", "6m", "1y"].map(p => (
                  <button key={p} onClick={() => setPeriod(p)} className={cn("rounded-pill px-2.5 py-1 text-[11px] font-medium", period === p ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}>{p}</button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(220 9% 64%)" />
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
              <Badge variant="success">{policyBadge}</Badge>
            </div>
            <div className="rounded-lg border bg-background p-4 text-sm text-foreground leading-relaxed space-y-2">
              <p className="font-semibold">Monthly Community Intelligence Brief</p>
              {policyBriefItems.length ? (
                policyBriefItems.map((item, index) => (
                  <p key={`${item}-${index}`}>{index + 1}. {item}</p>
                ))
              ) : (
                <p className="text-muted-foreground">No insight brief generated yet.</p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={!policyBriefItems.length || exportState.brief}
                onClick={handleDownloadBrief}
              >
                <Download className="h-4 w-4 mr-1" />Download Brief
              </Button>
              <Button
                size="sm"
                variant="gradient"
                disabled={!policyBriefItems.length || exportState.send}
                onClick={handleSendBrief}
              >
                <Send className="h-4 w-4 mr-1" />Send to District Collector
              </Button>
            </div>
          </div>

          {/* Grant Report Generator */}
          <div className="rounded-card border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">Generate Grant Report</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="text-xs text-muted-foreground">Organization</label><p className="text-sm font-medium text-foreground">{orgName}</p></div>
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
            <Button variant="gradient" disabled={exportDisabled || exportState.grant} onClick={handleDownloadGrant}>Generate Grant Report</Button>
          </div>
        </div>

        {/* Right mini panel */}
        <div className="hidden xl:block w-[260px] shrink-0 border-l bg-card overflow-y-auto p-5 space-y-4">
          <h4 className="text-sm font-semibold text-foreground">Report Summary</h4>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Missions</span><span className="font-data font-semibold">{missionsCount}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Zones Covered</span><span className="font-data font-semibold">{summary?.zones ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">NGOs Involved</span><span className="font-data font-semibold">{ngoCount || 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Reports Generated</span><span className="font-data font-semibold">{reportCount}</span></div>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground mb-1">Last generated</p>
            <div className="h-20 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">PDF Preview</div>
            <p className="text-[11px] text-muted-foreground mt-1">{lastGenerated} Grant Report</p>
          </div>
        </div>
      </div>
    </div>
  );
}
