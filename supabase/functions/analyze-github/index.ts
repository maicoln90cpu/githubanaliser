import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const githubHeaders = {
  "Accept": "application/vnd.github.v3+json",
  "User-Agent": "GitAnalyzer",
};

async function fetchFileContent(owner: string, repo: string, path: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      { headers: githubHeaders, signal: controller.signal }
    );
    clearTimeout(timeout);
    
    if (response.ok) {
      const data = await response.json();
      if (data.content) {
        return atob(data.content);
      }
    }
  } catch (e) {
    console.log(`Erro ao buscar ${path}:`, e);
  }
  return null;
}

async function fetchDirectoryContents(
  owner: string, 
  repo: string, 
  path: string = "", 
  depth: number = 0,
  maxDepth: number = 3
): Promise<any[]> {
  if (depth > maxDepth) return [];
  
  try {
    const url = path 
      ? `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
      : `https://api.github.com/repos/${owner}/${repo}/contents`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, { headers: githubHeaders, signal: controller.signal });
    clearTimeout(timeout);
    
    if (!response.ok) return [];
    
    const contents = await response.json();
    if (!Array.isArray(contents)) return [];
    
    let allItems: any[] = [];
    
    for (const item of contents) {
      allItems.push({
        type: item.type,
        name: item.name,
        path: item.path,
        size: item.size || 0
      });
      
      if (item.type === "dir" && shouldExploreDirectory(item.name)) {
        const subItems = await fetchDirectoryContents(owner, repo, item.path, depth + 1, maxDepth);
        allItems = allItems.concat(subItems);
      }
    }
    
    return allItems;
  } catch (e) {
    console.log(`Erro ao buscar diretório ${path}:`, e);
    return [];
  }
}

function shouldExploreDirectory(name: string): boolean {
  const importantDirs = ["src", "app", "pages", "components", "lib", "utils", "hooks", "services", "api", "supabase", "functions"];
  return importantDirs.includes(name.toLowerCase());
}

function isImportantFile(path: string): boolean {
  const importantPatterns = [
    /^src\/App\.(tsx|jsx|ts|js)$/,
    /^src\/main\.(tsx|jsx|ts|js)$/,
    /^src\/pages\/[^/]+\.(tsx|jsx)$/,
    /^src\/components\/[^/]+\.(tsx|jsx)$/,
    /^app\/page\.(tsx|jsx)$/,
    /^app\/layout\.(tsx|jsx)$/,
    /^supabase\/functions\/[^/]+\/index\.ts$/,
    /^src\/hooks\/[^/]+\.(ts|tsx)$/,
    /^src\/services\/[^/]+\.(ts|tsx)$/,
    /^src\/lib\/[^/]+\.(ts|tsx)$/,
    /\.config\.(ts|js|mjs)$/,
    /^index\.(html|tsx|jsx)$/,
  ];
  
  return importantPatterns.some(pattern => pattern.test(path));
}

async function updateProjectStatus(supabase: any, projectId: string, status: string, errorMessage?: string) {
  const updateData: any = { analysis_status: status };
  if (errorMessage) {
    updateData.error_message = errorMessage;
  }
  
  await supabase
    .from("projects")
    .update(updateData)
    .eq("id", projectId);
  
  console.log(`Status atualizado: ${status}`);
}

interface AIResponse {
  content: string;
  tokensUsed: number;
  model: string;
}

// Models by mode
const MODELS = {
  detailed: "google/gemini-2.5-flash",
  economic: "google/gemini-2.5-flash-lite"
};

// Depth levels configuration
type DepthLevel = 'critical' | 'balanced' | 'complete';

interface DepthConfig {
  maxContext: number;
  model: string;
  promptStyle: 'concise' | 'moderate' | 'detailed';
}

const DEFAULT_DEPTH_CONFIG: Record<DepthLevel, DepthConfig> = {
  critical: {
    maxContext: 8000,
    model: "google/gemini-2.5-flash-lite",
    promptStyle: 'concise'
  },
  balanced: {
    maxContext: 20000,
    model: "google/gemini-2.5-flash-lite",
    promptStyle: 'moderate'
  },
  complete: {
    maxContext: 40000,
    model: "google/gemini-2.5-flash",
    promptStyle: 'detailed'
  }
};

