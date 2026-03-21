import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/coordinator/Dashboard";
import NeedTerrainMapPage from "./pages/coordinator/NeedTerrainMapPage";
import AlertsFeed from "./pages/coordinator/AlertsFeed";
import Volunteers from "./pages/coordinator/Volunteers";
import FieldWorker from "./pages/fieldworker/FieldWorker";
import GeminiInsights from "./pages/coordinator/GeminiInsights";
import ImpactReports from "./pages/coordinator/ImpactReports";
import VolunteerDashboard from "./pages/volunteer/VolunteerDashboard";
import EmpathyEngine from "./pages/volunteer/EmpathyEngine";
import VolunteerImpact from "./pages/volunteer/VolunteerImpact";
import VolunteerProfile from "./pages/volunteer/VolunteerProfile";
import VolunteerMissions from "./pages/volunteer/VolunteerMissions";
import CoordinatorMissions from "./pages/coordinator/CoordinatorMissions";
import TrustFabric from "./pages/coordinator/TrustFabric";
import LivingConstitution from "./pages/coordinator/LivingConstitution";
import Forecast from "./pages/coordinator/Forecast";
import CommunityEcho from "./pages/coordinator/CommunityEcho";
import OrganisationSettings from "./pages/coordinator/OrganisationSettings";
import Integrations from "./pages/coordinator/Integrations";
import TeamSettings from "./pages/coordinator/TeamSettings";
import { DashboardLayout } from "./layouts/DashboardLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Coordinator dashboard */}
          <Route path="/dashboard" element={<DashboardLayout role="coordinator" />}>
            <Route index element={<Dashboard />} />
            <Route path="terrain" element={<NeedTerrainMapPage />} />
            <Route path="alerts" element={<AlertsFeed />} />
            <Route path="volunteers" element={<Volunteers />} />
            <Route path="missions" element={<CoordinatorMissions />} />
            <Route path="insights" element={<GeminiInsights />} />
            <Route path="impact" element={<ImpactReports />} />
            <Route path="trust" element={<TrustFabric />} />
            <Route path="constitution" element={<LivingConstitution />} />
            <Route path="forecast" element={<Forecast />} />
            <Route path="echo" element={<CommunityEcho />} />
            <Route path="organisation" element={<OrganisationSettings />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="team" element={<TeamSettings />} />
          </Route>

          {/* Volunteer dashboard */}
          <Route path="/volunteer" element={<DashboardLayout role="volunteer" />}>
            <Route index element={<VolunteerDashboard />} />
            <Route path="missions" element={<VolunteerMissions />} />
            <Route path="empathy" element={<EmpathyEngine />} />
            <Route path="impact" element={<VolunteerImpact />} />
            <Route path="profile" element={<VolunteerProfile />} />
          </Route>

          {/* Field worker (mobile-first, no sidebar) */}
          <Route path="/fieldworker" element={<FieldWorker />} />
          <Route path="/fieldworker/*" element={<FieldWorker />} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
