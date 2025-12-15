import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface AIResponse {
  content: string;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: 'lovable' | 'openai';
}

// Models by mode
const MODELS = {
  detailed: "google/gemini-2.5-flash",
  economic: "google/gemini-2.5-flash-lite"
};

// OpenAI models and costs
const OPENAI_MODELS: Record<string, { apiName: string; inputCostPerToken: number; outputCostPerToken: number }> = {
  'gpt-5': { apiName: 'gpt-5-2025-08-07', inputCostPerToken: 0.00000125, outputCostPerToken: 0.00001 },
  'gpt-5-mini': { apiName: 'gpt-5-mini-2025-08-07', inputCostPerToken: 0.00000025, outputCostPerToken: 0.000002 },
  'gpt-5-nano': { apiName: 'gpt-5-nano-2025-08-07', inputCostPerToken: 0.00000005, outputCostPerToken: 0.0000004 },
  'gpt-4.1': { apiName: 'gpt-4.1-2025-04-14', inputCostPerToken: 0.000002, outputCostPerToken: 0.000008 },
  'gpt-4.1-mini': { apiName: 'gpt-4.1-mini-2025-04-14', inputCostPerToken: 0.0000004, outputCostPerToken: 0.0000016 },
  'gpt-4.1-nano': { apiName: 'gpt-4.1-nano-2025-04-14', inputCostPerToken: 0.0000001, outputCostPerToken: 0.0000004 },
  'o3': { apiName: 'o3-2025-04-16', inputCostPerToken: 0.000002, outputCostPerToken: 0.000008 },
  'o4-mini': { apiName: 'o4-mini-2025-04-16', inputCostPerToken: 0.0000011, outputCostPerToken: 0.0000044 },
  'gpt-4o': { apiName: 'gpt-4o', inputCostPerToken: 0.0000025, outputCostPerToken: 0.00001 },
  'gpt-4o-mini': { apiName: 'gpt-4o-mini', inputCostPerToken: 0.00000015, outputCostPerToken: 0.0000006 },
};

// Lovable AI costs
const LOVABLE_COSTS: Record<string, { inputCostPerToken: number; outputCostPerToken: number }> = {
  'google/gemini-2.5-flash': { inputCostPerToken: 0.00000015, outputCostPerToken: 0.0000006 },
  'google/gemini-2.5-flash-lite': { inputCostPerToken: 0.000000075, outputCostPerToken: 0.0000003 }
};

// Depth configuration
type DepthLevel = 'critical' | 'balanced' | 'complete';

interface DepthConfig {
  maxContext: number;
  model: string;
  promptStyle: 'concise' | 'moderate' | 'detailed';
}

const DEFAULT_DEPTH_CONFIG: Record<DepthLevel, DepthConfig> = {
  critical: { maxContext: 8000, model: "google/gemini-2.5-flash-lite", promptStyle: 'concise' },
  balanced: { maxContext: 20000, model: "google/gemini-2.5-flash-lite", promptStyle: 'moderate' },
  complete: { maxContext: 40000, model: "google/gemini-2.5-flash", promptStyle: 'detailed' }
};

// Default prompts fallback
const DEFAULT_PROMPTS: Record<string, { system: string; user: string }> = {
  prd: { system: "Você é um analista de produtos técnico sênior especializado em documentação de software.", user: "Analise o seguinte projeto GitHub e crie um PRD completo em português." },
  divulgacao: { system: "Você é um especialista em marketing digital e growth hacking.", user: "Analise o projeto e crie um plano de divulgação e marketing em português." },
  captacao: { system: "Você é um especialista em captação de recursos e investimentos para startups.", user: "Analise o projeto e crie um plano de captação de recursos em português." },
  seguranca: { system: "Você é um especialista em segurança da informação e cibersegurança.", user: "Analise o código do projeto e identifique vulnerabilidades e melhorias de segurança em português." },
  ui_theme: { system: "Você é um designer de UX/UI especializado em interfaces modernas e acessíveis.", user: "Analise o código do projeto e sugira melhorias visuais e de experiência em português." },
  ferramentas: { system: "Você é um arquiteto de software sênior especializado em otimização de código.", user: "Analise o código existente e sugira melhorias nas funcionalidades atuais em português." },
  features: { system: "Você é um product manager visionário especializado em inovação de produtos.", user: "Analise o projeto e sugira novas funcionalidades inovadoras em português." },
  documentacao: { system: "Você é um technical writer sênior especializado em documentação de software open source e profissional.", user: "Analise o projeto e gere uma documentação técnica completa e profissional em português." },
  prompts: { system: "Você é um especialista em Prompt Engineering e AI-Assisted Development.", user: "Analise o projeto e gere prompts otimizados prontos para usar em ferramentas de IA para desenvolvimento." },
  quality: { system: "Você é um arquiteto de software sênior especializado em análise de qualidade de código e ferramentas de desenvolvimento.", user: "Analise o projeto e gere métricas de qualidade de código estimadas, incluindo recomendações de ferramentas." },
  performance: { system: "Você é um especialista em performance de software, otimização de aplicações web e observabilidade.", user: "Analise o projeto e identifique oportunidades de melhoria de performance (frontend, backend, banco de dados) e observabilidade (logs, métricas, alertas) em português. Inclua: Core Web Vitals, bundle size, otimização de queries, caching, e estratégias de monitoramento." }
};

