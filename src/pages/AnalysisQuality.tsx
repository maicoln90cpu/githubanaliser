import AnalysisPageLayout from "@/components/AnalysisPageLayout";
import { Activity } from "lucide-react";

const AnalysisQuality = () => {
  return (
    <AnalysisPageLayout
      type="quality"
      title="Qualidade & Ferramentas"
      icon={Activity}
      iconColor="text-emerald-500"
      iconBgColor="bg-emerald-500/10"
      prevRoute={{ path: "/prompts-otimizados", label: "Prompts Otimizados" }}
      nextRoute={{ path: "/performance", label: "Performance & Observabilidade" }}
      legacyTypes={["ferramentas"]}
    />
  );
};

export default AnalysisQuality;
