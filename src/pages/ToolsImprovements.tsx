import AnalysisPageLayout from "@/components/AnalysisPageLayout";
import { Wrench } from "lucide-react";

const ToolsImprovements = () => {
  return (
    <AnalysisPageLayout
      type="ferramentas"
      title="Melhorias de Ferramentas"
      icon={Wrench}
      iconColor="text-orange-500"
      iconBgColor="bg-orange-500/10"
      prevRoute={{ path: "/melhorias-ui", label: "Melhorias UI" }}
      nextRoute={{ path: "/novas-features", label: "Novas Features" }}
    />
  );
};

export default ToolsImprovements;
