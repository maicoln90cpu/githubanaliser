import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Github, 
  Home, 
  Loader2, 
  Shield,
  FileText,
  Target,
  TrendingUp,
  ShieldAlert,
  Palette,
  Wrench,
  Lightbulb,
  BookOpen,
  Terminal,
  Activity,
  Gauge,
  Save,
  Eye,
  RotateCcw,
  History,
  MessageSquare,
  ListChecks,
  Search,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/useAdmin";
import { PromptEditor } from "@/components/PromptEditor";

interface AnalysisPrompt {
  id: string;
  analysis_type: string;
  name: string;
  description: string | null;
  system_prompt: string;
  user_prompt_template: string;
  variables_hint: string[];
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

// Prompt categories for organization
type PromptCategory = 'analysis' | 'chat' | 'implementation' | 'system';

const PROMPT_CATEGORIES: Record<PromptCategory, { label: string; icon: React.ReactNode; description: string }> = {
  analysis: { 
    label: 'Análises', 
    icon: <FileText className="w-4 h-4" />,
    description: 'Prompts para os 10 tipos de análise do sistema'
  },
  chat: { 
    label: 'Chat', 
    icon: <MessageSquare className="w-4 h-4" />,
    description: 'Prompts para o chat contextual Ask AI'
  },
  implementation: { 
    label: 'Implementação', 
    icon: <ListChecks className="w-4 h-4" />,
    description: 'Prompts para geração de planos de implementação'
  },
  system: { 
    label: 'Sistema', 
    icon: <Terminal className="w-4 h-4" />,
    description: 'Prompts de sistema e utilitários'
  },
};

// Active analysis types (current)
const ACTIVE_ANALYSIS_TYPES = [
  'prd', 'divulgacao', 'captacao', 'seguranca', 'ui_theme', 
  'features', 'documentacao', 'prompts', 'quality', 'performance'
];

// Deprecated types (still shown if exist in DB, but marked as legacy)
const DEPRECATED_ANALYSIS_TYPES = ['ferramentas'];

const ANALYSIS_ICONS: Record<string, React.ReactNode> = {
  prd: <FileText className="w-5 h-5" />,
  divulgacao: <Target className="w-5 h-5" />,
  captacao: <TrendingUp className="w-5 h-5" />,
  seguranca: <ShieldAlert className="w-5 h-5" />,
  ui_theme: <Palette className="w-5 h-5" />,
  ferramentas: <Wrench className="w-5 h-5" />,
  features: <Lightbulb className="w-5 h-5" />,
  documentacao: <BookOpen className="w-5 h-5" />,
  prompts: <Terminal className="w-5 h-5" />,
  quality: <Activity className="w-5 h-5" />,
  performance: <Gauge className="w-5 h-5" />,
  chat: <MessageSquare className="w-5 h-5" />,
  implementation: <ListChecks className="w-5 h-5" />,
};

const ANALYSIS_COLORS: Record<string, string> = {
  prd: "text-blue-500 bg-blue-500/10",
  divulgacao: "text-purple-500 bg-purple-500/10",
  captacao: "text-green-500 bg-green-500/10",
  seguranca: "text-red-500 bg-red-500/10",
  ui_theme: "text-pink-500 bg-pink-500/10",
  ferramentas: "text-orange-500 bg-orange-500/10",
  features: "text-yellow-500 bg-yellow-500/10",
  documentacao: "text-cyan-500 bg-cyan-500/10",
  prompts: "text-violet-500 bg-violet-500/10",
  quality: "text-emerald-500 bg-emerald-500/10",
  performance: "text-teal-500 bg-teal-500/10",
  chat: "text-indigo-500 bg-indigo-500/10",
  implementation: "text-amber-500 bg-amber-500/10",
};

// Get category for a prompt type
const getPromptCategory = (type: string): PromptCategory => {
  if (ACTIVE_ANALYSIS_TYPES.includes(type) || DEPRECATED_ANALYSIS_TYPES.includes(type)) {
    return 'analysis';
  }
  if (type === 'chat' || type === 'project_chat') {
    return 'chat';
  }
  if (type === 'implementation' || type === 'implementation_plan') {
    return 'implementation';
  }
  return 'system';
};

const AdminPrompts = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [prompts, setPrompts] = useState<AnalysisPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AnalysisPrompt | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState<AnalysisPrompt | null>(null);
  const [activeCategory, setActiveCategory] = useState<PromptCategory>('analysis');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (adminLoading) return;

    if (!isAdmin) {
      toast.error("Acesso negado. Área restrita para administradores.");
      navigate("/dashboard");
      return;
    }

