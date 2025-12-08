import AnalysisPageLayout from "@/components/AnalysisPageLayout";
import { BookOpen } from "lucide-react";

const TechnicalDocumentation = () => {
  return (
    <AnalysisPageLayout
      type="documentacao"
      title="Documentação Técnica"
      icon={BookOpen}
      iconColor="text-cyan-500"
      iconBgColor="bg-cyan-500/10"
      prevRoute={{ path: "/novas-features", label: "Novas Features" }}
      nextRoute={{ path: "/prompts-otimizados", label: "Prompts Otimizados" }}
    />
  );
};

export default TechnicalDocumentation;
