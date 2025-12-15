import AnalysisPageLayout from "@/components/AnalysisPageLayout";
import { Gauge } from "lucide-react";

const AnalysisPerformance = () => {
  return (
    <AnalysisPageLayout
      type="performance"
      title="Performance & Observabilidade"
      icon={Gauge}
      iconColor="text-amber-500"
      iconBgColor="bg-amber-500/10"
      prevRoute={{ path: "/qualidade-codigo", label: "Qualidade & Ferramentas" }}
    />
  );
};

export default AnalysisPerformance;
