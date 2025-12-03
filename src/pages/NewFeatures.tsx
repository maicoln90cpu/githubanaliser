import AnalysisPageLayout from "@/components/AnalysisPageLayout";
import { Sparkles } from "lucide-react";

const NewFeatures = () => {
  return (
    <AnalysisPageLayout
      type="features"
      title="Novas Features"
      icon={Sparkles}
      iconColor="text-yellow-500"
      iconBgColor="bg-yellow-500/10"
      prevRoute={{ path: "/melhorias-ferramentas", label: "Ferramentas" }}
    />
  );
};

export default NewFeatures;