interface AIProviderSettings {
  provider: 'lovable' | 'openai';
  openaiModel: string;
}

async function loadAIProviderSettings(supabase: any): Promise<AIProviderSettings> {
  try {
    const { data, error } = await supabase.from("system_settings").select("key, value").in("key", ["ai_provider", "openai_model"]);
    if (error) return { provider: 'lovable', openaiModel: 'gpt-5-mini' };
    const settings: Record<string, string> = {};
    data?.forEach((s: { key: string; value: string }) => { settings[s.key] = s.value; });
    return { provider: (settings.ai_provider || 'lovable') as 'lovable' | 'openai', openaiModel: settings.openai_model || 'gpt-5-mini' };
  } catch (e) {
    return { provider: 'lovable', openaiModel: 'gpt-5-mini' };
  }
}

async function loadDepthSettings(supabase: any, depth: DepthLevel): Promise<DepthConfig> {
  try {
    const { data, error } = await supabase.from("system_settings").select("key, value");
    if (error) return DEFAULT_DEPTH_CONFIG[depth];
    const settings: Record<string, string> = {};
    data?.forEach((s: { key: string; value: string }) => { settings[s.key] = s.value; });
    return {
      maxContext: parseInt(settings[`depth_${depth}_context`] || String(DEFAULT_DEPTH_CONFIG[depth].maxContext)),
      model: settings[`depth_${depth}_model`] || DEFAULT_DEPTH_CONFIG[depth].model,
      promptStyle: DEFAULT_DEPTH_CONFIG[depth].promptStyle
    };
  } catch (e) {
    return DEFAULT_DEPTH_CONFIG[depth];
  }
}

interface AnalysisPrompt {
  analysis_type: string;
  name: string;
  system_prompt: string;
  user_prompt_template: string;
  is_active: boolean;
}

async function loadPromptsFromDB(supabase: any): Promise<Map<string, AnalysisPrompt>> {
  const promptsMap = new Map<string, AnalysisPrompt>();
  try {
    const { data, error } = await supabase.from("analysis_prompts").select("analysis_type, name, system_prompt, user_prompt_template, is_active").eq("is_active", true);
    if (error) return promptsMap;
    data?.forEach((prompt: AnalysisPrompt) => { promptsMap.set(prompt.analysis_type, prompt); });
    return promptsMap;
  } catch (e) {
    return promptsMap;
  }
}

function replacePromptVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