    loadPrompts();
  }, [isAdmin, adminLoading, navigate]);

  const loadPrompts = async () => {
    try {
      const { data, error } = await supabase
        .from("analysis_prompts")
        .select("*")
        .order("analysis_type");

      if (error) throw error;
      
      setPrompts(data?.map(p => ({
        ...p,
        variables_hint: Array.isArray(p.variables_hint) 
          ? (p.variables_hint as unknown as string[]) 
          : []
      })) || []);
    } catch (error) {
      console.error("Erro ao carregar prompts:", error);
      toast.error("Erro ao carregar prompts");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingPrompt) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("analysis_prompts")
        .update({
          name: editingPrompt.name,
          description: editingPrompt.description,
          system_prompt: editingPrompt.system_prompt,
          user_prompt_template: editingPrompt.user_prompt_template,
          is_active: editingPrompt.is_active,
        })
        .eq("id", editingPrompt.id);

      if (error) throw error;

      toast.success("Prompt salvo com sucesso!");
      setEditingPrompt(null);
      loadPrompts();
    } catch (error) {
      console.error("Erro ao salvar prompt:", error);
      toast.error("Erro ao salvar prompt");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (promptId: string) => {
    // In a real implementation, this would restore from a backup table
    toast.info("Função de reset será implementada em breve");
  };

  // Filter prompts by category and search
  const filteredPrompts = prompts
    .filter(p => getPromptCategory(p.analysis_type) === activeCategory)
    .filter(p => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(query) ||
        p.analysis_type.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const aDeprecated = DEPRECATED_ANALYSIS_TYPES.includes(a.analysis_type);
      const bDeprecated = DEPRECATED_ANALYSIS_TYPES.includes(b.analysis_type);
      if (aDeprecated && !bDeprecated) return 1;
      if (!aDeprecated && bDeprecated) return -1;
      return 0;
    });

  // Stats for each category
  const categoryStats = {
    analysis: prompts.filter(p => getPromptCategory(p.analysis_type) === 'analysis').length,
    chat: prompts.filter(p => getPromptCategory(p.analysis_type) === 'chat').length,
    implementation: prompts.filter(p => getPromptCategory(p.analysis_type) === 'implementation').length,
    system: prompts.filter(p => getPromptCategory(p.analysis_type) === 'system').length,
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <Github className="w-6 h-6 text-foreground" />
            <span className="font-semibold text-xl">GitAnalyzer</span>
            <span className="px-2 py-0.5 text-xs bg-red-500/10 text-red-500 rounded-full font-medium">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
              <Shield className="w-4 h-4 mr-2" />
              Admin
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Gerenciador de Prompts</h1>
          </div>
          <p className="text-muted-foreground">
            Configure os prompts utilizados pela IA para cada funcionalidade
          </p>
        </div>

        {/* Info Card */}
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <Lightbulb className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Como funciona?</h3>
                <p className="text-sm text-muted-foreground">
                  Cada funcionalidade usa dois prompts: um <strong>System Prompt</strong> (define o comportamento da IA) 
                  e um <strong>User Prompt Template</strong> (contém o contexto). 
                  Clique nas variáveis para inserir no cursor. Use o modo fullscreen para edição confortável.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar prompts por nome ou tipo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as PromptCategory)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-auto p-1">
            {(Object.entries(PROMPT_CATEGORIES) as [PromptCategory, typeof PROMPT_CATEGORIES[PromptCategory]][]).map(([key, cat]) => (
              <TabsTrigger 
                key={key} 
                value={key}
                className="flex items-center gap-2 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {cat.icon}
                <span className="hidden sm:inline">{cat.label}</span>
                <Badge variant="secondary" className="ml-1 text-xs">
                  {categoryStats[key]}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Category Description */}
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Filter className="w-4 h-4" />
            {PROMPT_CATEGORIES[activeCategory].description}
          </div>

          {/* Prompts Grid */}
          <TabsContent value={activeCategory} className="mt-0">
            {filteredPrompts.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? 'Nenhum prompt encontrado para esta busca' 
                    : 'Nenhum prompt cadastrado nesta categoria'}
                </p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredPrompts.map((prompt) => {
                  const isDeprecated = DEPRECATED_ANALYSIS_TYPES.includes(prompt.analysis_type);
                  return (
                    <Card 
                      key={prompt.id} 
                      className={`transition-all hover:shadow-md ${!prompt.is_active ? 'opacity-60' : ''} ${isDeprecated ? 'border-orange-500/30 bg-orange-500/5' : ''}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ANALYSIS_COLORS[prompt.analysis_type] || 'bg-muted'}`}>
                              {ANALYSIS_ICONS[prompt.analysis_type] || <FileText className="w-5 h-5" />}
                            </div>
                            <div>
                              <CardTitle className="text-lg flex items-center gap-2">
                                {prompt.name}
                                {isDeprecated && (
                                  <Badge variant="outline" className="text-xs text-orange-500 border-orange-500/50">
                                    Legado
                                  </Badge>
                                )}
                                {!prompt.is_active && (
                                  <Badge variant="secondary" className="text-xs">Desativado</Badge>
                                )}
                              </CardTitle>
                              <CardDescription>{prompt.description}</CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              <History className="w-3 h-3 mr-1" />
                              v{prompt.version}
                            </Badge>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setPreviewPrompt(prompt);
                                setPreviewOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Preview
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setEditingPrompt({...prompt})}
                            >
                              Editar
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">System Prompt</Label>
                            <p className="text-sm text-muted-foreground truncate">
                              {prompt.system_prompt.substring(0, 100)}...
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {prompt.system_prompt.length.toLocaleString()} chars
                            </span>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Variáveis</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {prompt.variables_hint.map((v, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {`{{${v}}}`}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={!!editingPrompt} onOpenChange={(open) => !open && setEditingPrompt(null)}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingPrompt && ANALYSIS_ICONS[editingPrompt.analysis_type]}
                Editar Prompt: {editingPrompt?.name}
              </DialogTitle>
              <DialogDescription>
                Modifique os prompts usados pela IA. Alterações entram em vigor imediatamente.
                Use o botão de expandir para editar em tela cheia.
              </DialogDescription>
            </DialogHeader>

            {editingPrompt && (
              <div className="space-y-6 py-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={editingPrompt.name}
                      onChange={(e) => setEditingPrompt({...editingPrompt, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      value={editingPrompt.description || ""}
                      onChange={(e) => setEditingPrompt({...editingPrompt, description: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingPrompt.is_active}
                    onCheckedChange={(checked) => setEditingPrompt({...editingPrompt, is_active: checked})}
                  />
                  <Label>Prompt ativo</Label>
                </div>

                <PromptEditor
                  label="System Prompt"
                  description="Define o comportamento e personalidade da IA. Seja específico sobre o estilo de resposta esperado."
                  value={editingPrompt.system_prompt}
                  onChange={(value) => setEditingPrompt({...editingPrompt, system_prompt: value})}
                  minRows={6}
                  maxRows={15}
                />

                <PromptEditor
                  label="User Prompt Template"
                  description="Template com contexto do projeto. Clique nas variáveis abaixo para inserir."
                  value={editingPrompt.user_prompt_template}
                  onChange={(value) => setEditingPrompt({...editingPrompt, user_prompt_template: value})}
                  variables={editingPrompt.variables_hint}
                  minRows={12}
                  maxRows={30}
                />

                <div className="flex justify-between pt-4 border-t">
                  <Button
                    variant="ghost"
                    onClick={() => handleReset(editingPrompt.id)}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restaurar Padrão
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setEditingPrompt(null)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {previewPrompt && ANALYSIS_ICONS[previewPrompt.analysis_type]}
                Preview: {previewPrompt?.name}
              </DialogTitle>
              <DialogDescription>
                Visualização de como o prompt será enviado para a IA
              </DialogDescription>
            </DialogHeader>

            {previewPrompt && (
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-primary font-medium">System Prompt</Label>
                    <span className="text-xs text-muted-foreground">
                      {previewPrompt.system_prompt.length.toLocaleString()} chars / ~{Math.ceil(previewPrompt.system_prompt.length / 4).toLocaleString()} tokens
                    </span>
                  </div>
                  <div className="p-4 bg-muted rounded-lg max-h-[30vh] overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {previewPrompt.system_prompt}
                    </pre>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-primary font-medium">User Prompt Template</Label>
                    <span className="text-xs text-muted-foreground">
                      {previewPrompt.user_prompt_template.length.toLocaleString()} chars / ~{Math.ceil(previewPrompt.user_prompt_template.length / 4).toLocaleString()} tokens
                    </span>
                  </div>
                  <div className="p-4 bg-muted rounded-lg max-h-[40vh] overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {previewPrompt.user_prompt_template}
                    </pre>
                  </div>
                </div>

                {previewPrompt.variables_hint.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Variáveis utilizadas</Label>
                    <div className="flex flex-wrap gap-2">
                      {previewPrompt.variables_hint.map((v, i) => (
                        <Badge key={i} variant="secondary">
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminPrompts;
