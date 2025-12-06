import AnalysisPageLayout from "@/components/AnalysisPageLayout";
import { DollarSign } from "lucide-react";

const FundingPlan = () => {
  return (
    <AnalysisPageLayout
      type="captacao"
      title="Plano de Captação"
      icon={DollarSign}
      iconColor="text-green-500"
      iconBgColor="bg-green-500/10"
      prevRoute={{ path: "/plano-divulgacao", label: "Plano de Divulgação" }}
      nextRoute={{ path: "/melhorias-seguranca", label: "Melhorias de Segurança" }}
    />
  );
};

export default FundingPlan;
