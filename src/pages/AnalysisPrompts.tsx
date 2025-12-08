import AnalysisPageLayout from "@/components/AnalysisPageLayout";
import { Terminal } from "lucide-react";

const AnalysisPrompts = () => {
  return (
    <AnalysisPageLayout
      type="prompts"
      title="Prompts Otimizados"
      icon={Terminal}
      iconColor="text-violet-500"
      iconBgColor="bg-violet-500/10"
      prevRoute={{ path: "/documentacao-tecnica", label: "Documentação Técnica" }}
    />
  );
};

export default AnalysisPrompts;