async function callLovableAI(lovableApiKey: string, systemPrompt: string, userPrompt: string, model: string): Promise<AIResponse> {
  console.log(`🤖 Chamando Lovable AI (${model})...`);
  const startTime = Date.now();
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
      });

      if (response.status === 429) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 30000);
        console.log(`⚠️ Rate limit. Aguardando ${waitTime/1000}s...`);
        await delay(waitTime);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro API Lovable: ${response.status} - ${errorText}`);
        throw new Error(`Erro na API Lovable: ${response.status}`);
      }

      const data = await response.json();
      const inputTokens = data.usage?.prompt_tokens || Math.ceil((systemPrompt.length + userPrompt.length) / 4);
      const outputTokens = data.usage?.completion_tokens || Math.ceil((data.choices[0].message.content?.length || 0) / 4);
      
      console.log(`✅ Resposta em ${Date.now() - startTime}ms`);
      return { content: data.choices[0].message.content, tokensUsed: inputTokens + outputTokens, inputTokens, outputTokens, model, provider: 'lovable' };
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await delay(Math.min(1000 * Math.pow(2, attempt), 30000));
      }
    }
  }
  throw lastError || new Error("Falha após múltiplas tentativas");
}

async function callOpenAI(openaiApiKey: string, systemPrompt: string, userPrompt: string, modelKey: string): Promise<AIResponse> {
  const modelConfig = OPENAI_MODELS[modelKey] || OPENAI_MODELS['gpt-5-mini'];
  console.log(`🤖 Chamando OpenAI (${modelConfig.apiName})...`);
  const startTime = Date.now();
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openaiApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelConfig.apiName, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], max_completion_tokens: 8000 }),
      });

      if (response.status === 429) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 30000);
        console.log(`⚠️ Rate limit. Aguardando ${waitTime/1000}s...`);
        await delay(waitTime);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro API OpenAI: ${response.status} - ${errorText}`);
        throw new Error(`Erro na API OpenAI: ${response.status}`);
      }

      const data = await response.json();
      const inputTokens = data.usage?.prompt_tokens || Math.ceil((systemPrompt.length + userPrompt.length) / 4);
      const outputTokens = data.usage?.completion_tokens || Math.ceil((data.choices[0].message.content?.length || 0) / 4);
      
      console.log(`✅ Resposta em ${Date.now() - startTime}ms`);
      return { content: data.choices[0].message.content, tokensUsed: inputTokens + outputTokens, inputTokens, outputTokens, model: modelKey, provider: 'openai' };
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await delay(Math.min(1000 * Math.pow(2, attempt), 30000));
      }
    }
  }
  throw lastError || new Error("Falha após múltiplas tentativas");
}

