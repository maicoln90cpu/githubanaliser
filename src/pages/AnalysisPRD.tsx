import AnalysisPageLayout from "@/components/AnalysisPageLayout";
import { FileText } from "lucide-react";

const AnalysisPRD = () => {
  return (
    <AnalysisPageLayout
      type="prd"
      title="Análise PRD"
      icon={FileText}
      iconColor="text-blue-500"
      iconBgColor="bg-blue-500/10"
      nextRoute={{ path: "/plano-divulgacao", label: "Plano de Divulgação" }}
    />
  );
};

export default AnalysisPRD;