// Default settings
const DEFAULT_SETTINGS = {
  analysis_mode: 'detailed',
  economic_max_context: 15000,
  detailed_max_context: 40000
};

interface SystemSettings {
  analysisMode: 'economic' | 'detailed';
  maxContext: number;
  model: string;
  promptStyle: 'concise' | 'moderate' | 'detailed';
}

async function loadDepthSettings(supabase: any, depth: DepthLevel): Promise<DepthConfig> {
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("key, value");
    
    if (error) {
      console.log("⚠️ Erro ao carregar configurações de profundidade, usando padrão:", error.message);
      return DEFAULT_DEPTH_CONFIG[depth];
    }
    
    const settings: Record<string, string> = {};
    data?.forEach((s: { key: string; value: string }) => {
      settings[s.key] = s.value;
    });
    
    // Get depth-specific settings from database or use defaults
    const config: DepthConfig = {
      maxContext: parseInt(settings[`depth_${depth}_context`] || String(DEFAULT_DEPTH_CONFIG[depth].maxContext)),
      model: settings[`depth_${depth}_model`] || DEFAULT_DEPTH_CONFIG[depth].model,
      promptStyle: DEFAULT_DEPTH_CONFIG[depth].promptStyle
    };
    
    console.log(`⚙️ Configurações de profundidade (${depth}): contexto=${config.maxContext}, modelo=${config.model}, estilo=${config.promptStyle}`);
    
    return config;
  } catch (e) {
    console.log("⚠️ Exceção ao carregar configurações de profundidade:", e);
    return DEFAULT_DEPTH_CONFIG[depth];
  }
}

async function loadSystemSettings(supabase: any): Promise<SystemSettings> {
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("key, value");
    
    if (error) {
      console.log("⚠️ Erro ao carregar configurações, usando padrão:", error.message);
      return {
        analysisMode: 'detailed',
        maxContext: DEFAULT_SETTINGS.detailed_max_context,
        model: MODELS.detailed,
        promptStyle: 'detailed'
      };
    }
    
    const settings: Record<string, string> = {};
    data?.forEach((s: { key: string; value: string }) => {
      settings[s.key] = s.value;
    });
    
    const mode = (settings.analysis_mode || 'detailed') as 'economic' | 'detailed';
    const maxContext = mode === 'economic' 
      ? parseInt(settings.economic_max_context || String(DEFAULT_SETTINGS.economic_max_context))
      : parseInt(settings.detailed_max_context || String(DEFAULT_SETTINGS.detailed_max_context));
    
    console.log(`⚙️ Configurações carregadas: modo=${mode}, contexto=${maxContext}`);
    
    return {
      analysisMode: mode,
      maxContext,
      model: MODELS[mode],
      promptStyle: mode === 'economic' ? 'moderate' : 'detailed'
    };
  } catch (e) {
    console.log("⚠️ Exceção ao carregar configurações:", e);
    return {
      analysisMode: 'detailed',
      maxContext: DEFAULT_SETTINGS.detailed_max_context,
      model: MODELS.detailed,
      promptStyle: 'detailed'
    };
  }
}

// Delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Interface for prompts from database
interface AnalysisPrompt {
  analysis_type: string;
  name: string;
  system_prompt: string;
  user_prompt_template: string;
  is_active: boolean;
}

// Load prompts from database
async function loadPromptsFromDB(supabase: any): Promise<Map<string, AnalysisPrompt>> {
  const promptsMap = new Map<string, AnalysisPrompt>();
  
  try {
    const { data, error } = await supabase
      .from("analysis_prompts")
      .select("analysis_type, name, system_prompt, user_prompt_template, is_active")
      .eq("is_active", true);
    
    if (error) {
      console.log("⚠️ Erro ao carregar prompts do banco:", error.message);
      return promptsMap;
    }
    
    data?.forEach((prompt: AnalysisPrompt) => {
      promptsMap.set(prompt.analysis_type, prompt);
    });
    
    console.log(`✅ Carregados ${promptsMap.size} prompts do banco de dados`);
    return promptsMap;
  } catch (e) {
    console.log("⚠️ Exceção ao carregar prompts:", e);
    return promptsMap;
  }
}

