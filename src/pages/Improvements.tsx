import AnalysisPageLayout from "@/components/AnalysisPageLayout";
import { Lightbulb } from "lucide-react";

const Improvements = () => {
  return (
    <AnalysisPageLayout
      type="melhorias"
      title="Melhorias & Features"
      icon={Lightbulb}
      iconColor="text-yellow-500"
      iconBgColor="bg-yellow-500/10"
      prevRoute={{ path: "/melhorias-seguranca", label: "Melhorias de Segurança" }}
    />
  );
};

export default Improvements;
