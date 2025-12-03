import AnalysisPageLayout from "@/components/AnalysisPageLayout";
import { Shield } from "lucide-react";

const SecurityImprovements = () => {
  return (
    <AnalysisPageLayout
      type="seguranca"
      title="Melhorias de Segurança"
      icon={Shield}
      iconColor="text-red-500"
      iconBgColor="bg-red-500/10"
      prevRoute={{ path: "/plano-captacao", label: "Plano de Captação" }}
      nextRoute={{ path: "/melhorias-ui", label: "Melhorias UI" }}
    />
  );
};

export default SecurityImprovements;
