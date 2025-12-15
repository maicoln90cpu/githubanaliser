import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  FileText, 
  Copy, 
  Check, 
  ExternalLink,
  AlertTriangle,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";

interface ReadmeInstructionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSkip: () => void;
  onConfirm: () => void;
  promptContent: string;
}

const LOCAL_STORAGE_KEY = "readme-instruction-dismissed";

export const ReadmeInstructionModal = ({
  open,
  onOpenChange,
  onSkip,
  onConfirm,
  promptContent,
}: ReadmeInstructionModalProps) => {
  const [copied, setCopied] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptContent);
      setCopied(true);
      toast.success("Prompt copiado para a área de transferência!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Erro ao copiar. Selecione manualmente o texto.");
    }
  };

  const handleSkip = () => {
    if (dontShowAgain) {
      localStorage.setItem(LOCAL_STORAGE_KEY, "true");
    }
    onSkip();
  };

  const handleConfirm = () => {
    if (dontShowAgain) {
      localStorage.setItem(LOCAL_STORAGE_KEY, "true");
    }
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="w-6 h-6 text-primary" />
            Antes de Analisar: README Atualizado
          </DialogTitle>
          <DialogDescription>
            Um README atualizado melhora significativamente a qualidade da análise
          </DialogDescription>
        </DialogHeader>

        {/* Warning Banner */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-600 dark:text-amber-400">
              Por que isso é importante?
            </p>
            <p className="text-muted-foreground mt-1">
              O README é a principal fonte de contexto para nossa IA. Um arquivo desatualizado ou incompleto 
              resulta em análises superficiais que não refletem o estado real do seu projeto.
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4 py-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Siga estes passos:
          </h4>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shrink-0">
                1
              </div>
              <div>
                <p className="font-medium">Copie o prompt abaixo</p>
                <p className="text-sm text-muted-foreground">
                  Este prompt foi otimizado para gerar um README completo e estruturado
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shrink-0">
                2
              </div>
              <div>
                <p className="font-medium">Cole no Lovable, Vercel ou seu editor</p>
                <p className="text-sm text-muted-foreground">
                  Execute o prompt para atualizar automaticamente seu README.md
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shrink-0">
                3
              </div>
              <div>
                <p className="font-medium">Faça o deploy/push das alterações</p>
                <p className="text-sm text-muted-foreground">
                  Certifique-se que o README atualizado está no GitHub
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shrink-0">
                4
              </div>
              <div>
                <p className="font-medium">Volte aqui e inicie a análise</p>
                <p className="text-sm text-muted-foreground">
                  Agora você terá análises muito mais precisas e úteis!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Prompt Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Prompt para atualizar README:</label>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCopy}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar Prompt
                </>
              )}
            </Button>
          </div>
          <div className="relative">
            <pre className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap font-mono max-h-48 overflow-y-auto border">
              {promptContent}
            </pre>
          </div>
        </div>

        {/* Don't show again */}
        <div className="flex items-center gap-2 pt-2">
          <Checkbox 
            id="dont-show" 
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(!!checked)}
          />
          <label 
            htmlFor="dont-show" 
            className="text-sm text-muted-foreground cursor-pointer"
          >
            Não mostrar novamente
          </label>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
          <Button 
            variant="ghost" 
            onClick={handleSkip}
            className="sm:order-1"
          >
            Pular e Analisar
          </Button>
          <Button 
            onClick={handleConfirm}
            className="gap-2 sm:order-2"
          >
            Entendi, Vou Atualizar
            <ArrowRight className="w-4 h-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Utility to check if modal should be shown
export const shouldShowReadmeModal = (): boolean => {
  return localStorage.getItem(LOCAL_STORAGE_KEY) !== "true";
};

// Default prompt content (fallback if not loaded from DB)
export const DEFAULT_README_PROMPT = `Analise meu projeto e atualize completamente o arquivo README.md seguindo esta estrutura:

## Estrutura Obrigatória:

1. **Título e Descrição**
   - Nome do projeto
   - Descrição clara do que faz (2-3 frases)
   - Badges relevantes (status, tecnologias)

2. **Features Principais**
   - Liste as 5-8 funcionalidades mais importantes
   - Use emojis para melhor visualização

3. **Tecnologias Utilizadas**
   - Stack completo (frontend, backend, banco)
   - Versões principais

4. **Como Executar**
   - Pré-requisitos
   - Instalação passo a passo
   - Variáveis de ambiente necessárias

5. **Arquitetura**
   - Estrutura de pastas principal
   - Padrões utilizados

6. **Roadmap** (se houver)
   - Próximas features planejadas

Gere um README profissional e completo baseado no código atual do projeto.`;