// Replace variables in prompt template
function replacePromptVariables(
  template: string, 
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

// Default prompts fallback (used when DB prompts not available)
const DEFAULT_PROMPTS: Record<string, { system: string; user: string }> = {
  prd: {
    system: "Você é um analista de produtos técnico sênior especializado em documentação de software.",
    user: "Analise o seguinte projeto GitHub e crie um PRD (Product Requirements Document) completo em português."
  },
  divulgacao: {
    system: "Você é um especialista em marketing digital e growth hacking.",
    user: "Analise o projeto e crie um plano de divulgação e marketing em português."
  },
  captacao: {
    system: "Você é um especialista em captação de recursos e investimentos para startups.",
    user: "Analise o projeto e crie um plano de captação de recursos em português."
  },
  seguranca: {
    system: "Você é um especialista em segurança da informação e cibersegurança.",
    user: "Analise o código do projeto e identifique vulnerabilidades e melhorias de segurança em português."
  },
  ui_theme: {
    system: "Você é um designer de UX/UI especializado em interfaces modernas e acessíveis.",
    user: "Analise o código do projeto e sugira melhorias visuais e de experiência em português."
  },
  ferramentas: {
    system: "Você é um arquiteto de software sênior especializado em otimização de código.",
    user: "Analise o código existente e sugira melhorias nas funcionalidades atuais em português."
  },
  features: {
    system: "Você é um product manager visionário especializado em inovação de produtos.",
    user: "Analise o projeto e sugira novas funcionalidades inovadoras em português."
  },
  documentacao: {
    system: "Você é um technical writer sênior especializado em documentação de software open source e profissional.",
    user: "Analise o projeto e gere uma documentação técnica completa e profissional em português."
  }
};

async function callLovableAI(lovableApiKey: string, systemPrompt: string, userPrompt: string, model: string): Promise<AIResponse> {
  console.log(`🤖 Chamando Lovable AI (${model})...`);
  const startTime = Date.now();
  
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
        }),
      });

      if (response.status === 429) {
        // Rate limit - wait and retry with exponential backoff
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30s
        console.log(`⚠️ Rate limit (429). Tentativa ${attempt}/${maxRetries}. Aguardando ${waitTime/1000}s...`);
        await delay(waitTime);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro na API Lovable: ${response.status} - ${errorText}`);
        throw new Error(`Erro na API Lovable: ${response.status}`);
      }

      const data = await response.json();
      const elapsed = Date.now() - startTime;
      
      // Log detalhado do uso de tokens
      const promptTokens = data.usage?.prompt_tokens || 0;
      const completionTokens = data.usage?.completion_tokens || 0;
      const totalTokens = data.usage?.total_tokens || promptTokens + completionTokens ||
        Math.ceil((systemPrompt.length + userPrompt.length + (data.choices[0].message.content?.length || 0)) / 4);
      
      console.log(`✅ Resposta recebida em ${elapsed}ms (tentativa ${attempt})`);
      console.log(`📊 Tokens: prompt=${promptTokens}, completion=${completionTokens}, total=${totalTokens}`);
      
      return {
        content: data.choices[0].message.content,
        tokensUsed: totalTokens,
        model: model
      };
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 30000);
        console.log(`⚠️ Erro na tentativa ${attempt}. Aguardando ${waitTime/1000}s antes de retry...`);
        await delay(waitTime);
      }
    }
  }
  
  throw lastError || new Error("Falha após múltiplas tentativas");
}

interface GitHubData {
  repoData: {
    description: string;
    language: string;
    stars: number;
    forks: number;
  };
  readmeContent: string;
  fileStructure: string;
  packageJsonContent: string;
  sourceCodeContent: string;
  configContent: string;
  extractedAt: string;
}

async function extractGitHubData(
  owner: string,
  repo: string,
  githubUrl: string,
  projectName: string
): Promise<{ projectContext: string; githubData: GitHubData }> {
  console.log("Buscando informações do repositório...");
  const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: githubHeaders,
  });

  if (!repoResponse.ok) {
    throw new Error(`Repositório não encontrado: ${repoResponse.status}`);
  }

  const repoData = await repoResponse.json();
  console.log("✓ Repositório encontrado:", repoData.full_name);

  let readmeContent = "";
  try {
    const readmeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: githubHeaders,
    });
    if (readmeResponse.ok) {
      const readmeData = await readmeResponse.json();
      readmeContent = atob(readmeData.content);
      console.log(`✓ README encontrado (${readmeContent.length} caracteres)`);
    }
  } catch (e) {
    console.log("README não encontrado");
  }

  console.log("Buscando estrutura de arquivos...");
  const allFiles = await fetchDirectoryContents(owner, repo, "", 0, 3);
  console.log(`✓ Encontrados ${allFiles.length} arquivos/diretórios`);

  const fileStructure = allFiles
    .map(item => `${item.type === "dir" ? "📁" : "📄"} ${item.path}`)
    .join("\n");

  let packageJsonContent = "";
  const packageContent = await fetchFileContent(owner, repo, "package.json");
  if (packageContent) {
    try {
      const packageJson = JSON.parse(packageContent);
      packageJsonContent = `
Nome: ${packageJson.name || "Não especificado"}
Versão: ${packageJson.version || "Não especificada"}
Descrição: ${packageJson.description || "Sem descrição"}

Dependencies: ${packageJson.dependencies ? Object.keys(packageJson.dependencies).join(", ") : "Nenhuma"}

Dev Dependencies: ${packageJson.devDependencies ? Object.keys(packageJson.devDependencies).join(", ") : "Nenhuma"}

Scripts disponíveis: ${packageJson.scripts ? Object.entries(packageJson.scripts).map(([k, v]) => `\n  - ${k}: ${v}`).join("") : "Nenhum"}`;
      console.log("✓ package.json processado");
    } catch (e) {
      console.log("Erro ao processar package.json");
    }
  }

  console.log("Buscando conteúdo dos arquivos importantes...");
  const importantFiles = allFiles.filter(f => f.type === "file" && isImportantFile(f.path)).slice(0, 15);
  
  let sourceCodeContent = "";
  let totalSize = 0;
  const maxTotalSize = 40000;

  for (const file of importantFiles) {
    if (totalSize > maxTotalSize) break;

    const content = await fetchFileContent(owner, repo, file.path);
    if (content) {
      const truncatedContent = content.substring(0, 4000);
      sourceCodeContent += `\n\n=== ${file.path} ===\n${truncatedContent}`;
      totalSize += truncatedContent.length;
      console.log(`✓ ${file.path}`);
    }
  }

  const configFiles = ["tsconfig.json", "vite.config.ts", "tailwind.config.ts"];
  let configContent = "";
  
  for (const configFile of configFiles) {
    const content = await fetchFileContent(owner, repo, configFile);
    if (content) {
      configContent += `\n\n=== ${configFile} ===\n${content.substring(0, 1500)}`;
    }
  }

  const githubData: GitHubData = {
    repoData: {
      description: repoData.description || "Sem descrição",
      language: repoData.language || "Não especificada",
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
    },
    readmeContent: readmeContent.substring(0, 4000),
    fileStructure,
    packageJsonContent,
    sourceCodeContent,
    configContent,
    extractedAt: new Date().toISOString(),
  };

  const projectContext = `
# Projeto: ${projectName}
URL: ${githubUrl}

## Informações do Repositório
- Descrição: ${githubData.repoData.description}
- Linguagem principal: ${githubData.repoData.language}
- Stars: ${githubData.repoData.stars}
- Forks: ${githubData.repoData.forks}

## README
${githubData.readmeContent}

## Estrutura de Arquivos
${githubData.fileStructure}

## package.json
${githubData.packageJsonContent}

## Código Fonte
${githubData.sourceCodeContent}

## Configuração
${githubData.configContent}
`;

  return { projectContext, githubData };
}

function buildProjectContextFromCache(
  githubData: GitHubData,
  projectName: string,
  githubUrl: string
): string {
  return `
# Projeto: ${projectName}
URL: ${githubUrl}

## Informações do Repositório
- Descrição: ${githubData.repoData.description}
- Linguagem principal: ${githubData.repoData.language}
- Stars: ${githubData.repoData.stars}
- Forks: ${githubData.repoData.forks}

## README
${githubData.readmeContent}

## Estrutura de Arquivos
${githubData.fileStructure}

## package.json
${githubData.packageJsonContent}

## Código Fonte
${githubData.sourceCodeContent}

## Configuração
${githubData.configContent}
`;
}

// Custo por token baseado em Lovable AI gateway (gemini-2.5-flash)
// Input: ~$0.15/1M tokens, Output: ~$0.60/1M tokens
// Média estimada: ~$0.000001 por token (considerando proporção input/output)
const COST_PER_TOKEN = 0.000001;

// Helper to save analysis with error checking
async function saveAnalysis(
  supabase: any,
  projectId: string,
  analysisType: string,
  content: string
): Promise<boolean> {
  try {
    // Use INSERT to allow multiple versions of the same analysis type
    const { error } = await supabase.from("analyses").insert({
      project_id: projectId,
      type: analysisType,
      content: content,
    });
    
    if (error) {
      console.error(`❌ Erro ao salvar análise ${analysisType}:`, error.message);
      console.error(`   Detalhes:`, JSON.stringify(error));
      return false;
    }
    
    console.log(`✅ Análise ${analysisType} salva com sucesso (nova versão)`);
    return true;
  } catch (e) {
    console.error(`❌ Exceção ao salvar análise ${analysisType}:`, e);
    return false;
  }
}

async function trackAnalysisUsage(
  supabase: any,
  userId: string,
  projectId: string,
  analysisType: string,
  tokensUsed: number,
  modelUsed: string = MODELS.detailed,
  depthLevel: DepthLevel = "balanced"
) {
  const costEstimated = tokensUsed * COST_PER_TOKEN;
  
  console.log(`📊 Registrando uso: ${analysisType}`);
  console.log(`   - Tokens: ${tokensUsed}`);
  console.log(`   - Custo estimado: $${costEstimated.toFixed(6)}`);
  console.log(`   - Modelo: ${modelUsed}`);
  console.log(`   - Profundidade: ${depthLevel}`);
  
  try {
    const { error } = await supabase.from("analysis_usage").insert({
      user_id: userId,
      project_id: projectId,
      analysis_type: analysisType,
      tokens_estimated: tokensUsed,
      cost_estimated: costEstimated,
      model_used: modelUsed,
      depth_level: depthLevel,
    });
    
    if (error) {
      console.error("❌ Erro ao registrar uso:", error);
    } else {
      console.log(`✅ Uso registrado com sucesso`);
    }
  } catch (error) {
    console.error("❌ Exceção ao registrar uso:", error);
  }
}

async function processAnalysisInBackground(
  projectId: string,
  githubUrl: string,
  owner: string,
  repo: string,
  projectName: string,
  analysisTypes: string[],
  useCache: boolean = false,
  userId: string = "",
  depth: DepthLevel = "complete"
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Load depth-specific settings
  const depthConfig = await loadDepthSettings(supabase, depth);
  console.log(`🎛️ Profundidade: ${depth} (modelo: ${depthConfig.model}, contexto: ${depthConfig.maxContext})`);

  // Default to all types if not specified
  const typesToGenerate = analysisTypes.length > 0 
    ? analysisTypes 
    : ["prd", "divulgacao", "captacao", "seguranca", "ui_theme", "ferramentas", "features", "documentacao"];

  console.log("Tipos de análise selecionados:", typesToGenerate);
  console.log("Usar cache:", useCache);

  try {
    let projectContext: string;

    // Check for cached data if useCache is true
    if (useCache) {
      const { data: projectData } = await supabase
        .from("projects")
        .select("github_data")
        .eq("id", projectId)
        .single();

      if (projectData?.github_data) {
        console.log("✓ Usando dados em cache do GitHub");
        projectContext = buildProjectContextFromCache(
          projectData.github_data as unknown as GitHubData,
          projectName,
          githubUrl
        );
      } else {
        console.log("Cache não encontrado, extraindo novamente...");
        await updateProjectStatus(supabase, projectId, "extracting");
        const { projectContext: ctx, githubData } = await extractGitHubData(owner, repo, githubUrl, projectName);
        projectContext = ctx;
        
        // Save to cache
        await supabase
          .from("projects")
          .update({ github_data: githubData as unknown as Record<string, unknown> })
          .eq("id", projectId);
        console.log("✓ Dados salvos no cache");
      }
    } else {
      // Full extraction (no cache)
      await updateProjectStatus(supabase, projectId, "extracting");
      const { projectContext: ctx, githubData } = await extractGitHubData(owner, repo, githubUrl, projectName);
      projectContext = ctx;
      
      // Save to cache for future re-analyses
      await supabase
        .from("projects")
        .update({ github_data: githubData as unknown as Record<string, unknown> })
        .eq("id", projectId);
      console.log("✓ Dados salvos no cache");
    }

    // Apply context limit based on depth
    if (projectContext.length > depthConfig.maxContext) {
      console.log(`⚠️ Contexto truncado de ${projectContext.length} para ${depthConfig.maxContext} caracteres`);
      projectContext = projectContext.substring(0, depthConfig.maxContext);
    }

    console.log(`Contexto preparado: ${projectContext.length} caracteres`);

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // Load prompts from database
    const dbPrompts = await loadPromptsFromDB(supabase);
    const apiKey = lovableApiKey; // Type assertion after null check
    
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

    // Variables for prompt template replacement
    const promptVariables: Record<string, string> = {
      projectName: projectName,
      githubUrl: githubUrl,
      readme: projectContext.includes("## README") 
        ? projectContext.split("## README")[1]?.split("##")[0]?.trim() || "" 
        : "",
      structure: projectContext.includes("## Estrutura") 
        ? projectContext.split("## Estrutura")[1]?.split("##")[0]?.trim() || ""
        : "",
      dependencies: projectContext.includes("## package.json")
        ? projectContext.split("## package.json")[1]?.split("##")[0]?.trim() || ""
        : "",
      sourceCode: projectContext.includes("## Código Fonte")
        ? projectContext.split("## Código Fonte")[1]?.split("##")[0]?.trim() || ""
        : "",
    };

    // Helper function to generate analysis using DB prompt or fallback
    async function generateAnalysis(
      analysisType: string,
      statusKey: string
    ): Promise<void> {
      await updateProjectStatus(supabase, projectId, statusKey);
      console.log(`Gerando ${analysisType}...`);

      // Get prompt from DB or use fallback
      const dbPrompt = dbPrompts.get(analysisType);
      let systemPrompt: string;
      let userPrompt: string;

      if (dbPrompt) {
        console.log(`📝 Usando prompt do banco para ${analysisType}`);
        systemPrompt = dbPrompt.system_prompt;
        userPrompt = replacePromptVariables(dbPrompt.user_prompt_template, promptVariables);
      } else {
        console.log(`⚠️ Prompt não encontrado no banco, usando fallback para ${analysisType}`);
        const fallback = DEFAULT_PROMPTS[analysisType];
        systemPrompt = fallback?.system || "Você é um assistente especializado.";
        userPrompt = `${fallback?.user || "Analise o projeto."}\n\n${projectContext}`;
      }

      // Add markdown instructions to user prompt if not already present
      if (!userPrompt.includes("markdown")) {
        userPrompt = `${userPrompt}\n\n${markdownFormatInstructions}`;
      }

      // Add project context if using DB prompt (template might not include full context)
      if (dbPrompt && !userPrompt.includes(projectContext.substring(0, 100))) {
        userPrompt = `${userPrompt}\n\nContexto do Projeto:\n${projectContext}`;
      }

      const result = await callLovableAI(
        apiKey,
        systemPrompt,
        userPrompt,
        depthConfig.model
      );
      
      const saved = await saveAnalysis(supabase, projectId, analysisType, result.content);
      if (saved) {
        await trackAnalysisUsage(supabase, userId, projectId, analysisType, result.tokensUsed, result.model, depth);
      }
      
      await delay(2000);
    }

    // Generate each selected analysis type
    const analysisTypeMap: Record<string, string> = {
      prd: "generating_prd",
      divulgacao: "generating_divulgacao",
      captacao: "generating_captacao",
      seguranca: "generating_seguranca",
      ui_theme: "generating_ui",
      ferramentas: "generating_ferramentas",
      features: "generating_features",
      documentacao: "generating_documentacao"
    };

    for (const analysisType of typesToGenerate) {
      const statusKey = analysisTypeMap[analysisType];
      if (statusKey) {
        await generateAnalysis(analysisType, statusKey);
      } else {
        console.log(`⚠️ Tipo de análise desconhecido: ${analysisType}`);
      }
    }

    // === CONCLUÍDO ===
    await updateProjectStatus(supabase, projectId, "completed");
    console.log("=== ANÁLISE CONCLUÍDA ===");

  } catch (error) {
    console.error("Erro na análise:", error);
    await updateProjectStatus(
      supabase, 
      projectId, 
      "error", 
      error instanceof Error ? error.message : "Erro desconhecido"
    );
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { githubUrl, userId, analysisTypes, useCache, depth } = await req.json();
    console.log("=== INICIANDO ANÁLISE ===");
    console.log("URL:", githubUrl);
    console.log("User ID:", userId);
    console.log("Tipos de análise:", analysisTypes);
    console.log("Usar cache:", useCache);
    console.log("Profundidade:", depth || "complete");

    if (!githubUrl) {
      throw new Error("URL do GitHub não fornecida");
    }

    if (!userId) {
      throw new Error("Usuário não autenticado");
    }

    const urlParts = githubUrl.replace(/\/$/, "").split("/");
    const owner = urlParts[urlParts.length - 2];
    let repo = urlParts[urlParts.length - 1];
    repo = repo.replace(/\.git$/, "");
    const projectName = repo;

    console.log(`Owner: ${owner}, Repo: ${repo}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let project;
    const { data: existingProject } = await supabase
      .from("projects")
      .select()
      .eq("github_url", githubUrl)
      .eq("user_id", userId)
      .maybeSingle();

    // Parse analysis types - if it's a single type for re-analysis, don't delete other analyses
    const typesArray = Array.isArray(analysisTypes) ? analysisTypes : [];
    const isSingleTypeReanalysis = typesArray.length === 1;

    if (existingProject) {
      console.log("✓ Projeto já existe:", existingProject.id);
      project = existingProject;
      
      // Only delete analyses for the types being regenerated
      if (isSingleTypeReanalysis) {
        await supabase
          .from("analyses")
          .delete()
          .eq("project_id", existingProject.id)
          .eq("type", typesArray[0]);
      } else if (!useCache) {
        // Delete all analyses for full re-analysis (not using cache means fresh start)
        await supabase
          .from("analyses")
          .delete()
          .eq("project_id", existingProject.id);
      }
      
      await supabase
        .from("projects")
        .update({ analysis_status: "pending", error_message: null })
        .eq("id", existingProject.id);
    } else {
      const { data: newProject, error: projectError } = await supabase
        .from("projects")
        .upsert({
          name: projectName,
          github_url: githubUrl,
          analysis_status: "pending",
          user_id: userId,
        }, {
          onConflict: 'github_url,user_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (projectError) {
        console.error("Erro ao criar projeto:", projectError);
        
        const { data: fallbackProject } = await supabase
          .from("projects")
          .select()
          .eq("github_url", githubUrl)
          .eq("user_id", userId)
          .maybeSingle();
        
        if (fallbackProject) {
          project = fallbackProject;
          
          await supabase
            .from("analyses")
            .delete()
            .eq("project_id", fallbackProject.id);
          
          await supabase
            .from("projects")
            .update({ analysis_status: "pending", error_message: null })
            .eq("id", fallbackProject.id);
        } else {
          throw new Error("Falha ao criar ou encontrar projeto");
        }
      } else {
        project = newProject;
      }
      
      console.log("✓ Projeto criado:", project?.id);
    }

    if (!project) {
      throw new Error("Projeto não encontrado");
    }

    EdgeRuntime.waitUntil(
      processAnalysisInBackground(
        project.id, 
        githubUrl, 
        owner, 
        repo, 
        projectName, 
        typesArray,
        useCache === true,
        userId,
        (depth as DepthLevel) || "complete"
      )
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        projectId: project.id,
        message: "Análise iniciada em background" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
