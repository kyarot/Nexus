import { DashboardTopBar } from "@/components/nexus/DashboardTopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Sparkles,
  BarChart3,
  TrendingUp,
  FileText,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Download,
  Vote,
  Brain,
  Network,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";

const IntelligenceHub = () => {
  const navigate = useNavigate();

  const navigationTabs = [
    { id: "trust", label: "Trust Fabric", icon: Shield, route: "/dashboard/trust" },
    { id: "insights", label: "Gemini Insights", icon: Sparkles, route: "/dashboard/insights" },
    { id: "reports", label: "Impact Reports", icon: BarChart3, route: "/dashboard/impact" },
    { id: "forecast", label: "Community Forecast", icon: TrendingUp, route: "/dashboard/forecast" },
    { id: "constitution", label: "Living Constitution", icon: FileText, route: "/dashboard/constitution" }
  ];

  return (
    <div className="flex flex-col h-full">
      <DashboardTopBar
        breadcrumb="Intelligence Hub"
        subtext="Executive overview · All intelligence streams · Updated 2 min ago"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header Navigation */}
        <div className="bg-card rounded-card border shadow-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Intelligence Overview</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time insights from all coordination systems
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-success font-medium">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                All systems operational
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {navigationTabs.map((tab) => (
              <Button
                key={tab.id}
                variant="outline"
                className="flex items-center gap-2 rounded-pill"
                onClick={() => navigate(tab.route)}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                <ArrowRight className="w-3 h-3" />
              </Button>
            ))}
          </div>
        </div>

        {/* Summary Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">

          {/* Trust Fabric Summary */}
          <div className="bg-card rounded-card border shadow-card p-6 relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Trust Fabric</h3>
                  <p className="text-xs text-muted-foreground">Network integrity</p>
                </div>
              </div>
              <Link to="/dashboard/trust" className="text-xs text-primary hover:underline font-medium">
                View Full →
              </Link>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Trust Score</span>
                <span className="text-2xl font-bold text-green-600">94.2</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-foreground">47 verified nodes</span>
                  <Badge variant="outline" className="text-[10px] px-2 py-0">Active</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-600">23 new verifications today</span>
                </div>
              </div>

              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full w-[94%] bg-green-500 rounded-full" />
              </div>
            </div>
          </div>

          {/* Gemini Insights Summary */}
          <div className="bg-card rounded-card border shadow-card p-6 relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Gemini Insights</h3>
                  <p className="text-xs text-muted-foreground">AI intelligence</p>
                </div>
              </div>
              <Link to="/dashboard/insights" className="text-xs text-primary hover:underline font-medium">
                View Full →
              </Link>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Alerts</span>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-[10px] px-2 py-0">3</Badge>
                  <Badge className="text-[10px] px-2 py-0 bg-warning/10 text-warning">7</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="text-xs text-foreground">Hebbal North — Critical pattern</span>
                </div>
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Processing 156 reports</span>
                </div>
              </div>

              <div className="bg-primary-light rounded-lg p-3">
                <p className="text-xs text-primary font-medium">
                  "3 converging signals detected in Zone 4"
                </p>
              </div>
            </div>
          </div>

          {/* Impact Reports Summary */}
          <div className="bg-card rounded-card border shadow-card p-6 relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Impact Reports</h3>
                  <p className="text-xs text-muted-foreground">Performance metrics</p>
                </div>
              </div>
              <Link to="/dashboard/impact" className="text-xs text-primary hover:underline font-medium">
                View Full →
              </Link>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-foreground">1,247</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Reports</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">89%</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Success</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-foreground">312 families helped this week</span>
              </div>

              <Button variant="outline" size="sm" className="w-full text-xs">
                <Download className="w-3 h-3 mr-2" />
                Download Weekly Report
              </Button>
            </div>
          </div>

          {/* Community Forecast Summary */}
          <div className="bg-card rounded-card border shadow-card p-6 relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Community Forecast</h3>
                  <p className="text-xs text-muted-foreground">Predictive analytics</p>
                </div>
              </div>
              <Link to="/dashboard/forecast" className="text-xs text-primary hover:underline font-medium">
                View Full →
              </Link>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Risk Level</span>
                <Badge className="text-[10px] px-2 py-0 bg-warning/10 text-warning">Elevated</Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-warning" />
                  <span className="text-xs text-foreground">Food security — trending up</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Next update: 6 hours</span>
                </div>
              </div>

              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-xs text-orange-700 font-medium">
                  Increased need forecasted in 2 zones by next week
                </p>
              </div>
            </div>
          </div>

          {/* Living Constitution Summary */}
          <div className="bg-card rounded-card border shadow-card p-6 relative overflow-hidden xl:col-span-2">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Living Constitution</h3>
                  <p className="text-xs text-muted-foreground">Governance & policies</p>
                </div>
              </div>
              <Link to="/dashboard/constitution" className="text-xs text-primary hover:underline font-medium">
                View Full →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Vote className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-foreground">Pending Votes</span>
                </div>
                <div className="text-xl font-bold text-primary">3</div>
                <p className="text-[10px] text-muted-foreground">Resource allocation amendments</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-medium text-foreground">Recent Changes</span>
                </div>
                <div className="text-xl font-bold text-green-600">2</div>
                <p className="text-[10px] text-muted-foreground">Emergency protocols updated</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">Active Policies</span>
                </div>
                <div className="text-xl font-bold text-foreground">47</div>
                <p className="text-[10px] text-muted-foreground">All systems compliant</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Footer */}
        <div className="bg-card rounded-card border shadow-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Quick Intelligence Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Generate Insight Report
            </Button>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Export Analytics
            </Button>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Run Forecast
            </Button>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Verify Trust Network
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntelligenceHub;