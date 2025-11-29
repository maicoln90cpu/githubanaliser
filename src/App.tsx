import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Analyzing from "./pages/Analyzing";
import AnalysisPRD from "./pages/AnalysisPRD";
import FundingPlan from "./pages/FundingPlan";
import Improvements from "./pages/Improvements";
import History from "./pages/History";
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
          <Route path="/analisando" element={<Analyzing />} />
          <Route path="/analise-prd/:id" element={<AnalysisPRD />} />
          <Route path="/plano-captacao/:id" element={<FundingPlan />} />
          <Route path="/melhorias-features/:id" element={<Improvements />} />
          <Route path="/historico" element={<History />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
