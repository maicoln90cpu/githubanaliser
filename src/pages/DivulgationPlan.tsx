import AnalysisPageLayout from "@/components/AnalysisPageLayout";
import { Megaphone } from "lucide-react";

const DivulgationPlan = () => {
  return (
    <AnalysisPageLayout
      type="divulgacao"
      title="Plano de Divulgação"
      icon={Megaphone}
      iconColor="text-purple-500"
      iconBgColor="bg-purple-500/10"
      prevRoute={{ path: "/analise-prd", label: "Análise PRD" }}
      nextRoute={{ path: "/plano-captacao", label: "Plano de Captação" }}
    />
  );
};

export default DivulgationPlan;
