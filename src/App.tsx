import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Analyzing from "./pages/Analyzing";
import ProjectHub from "./pages/ProjectHub";
import AnalysisPRD from "./pages/AnalysisPRD";
import DivulgationPlan from "./pages/DivulgationPlan";
import FundingPlan from "./pages/FundingPlan";
import SecurityImprovements from "./pages/SecurityImprovements";
import UIImprovements from "./pages/UIImprovements";
import ToolsImprovements from "./pages/ToolsImprovements";
import NewFeatures from "./pages/NewFeatures";
import TechnicalDocumentation from "./pages/TechnicalDocumentation";
import AnalysisPrompts from "./pages/AnalysisPrompts";
import AnalysisQuality from "./pages/AnalysisQuality";
import ProjectOverview from "./pages/ProjectOverview";
import ProjectChat from "./pages/ProjectChat";
import Improvements from "./pages/Improvements";
import History from "./pages/History";
import AnalysisComparison from "./pages/AnalysisComparison";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCanceled from "./pages/PaymentCanceled";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminProjects from "./pages/admin/AdminProjects";
import AdminCosts from "./pages/admin/AdminCosts";
import AdminPlans from "./pages/admin/AdminPlans";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminPrompts from "./pages/admin/AdminPrompts";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analisando" element={<Analyzing />} />
          <Route path="/projeto/:id" element={<ProjectHub />} />
          <Route path="/analise-prd/:id" element={<AnalysisPRD />} />
          <Route path="/plano-divulgacao/:id" element={<DivulgationPlan />} />
          <Route path="/plano-captacao/:id" element={<FundingPlan />} />
          <Route path="/melhorias-seguranca/:id" element={<SecurityImprovements />} />
          <Route path="/melhorias-ui/:id" element={<UIImprovements />} />
          <Route path="/melhorias-ferramentas/:id" element={<ToolsImprovements />} />
          <Route path="/novas-features/:id" element={<NewFeatures />} />
          <Route path="/documentacao-tecnica/:id" element={<TechnicalDocumentation />} />
          <Route path="/prompts-otimizados/:id" element={<AnalysisPrompts />} />
          <Route path="/qualidade-codigo/:id" element={<AnalysisQuality />} />
          <Route path="/projeto/:id/overview" element={<ProjectOverview />} />
          <Route path="/projeto/:id/chat" element={<ProjectChat />} />
          <Route path="/melhorias-features/:id" element={<Improvements />} />
          <Route path="/historico" element={<History />} />
          <Route path="/comparar/:id" element={<AnalysisComparison />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-canceled" element={<PaymentCanceled />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/usuarios" element={<AdminUsers />} />
          <Route path="/admin/projetos" element={<AdminProjects />} />
          <Route path="/admin/custos" element={<AdminCosts />} />
          <Route path="/admin/planos" element={<AdminPlans />} />
          <Route path="/admin/configuracoes" element={<AdminSettings />} />
          <Route path="/admin/prompts" element={<AdminPrompts />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
