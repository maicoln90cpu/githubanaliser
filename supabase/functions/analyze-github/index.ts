import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declarar EdgeRuntime para Supabase
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

// Função para buscar conteúdo de um arquivo específico
async function fetchFileContent(owner: string, repo: string, path: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
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

// Função para buscar estrutura de diretório recursivamente
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
      
      // Buscar subdiretórios importantes
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

// Diretórios importantes para explorar
function shouldExploreDirectory(name: string): boolean {
  const importantDirs = ["src", "app", "pages", "components", "lib", "utils", "hooks", "services", "api", "supabase", "functions"];
  return importantDirs.includes(name.toLowerCase());
}

// Arquivos importantes para ler conteúdo
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

// Função para atualizar status do projeto
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

// Função principal de análise em background
async function processAnalysisInBackground(
  projectId: string,
  githubUrl: string,
  owner: string,
  repo: string,
  projectName: string
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // === ETAPA 1: EXTRAÇÃO ===
    await updateProjectStatus(supabase, projectId, "extracting");
    
    // Buscar informações do repositório
    console.log("Buscando informações do repositório...");
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: githubHeaders,
    });

    if (!repoResponse.ok) {
      throw new Error(`Repositório não encontrado: ${repoResponse.status}`);
    }

    const repoData = await repoResponse.json();
    console.log("✓ Repositório encontrado:", repoData.full_name);

    // Buscar README
    console.log("Buscando README...");
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

    // Buscar estrutura de arquivos
    console.log("Buscando estrutura de arquivos...");
    const allFiles = await fetchDirectoryContents(owner, repo, "", 0, 3);
    console.log(`✓ Encontrados ${allFiles.length} arquivos/diretórios`);

    const fileStructure = allFiles
      .map(item => `${item.type === "dir" ? "📁" : "📄"} ${item.path}`)
      .join("\n");

    // Buscar package.json
    console.log("Buscando package.json...");
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

    // Buscar conteúdo dos arquivos importantes (limitado a 15 arquivos)
    console.log("Buscando conteúdo dos arquivos importantes...");
    const importantFiles = allFiles.filter(f => f.type === "file" && isImportantFile(f.path)).slice(0, 15);
    
    let sourceCodeContent = "";
    let totalSize = 0;
    const maxTotalSize = 40000; // 40KB máximo

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

    // Buscar arquivos de configuração
    const configFiles = ["tsconfig.json", "vite.config.ts", "tailwind.config.ts"];
    let configContent = "";
    
    for (const configFile of configFiles) {
      const content = await fetchFileContent(owner, repo, configFile);
      if (content) {
        configContent += `\n\n=== ${configFile} ===\n${content.substring(0, 1500)}`;
      }
    }

    // Preparar contexto
    const projectContext = `
# Projeto: ${projectName}
URL: ${githubUrl}

## Informações do Repositório
- Descrição: ${repoData.description || "Sem descrição"}
- Linguagem principal: ${repoData.language || "Não especificada"}
- Stars: ${repoData.stargazers_count}
- Forks: ${repoData.forks_count}

## README
${readmeContent.substring(0, 4000)}

## Estrutura de Arquivos
${fileStructure}

## package.json
${packageJsonContent}

## Código Fonte
${sourceCodeContent}

## Configuração
${configContent}
`;

    console.log(`Contexto preparado: ${projectContext.length} caracteres`);

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // === ETAPA 2: GERAR PRD ===
    await updateProjectStatus(supabase, projectId, "generating_prd");
    console.log("Gerando PRD...");

    const prdPrompt = `Você é um analista de produtos técnico sênior. Analise o seguinte projeto GitHub e crie um PRD completo em português.

${projectContext}

Crie um documento com:
1. **Visão Geral do Produto**
2. **Objetivos e Metas**
3. **Público-Alvo**
4. **Arquitetura Técnica**
5. **Funcionalidades Principais**
6. **Requisitos Técnicos**
7. **Riscos e Mitigações**
8. **Métricas de Sucesso**

Use markdown e seja específico sobre o código analisado.`;

    const prdResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um analista de produtos sênior." },
          { role: "user", content: prdPrompt }
        ],
      }),
    });

    if (!prdResponse.ok) {
      throw new Error(`Erro na API Lovable PRD: ${prdResponse.status}`);
    }

    const prdData = await prdResponse.json();
    const prdContent = prdData.choices[0].message.content;
    
    await supabase.from("analyses").insert({
      project_id: projectId,
      type: "prd",
      content: prdContent,
    });
    console.log("✓ PRD salvo");

    // === ETAPA 3: GERAR PLANO DE CAPTAÇÃO ===
    await updateProjectStatus(supabase, projectId, "generating_funding");
    console.log("Gerando plano de captação...");

    const captacaoPrompt = `Você é um especialista em marketing. Analise o projeto e crie um plano de captação em português.

${projectContext}

Crie um plano com:
1. **Posicionamento e Proposta de Valor**
2. **Estratégias de Marketing Digital**
3. **Copy e Mensagens-Chave**
4. **Canais de Divulgação**
5. **Estratégia de Conteúdo**
6. **Plano de Captação de Recursos**
7. **Timeline e Marcos**
8. **KPIs e Métricas**

Use markdown e seja estratégico.`;

    const captacaoResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um estrategista de marketing." },
          { role: "user", content: captacaoPrompt }
        ],
      }),
    });

    const captacaoData = await captacaoResponse.json();
    const captacaoContent = captacaoData.choices[0].message.content;
    
    await supabase.from("analyses").insert({
      project_id: projectId,
      type: "captacao",
      content: captacaoContent,
    });
    console.log("✓ Plano de captação salvo");

    // === ETAPA 4: GERAR MELHORIAS ===
    await updateProjectStatus(supabase, projectId, "generating_improvements");
    console.log("Gerando melhorias...");

    const melhoriasPrompt = `Você é um arquiteto de software sênior. Analise o código e sugira melhorias técnicas em português.

${projectContext}

Crie um documento com:
1. **Análise da Arquitetura Atual**
2. **Melhorias Técnicas Recomendadas**
3. **Novas Features Sugeridas**
4. **Refatorações Importantes**
5. **Melhorias de Performance**
6. **Segurança e Qualidade de Código**
7. **Roadmap Técnico**
8. **Estimativas de Esforço**

Seja específico, mencione arquivos quando relevante.`;

    const melhoriasResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um arquiteto de software sênior." },
          { role: "user", content: melhoriasPrompt }
        ],
      }),
    });

    const melhoriasData = await melhoriasResponse.json();
    const melhoriasContent = melhoriasData.choices[0].message.content;
    
    await supabase.from("analyses").insert({
      project_id: projectId,
      type: "melhorias",
      content: melhoriasContent,
    });
    console.log("✓ Melhorias salvas");

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
    const { githubUrl, userId } = await req.json();
    console.log("=== INICIANDO ANÁLISE ===");
    console.log("URL:", githubUrl);
    console.log("User ID:", userId);

    if (!githubUrl) {
      throw new Error("URL do GitHub não fornecida");
    }

    if (!userId) {
      throw new Error("Usuário não autenticado");
    }

    // Extrair informações da URL
    const urlParts = githubUrl.replace(/\/$/, "").split("/");
    const owner = urlParts[urlParts.length - 2];
    let repo = urlParts[urlParts.length - 1];
    repo = repo.replace(/\.git$/, "");
    const projectName = repo;

    console.log(`Owner: ${owner}, Repo: ${repo}`);

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se projeto já existe para esse usuário
    let project;
    const { data: existingProject } = await supabase
      .from("projects")
      .select()
      .eq("github_url", githubUrl)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingProject) {
      console.log("✓ Projeto já existe:", existingProject.id);
      project = existingProject;
      
      // Deletar análises antigas e resetar status
      await supabase
        .from("analyses")
        .delete()
        .eq("project_id", existingProject.id);
      
      await supabase
        .from("projects")
        .update({ analysis_status: "pending", error_message: null })
        .eq("id", existingProject.id);
    } else {
      // Criar novo projeto com user_id
      const { data: newProject, error: projectError } = await supabase
        .from("projects")
        .insert({
          name: projectName,
          github_url: githubUrl,
          analysis_status: "pending",
          user_id: userId,
        })
        .select()
        .single();

      if (projectError) {
        throw projectError;
      }
      project = newProject;
      console.log("✓ Novo projeto criado:", project.id);
    }

    // Iniciar processamento em background
    EdgeRuntime.waitUntil(
      processAnalysisInBackground(project.id, githubUrl, owner, repo, projectName)
    );

    // Retornar resposta IMEDIATAMENTE
    return new Response(
      JSON.stringify({ 
        success: true, 
        projectId: project.id,
        status: "pending",
        message: "Análise iniciada em background"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido"
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
