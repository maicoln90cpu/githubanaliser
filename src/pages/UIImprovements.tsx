import AnalysisPageLayout from "@/components/AnalysisPageLayout";
import { Palette } from "lucide-react";

const UIImprovements = () => {
  return (
    <AnalysisPageLayout
      type="ui_theme"
      title="Melhorias UI/Theme"
      icon={Palette}
      iconColor="text-pink-500"
      iconBgColor="bg-pink-500/10"
      prevRoute={{ path: "/melhorias-seguranca", label: "Segurança" }}
      nextRoute={{ path: "/melhorias-ferramentas", label: "Ferramentas" }}
    />
  );
};

export default UIImprovements;
