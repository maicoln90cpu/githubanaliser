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
        model: MODELS.detailed
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
      model: MODELS[mode]
    };
  } catch (e) {
    console.log("⚠️ Exceção ao carregar configurações:", e);
    return {
      analysisMode: 'detailed',
      maxContext: DEFAULT_SETTINGS.detailed_max_context,
      model: MODELS.detailed
    };
  }
}

async function callLovableAI(lovableApiKey: string, systemPrompt: string, userPrompt: string, model: string): Promise<AIResponse> {
  console.log(`🤖 Chamando Lovable AI (${model})...`);
  const startTime = Date.now();
  
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

  const elapsed = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Erro na API Lovable: ${response.status} - ${errorText}`);
    throw new Error(`Erro na API Lovable: ${response.status}`);
  }

  const data = await response.json();
  
  // Log detalhado do uso de tokens
  const promptTokens = data.usage?.prompt_tokens || 0;
  const completionTokens = data.usage?.completion_tokens || 0;
  const totalTokens = data.usage?.total_tokens || promptTokens + completionTokens ||
    Math.ceil((systemPrompt.length + userPrompt.length + (data.choices[0].message.content?.length || 0)) / 4);
  
  console.log(`✅ Resposta recebida em ${elapsed}ms`);
  console.log(`📊 Tokens: prompt=${promptTokens}, completion=${completionTokens}, total=${totalTokens}`);
  
  return {
    content: data.choices[0].message.content,
    tokensUsed: totalTokens,
    model: model
  };
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

async function trackAnalysisUsage(
  supabase: any,
  userId: string,
  projectId: string,
  analysisType: string,
  tokensUsed: number,
  modelUsed: string = MODELS.detailed
) {
  const costEstimated = tokensUsed * COST_PER_TOKEN;
  
  console.log(`📊 Registrando uso: ${analysisType}`);
  console.log(`   - Tokens: ${tokensUsed}`);
  console.log(`   - Custo estimado: $${costEstimated.toFixed(6)}`);
  console.log(`   - Modelo: ${modelUsed}`);
  
  try {
    const { error } = await supabase.from("analysis_usage").insert({
      user_id: userId,
      project_id: projectId,
      analysis_type: analysisType,
      tokens_estimated: tokensUsed,
      cost_estimated: costEstimated,
      model_used: modelUsed,
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
  userId: string = ""
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Load system settings (mode: economic or detailed)
  const settings = await loadSystemSettings(supabase);
  console.log(`🎛️ Modo de análise: ${settings.analysisMode} (modelo: ${settings.model})`);

  // Default to all types if not specified
  const typesToGenerate = analysisTypes.length > 0 
    ? analysisTypes 
    : ["prd", "divulgacao", "captacao", "seguranca", "ui_theme", "ferramentas", "features"];

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

    // Apply context limit based on mode
    if (projectContext.length > settings.maxContext) {
      console.log(`⚠️ Contexto truncado de ${projectContext.length} para ${settings.maxContext} caracteres`);
      projectContext = projectContext.substring(0, settings.maxContext);
    }

    console.log(`Contexto preparado: ${projectContext.length} caracteres`);

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

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

    // === GERAR PRD ===
    if (typesToGenerate.includes("prd")) {
      await updateProjectStatus(supabase, projectId, "generating_prd");
      console.log("Gerando PRD...");

      const prdResult = await callLovableAI(
        lovableApiKey,
        "Você é um analista de produtos técnico sênior especializado em documentação de software.",
        `Analise o seguinte projeto GitHub e crie um PRD (Product Requirements Document) completo em português.

${projectContext}

${markdownFormatInstructions}

Estruture o documento com estas seções:
1. **📋 Visão Geral do Produto** - Resumo executivo
2. **🎯 Objetivos e Metas** - Com métricas mensuráveis em tabela
3. **👥 Público-Alvo** - Personas detalhadas
4. **🏗️ Arquitetura Técnica** - Diagrama em texto e componentes
5. **⚙️ Funcionalidades Principais** - Tabela com prioridade e status
6. **📦 Requisitos Técnicos** - Stack, dependências, infraestrutura
7. **⚠️ Riscos e Mitigações** - Tabela com probabilidade e impacto
8. **📊 Métricas de Sucesso** - KPIs em tabela`,
        settings.model
      );
      
      await supabase.from("analyses").upsert({
        project_id: projectId,
        type: "prd",
        content: prdResult.content,
      }, { onConflict: 'project_id,type' });
      await trackAnalysisUsage(supabase, userId, projectId, "prd", prdResult.tokensUsed, prdResult.model);
      console.log("✓ PRD salvo");
    }

    // === GERAR PLANO DE DIVULGAÇÃO ===
    if (typesToGenerate.includes("divulgacao")) {
      await updateProjectStatus(supabase, projectId, "generating_divulgacao");
      console.log("Gerando plano de divulgação...");

      const divulgacaoResult = await callLovableAI(
        lovableApiKey,
        "Você é um especialista em marketing digital e growth hacking.",
        `Analise o projeto e crie um plano de divulgação e marketing em português.

${projectContext}

${markdownFormatInstructions}

Estruture o documento com estas seções:
1. **📢 Estratégia de Comunicação** - Mensagens-chave e tom de voz
2. **🎯 Canais de Marketing** - Tabela com canal, público, custo e ROI esperado
3. **📱 Redes Sociais** - Estratégia por plataforma com cronograma
4. **✍️ Marketing de Conteúdo** - Tipos de conteúdo e calendário editorial
5. **🔍 SEO e SEM** - Keywords, estratégias orgânicas e pagas
6. **🤝 Parcerias e Influenciadores** - Potenciais parceiros e abordagem
7. **📅 Cronograma de Lançamento** - Timeline em tabela
8. **📊 Métricas e KPIs** - Tabela com meta e baseline`,
        settings.model
      );
      
      await supabase.from("analyses").upsert({
        project_id: projectId,
        type: "divulgacao",
        content: divulgacaoResult.content,
      }, { onConflict: 'project_id,type' });
      await trackAnalysisUsage(supabase, userId, projectId, "divulgacao", divulgacaoResult.tokensUsed, divulgacaoResult.model);
      console.log("✓ Plano de divulgação salvo");
    }

    // === GERAR PLANO DE CAPTAÇÃO ===
    if (typesToGenerate.includes("captacao")) {
      await updateProjectStatus(supabase, projectId, "generating_captacao");
      console.log("Gerando plano de captação...");

      const captacaoResult = await callLovableAI(
        lovableApiKey,
        "Você é um especialista em captação de recursos e investimentos para startups.",
        `Analise o projeto e crie um plano de captação de recursos em português.

${projectContext}

${markdownFormatInstructions}

Estruture o documento com estas seções:
1. **💰 Modelo de Negócio** - Canvas resumido e monetização
2. **📈 Oportunidade de Mercado** - TAM, SAM, SOM em tabela
3. **🎯 Proposta de Valor para Investidores** - Diferenciais competitivos
4. **💵 Projeções Financeiras** - Tabela com receita, custos e lucro
5. **🚀 Uso dos Recursos** - Alocação do investimento em tabela
6. **👥 Tipos de Investidores** - Perfil ideal e abordagem
7. **📋 Documentação Necessária** - Checklist para pitch
8. **📅 Roadmap de Captação** - Timeline e milestones`,
        settings.model
      );
      
      await supabase.from("analyses").upsert({
        project_id: projectId,
        type: "captacao",
        content: captacaoResult.content,
      }, { onConflict: 'project_id,type' });
      await trackAnalysisUsage(supabase, userId, projectId, "captacao", captacaoResult.tokensUsed, captacaoResult.model);
      console.log("✓ Plano de captação salvo");
    }

    // === GERAR MELHORIAS DE SEGURANÇA ===
    if (typesToGenerate.includes("seguranca")) {
      await updateProjectStatus(supabase, projectId, "generating_seguranca");
      console.log("Gerando análise de segurança...");

      const segurancaResult = await callLovableAI(
        lovableApiKey,
        "Você é um especialista em segurança da informação e cibersegurança.",
        `Analise o código do projeto e identifique vulnerabilidades e melhorias de segurança em português.

${projectContext}

${markdownFormatInstructions}

Estruture o documento com estas seções:
1. **🛡️ Resumo de Segurança** - Score geral e principais riscos
2. **🔴 Vulnerabilidades Críticas** - Tabela com descrição, arquivo, severidade e correção
3. **🟡 Vulnerabilidades Médias** - Tabela similar
4. **🟢 Boas Práticas Implementadas** - O que já está bom
5. **🔐 Autenticação e Autorização** - Análise e recomendações
6. **🗄️ Segurança de Dados** - Criptografia, sanitização, LGPD
7. **🌐 Segurança de API** - Rate limiting, CORS, validações
8. **📋 Checklist de Implementação** - Tabela com prioridade e esforço`,
        settings.model
      );
      
      await supabase.from("analyses").upsert({
        project_id: projectId,
        type: "seguranca",
        content: segurancaResult.content,
      }, { onConflict: 'project_id,type' });
      await trackAnalysisUsage(supabase, userId, projectId, "seguranca", segurancaResult.tokensUsed, segurancaResult.model);
      console.log("✓ Análise de segurança salva");
    }

    // === GERAR MELHORIAS DE UI/THEME ===
    if (typesToGenerate.includes("ui_theme")) {
      await updateProjectStatus(supabase, projectId, "generating_ui");
      console.log("Gerando melhorias de UI...");

      const uiResult = await callLovableAI(
        lovableApiKey,
        "Você é um designer de UX/UI especializado em interfaces modernas e acessíveis.",
        `Analise o código do projeto e sugira melhorias visuais e de experiência em português.

${projectContext}

${markdownFormatInstructions}

Estruture o documento com estas seções:
1. **🎨 Análise Visual Atual** - Pontos fortes e fracos do design
2. **🎯 Melhorias de UX** - Tabela com problema, solução e impacto
3. **🖼️ Design System** - Sugestões de cores, tipografia, espaçamento
4. **📱 Responsividade** - Análise mobile e tablet
5. **♿ Acessibilidade** - WCAG compliance e melhorias
6. **✨ Animações e Micro-interações** - Sugestões específicas
7. **🌙 Tema Escuro/Claro** - Implementação ou melhorias
8. **📋 Roadmap Visual** - Tabela com prioridade e complexidade`,
        settings.model
      );
      
      await supabase.from("analyses").upsert({
        project_id: projectId,
        type: "ui_theme",
        content: uiResult.content,
      }, { onConflict: 'project_id,type' });
      await trackAnalysisUsage(supabase, userId, projectId, "ui_theme", uiResult.tokensUsed, uiResult.model);
      console.log("✓ Melhorias de UI salvas");
    }

    // === GERAR MELHORIAS DE FERRAMENTAS ===
    if (typesToGenerate.includes("ferramentas")) {
      await updateProjectStatus(supabase, projectId, "generating_ferramentas");
      console.log("Gerando melhorias de ferramentas...");

      const ferramentasResult = await callLovableAI(
        lovableApiKey,
        "Você é um arquiteto de software sênior especializado em otimização de código.",
        `Analise o código existente e sugira melhorias nas funcionalidades atuais em português.

${projectContext}

${markdownFormatInstructions}

Estruture o documento com estas seções:
1. **📊 Análise das Funcionalidades Atuais** - Inventário com status
2. **⚡ Otimizações de Performance** - Tabela com problema, solução e ganho esperado
3. **🔧 Refatorações Recomendadas** - Código específico a melhorar
4. **📦 Dependências** - Atualizar, remover ou adicionar
5. **🧪 Testes** - Cobertura atual e sugestões
6. **📝 Documentação de Código** - Melhorias específicas
7. **🔄 CI/CD e DevOps** - Automações sugeridas
8. **📋 Backlog Técnico** - Tabela com prioridade, esforço e impacto`,
        settings.model
      );
      
      await supabase.from("analyses").upsert({
        project_id: projectId,
        type: "ferramentas",
        content: ferramentasResult.content,
      }, { onConflict: 'project_id,type' });
      await trackAnalysisUsage(supabase, userId, projectId, "ferramentas", ferramentasResult.tokensUsed, ferramentasResult.model);
      console.log("✓ Melhorias de ferramentas salvas");
    }

    // === GERAR SUGESTÕES DE NOVAS FEATURES ===
    if (typesToGenerate.includes("features")) {
      await updateProjectStatus(supabase, projectId, "generating_features");
      console.log("Gerando sugestões de features...");

      const featuresResult = await callLovableAI(
        lovableApiKey,
        "Você é um product manager visionário especializado em inovação de produtos.",
        `Analise o projeto e sugira novas funcionalidades inovadoras em português.

${projectContext}

${markdownFormatInstructions}

Estruture o documento com estas seções:
1. **💡 Visão de Produto** - Onde o produto pode chegar
2. **🚀 Features de Alto Impacto** - Tabela com feature, descrição, valor para usuário, complexidade
3. **🤖 Integrações com IA** - Oportunidades de usar IA/ML
4. **🔗 Integrações Externas** - APIs e serviços complementares
5. **📱 Features Mobile/PWA** - Se aplicável
6. **👥 Features Sociais/Colaborativas** - Funcionalidades de comunidade
7. **💰 Features de Monetização** - Modelos de receita
8. **📋 Roadmap de Features** - Tabela com fase, features, timeline e recursos`,
        settings.model
      );
      
      await supabase.from("analyses").upsert({
        project_id: projectId,
        type: "features",
        content: featuresResult.content,
      }, { onConflict: 'project_id,type' });
      await trackAnalysisUsage(supabase, userId, projectId, "features", featuresResult.tokensUsed, featuresResult.model);
      console.log("✓ Sugestões de features salvas");
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
    const { githubUrl, userId, analysisTypes, useCache } = await req.json();
    console.log("=== INICIANDO ANÁLISE ===");
    console.log("URL:", githubUrl);
    console.log("User ID:", userId);
    console.log("Tipos de análise:", analysisTypes);
    console.log("Usar cache:", useCache);

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
        userId
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