function calculateRealCost(result: AIResponse): number {
  if (result.provider === 'openai') {
    const modelConfig = OPENAI_MODELS[result.model] || OPENAI_MODELS['gpt-5-mini'];
    return result.inputTokens * modelConfig.inputCostPerToken + result.outputTokens * modelConfig.outputCostPerToken;
  } else {
    const modelCosts = LOVABLE_COSTS[result.model] || LOVABLE_COSTS['google/gemini-2.5-flash'];
    return result.inputTokens * modelCosts.inputCostPerToken + result.outputTokens * modelCosts.outputCostPerToken;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { queueItemId } = await req.json();
    console.log("=== PROCESSANDO ITEM DA FILA ===");
    console.log("Queue Item ID:", queueItemId);

    if (!queueItemId) {
      throw new Error("queueItemId não fornecido");
    }

    // Get queue item with project data
    const { data: queueItem, error: queueError } = await supabase
      .from("analysis_queue")
      .select("*, projects(*)")
      .eq("id", queueItemId)
      .single();

    if (queueError || !queueItem) {
      throw new Error("Item da fila não encontrado");
    }

    // Check if already processing or completed
    if (queueItem.status === 'processing') {
      return new Response(JSON.stringify({ success: true, status: 'already_processing' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (queueItem.status === 'completed') {
      return new Response(JSON.stringify({ success: true, status: 'already_completed' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mark as processing
    await supabase.from("analysis_queue").update({ status: 'processing', started_at: new Date().toISOString() }).eq("id", queueItemId);

    const project = queueItem.projects;
    const analysisType = queueItem.analysis_type;
    const depth = queueItem.depth_level as DepthLevel;
    const userId = queueItem.user_id;

    console.log(`📝 Processando: ${analysisType} para projeto ${project.name}`);

    // Update project status
    const statusKey = `generating_${analysisType === 'ui_theme' ? 'ui' : analysisType}`;
    await supabase.from("projects").update({ analysis_status: statusKey }).eq("id", project.id);

    // Load settings
    const aiProviderSettings = await loadAIProviderSettings(supabase);
    const depthConfig = await loadDepthSettings(supabase, depth);
    const dbPrompts = await loadPromptsFromDB(supabase);

    // Get API keys
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (aiProviderSettings.provider === 'openai' && !openaiApiKey) {
      aiProviderSettings.provider = 'lovable';
    }
    if (aiProviderSettings.provider === 'lovable' && !lovableApiKey) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // Build project context from cached github_data
    const githubData = project.github_data;
    if (!githubData) {
      throw new Error("Dados do GitHub não encontrados. Execute a extração primeiro.");
    }

    let projectContext = `
# Projeto: ${project.name}
URL: ${project.github_url}

## Informações do Repositório
- Descrição: ${githubData.repoData?.description || "Sem descrição"}
- Linguagem principal: ${githubData.repoData?.language || "Não especificada"}
- Stars: ${githubData.repoData?.stars || 0}
- Forks: ${githubData.repoData?.forks || 0}

## README
${githubData.readmeContent || ""}

## Estrutura de Arquivos
${githubData.fileStructure || ""}

## package.json
${githubData.packageJsonContent || ""}

## Código Fonte
${githubData.sourceCodeContent || ""}

## Configuração
${githubData.configContent || ""}
`;

    // Apply context limit
    if (projectContext.length > depthConfig.maxContext) {
      projectContext = projectContext.substring(0, depthConfig.maxContext);
    }

    // Build prompts
    const promptVariables: Record<string, string> = {
      projectName: project.name,
      githubUrl: project.github_url,
      readme: githubData.readmeContent || "",
      structure: githubData.fileStructure || "",
      dependencies: githubData.packageJsonContent || "",
      sourceCode: githubData.sourceCodeContent || "",
    };

    const markdownFormatInstructions = `
IMPORTANTE: Formate sua resposta usando markdown rico e estruturado:
- Use tabelas markdown com | para organizar dados comparativos
- Use emojis para categorização visual (✅ ⚠️ 🔴 💡 📊 🎯 etc)
- Use badges de prioridade: 🔴 Alta | 🟡 Média | 🟢 Baixa
- Use blockquotes (>) para destacar informações importantes
- Use listas numeradas e com bullets
- Separe seções com --- quando apropriado
- Use **negrito** para títulos de itens importantes
- Use \`código\` para termos técnicos
`;

    const dbPrompt = dbPrompts.get(analysisType);
    let systemPrompt: string;
    let userPrompt: string;

    if (dbPrompt) {
      systemPrompt = dbPrompt.system_prompt;
      userPrompt = replacePromptVariables(dbPrompt.user_prompt_template, promptVariables);
    } else {
      const fallback = DEFAULT_PROMPTS[analysisType];
      systemPrompt = fallback?.system || "Você é um assistente especializado.";
      userPrompt = `${fallback?.user || "Analise o projeto."}\n\n${projectContext}`;
    }

    if (!userPrompt.includes("markdown")) {
      userPrompt = `${userPrompt}\n\n${markdownFormatInstructions}`;
    }

    if (dbPrompt && !userPrompt.includes(projectContext.substring(0, 100))) {
      userPrompt = `${userPrompt}\n\nContexto do Projeto:\n${projectContext}`;
    }

    // Call AI
    let result: AIResponse;
    if (aiProviderSettings.provider === 'openai' && openaiApiKey) {
      result = await callOpenAI(openaiApiKey, systemPrompt, userPrompt, aiProviderSettings.openaiModel);
    } else {
      result = await callLovableAI(lovableApiKey!, systemPrompt, userPrompt, depthConfig.model);
    }

    // Save analysis
    const { error: saveError } = await supabase.from("analyses").insert({
      project_id: project.id,
      type: analysisType,
      content: result.content,
    });

    if (saveError) {
      console.error(`❌ Erro ao salvar análise:`, saveError);
      throw new Error(`Erro ao salvar análise: ${saveError.message}`);
    }

    // Track usage
    const costEstimated = calculateRealCost(result);
    await supabase.from("analysis_usage").insert({
      user_id: userId,
      project_id: project.id,
      analysis_type: analysisType,
      tokens_estimated: result.tokensUsed,
      cost_estimated: costEstimated,
      model_used: result.model,
      depth_level: depth,
    });

    // Mark queue item as completed
    await supabase.from("analysis_queue").update({
      status: 'completed',
      completed_at: new Date().toISOString()
    }).eq("id", queueItemId);

    console.log(`✅ Análise ${analysisType} concluída!`);

    return new Response(
      JSON.stringify({ success: true, status: 'completed', analysisType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Erro ao processar análise:", error);
    
    // Try to update queue item with error
    try {
      const { queueItemId } = await req.clone().json();
      if (queueItemId) {
        // Get current retry count
        const { data: currentItem } = await supabase.from("analysis_queue").select("retry_count").eq("id", queueItemId).single();
        await supabase.from("analysis_queue").update({
          status: 'error',
          error_message: error instanceof Error ? error.message : "Erro desconhecido",
          retry_count: (currentItem?.retry_count || 0) + 1
        }).eq("id", queueItemId);
      }
    } catch (e) {
      console.error("Erro ao atualizar status de erro:", e);
    }

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
