import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      { headers: githubHeaders }
    );
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
    
    const response = await fetch(url, { headers: githubHeaders });
    
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { githubUrl } = await req.json();
    console.log("=== INICIANDO ANÁLISE ===");
    console.log("URL:", githubUrl);

    if (!githubUrl) {
      throw new Error("URL do GitHub não fornecida");
    }

    // Extrair informações da URL
    const urlParts = githubUrl.replace(/\/$/, "").split("/");
    const owner = urlParts[urlParts.length - 2];
    let repo = urlParts[urlParts.length - 1];
    repo = repo.replace(/\.git$/, "");
    const projectName = repo;

    console.log(`Owner: ${owner}, Repo: ${repo}`);

    // 1. Buscar informações básicas do repositório
    console.log("Buscando informações do repositório...");
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: githubHeaders,
    });

    if (!repoResponse.ok) {
      const errorText = await repoResponse.text();
      console.error("Erro GitHub API:", repoResponse.status, errorText);
      throw new Error(`Repositório não encontrado: ${repoResponse.status}`);
    }

    const repoData = await repoResponse.json();
    console.log("✓ Repositório encontrado:", repoData.full_name);

    // 2. Buscar README
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

    // 3. Buscar estrutura de arquivos COMPLETA
    console.log("Buscando estrutura de arquivos recursivamente...");
    const allFiles = await fetchDirectoryContents(owner, repo, "", 0, 3);
    console.log(`✓ Encontrados ${allFiles.length} arquivos/diretórios`);

    // Formatar estrutura de arquivos
    const fileStructure = allFiles
      .map(item => `${item.type === "dir" ? "📁" : "📄"} ${item.path}`)
      .join("\n");

    // 4. Buscar package.json
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

    // 5. BUSCAR CONTEÚDO DOS ARQUIVOS IMPORTANTES
    console.log("Buscando conteúdo dos arquivos importantes...");
    const importantFiles = allFiles.filter(f => f.type === "file" && isImportantFile(f.path));
    console.log(`Arquivos importantes encontrados: ${importantFiles.map(f => f.path).join(", ")}`);

    let sourceCodeContent = "";
    let totalSize = 0;
    const maxTotalSize = 50000; // 50KB máximo

    for (const file of importantFiles) {
      if (totalSize > maxTotalSize) {
        console.log("Limite de tamanho atingido, parando extração");
        break;
      }

      const content = await fetchFileContent(owner, repo, file.path);
      if (content) {
        const truncatedContent = content.substring(0, 5000); // Max 5KB por arquivo
        sourceCodeContent += `\n\n=== ${file.path} ===\n${truncatedContent}`;
        totalSize += truncatedContent.length;
        console.log(`✓ ${file.path} (${content.length} chars)`);
      }
    }

    // 6. Buscar arquivos de configuração adicionais
    console.log("Buscando arquivos de configuração...");
    const configFiles = ["tsconfig.json", "vite.config.ts", "tailwind.config.ts", "next.config.js", "next.config.ts"];
    let configContent = "";
    
    for (const configFile of configFiles) {
      const content = await fetchFileContent(owner, repo, configFile);
      if (content) {
        configContent += `\n\n=== ${configFile} ===\n${content.substring(0, 2000)}`;
        console.log(`✓ ${configFile} encontrado`);
      }
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Salvar projeto
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: projectName,
        github_url: githubUrl,
      })
      .select()
      .single();

    if (projectError) {
      console.error("Erro ao salvar projeto:", projectError);
      throw projectError;
    }

    console.log("✓ Projeto salvo:", project.id);

    // Preparar contexto COMPLETO para IA
    const projectContext = `
# Projeto: ${projectName}
URL: ${githubUrl}

## Informações do Repositório
- Descrição: ${repoData.description || "Sem descrição"}
- Linguagem principal: ${repoData.language || "Não especificada"}
- Stars: ${repoData.stargazers_count}
- Forks: ${repoData.forks_count}
- Issues abertas: ${repoData.open_issues_count}
- Criado em: ${repoData.created_at}
- Última atualização: ${repoData.updated_at}

## README
${readmeContent.substring(0, 5000)}

## Estrutura de Arquivos
${fileStructure}

## package.json
${packageJsonContent}

## Código Fonte dos Principais Arquivos
${sourceCodeContent}

## Arquivos de Configuração
${configContent}
`;

    console.log(`\n=== CONTEXTO PREPARADO ===`);
    console.log(`Tamanho total do contexto: ${projectContext.length} caracteres`);

    // Chamar Lovable AI para gerar as 3 análises
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // 1. Análise PRD
    console.log("\n=== Gerando análise PRD ===");
    const prdPrompt = `Você é um analista de produtos técnico sênior. Analise o seguinte projeto GitHub DETALHADAMENTE e crie um PRD (Product Requirements Document) completo e profissional em português.

IMPORTANTE: Analise o código fonte fornecido para entender as funcionalidades REAIS implementadas, não apenas suposições.

${projectContext}

Crie um documento estruturado com:
1. **Visão Geral do Produto** - O que o projeto faz baseado no código real
2. **Objetivos e Metas** - Baseado nas features implementadas
3. **Público-Alvo** - Quem usaria este produto
4. **Arquitetura Técnica** - Stack, estrutura de pastas, padrões utilizados
5. **Funcionalidades Principais** - Liste CADA funcionalidade encontrada no código
6. **Requisitos Técnicos** - Dependencies, configurações necessárias
7. **Riscos e Mitigações** - Problemas potenciais identificados no código
8. **Métricas de Sucesso**

Use markdown para formatação. Seja ESPECÍFICO sobre o código analisado.`;

    const prdResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um analista de produtos sênior. Analise código fonte real e seja específico sobre as funcionalidades encontradas." },
          { role: "user", content: prdPrompt }
        ],
      }),
    });

    if (!prdResponse.ok) {
      const errorText = await prdResponse.text();
      console.error("Erro API Lovable PRD:", prdResponse.status, errorText);
      throw new Error(`Erro na API Lovable: ${prdResponse.status}`);
    }

    const prdData = await prdResponse.json();
    const prdContent = prdData.choices[0].message.content;
    console.log("✓ PRD gerado");

    await supabase.from("analyses").insert({
      project_id: project.id,
      type: "prd",
      content: prdContent,
    });

    // 2. Plano de Captação
    console.log("\n=== Gerando plano de captação ===");
    const captacaoPrompt = `Você é um especialista em marketing e captação de recursos. Analise o seguinte projeto GitHub e crie um plano completo de captação e estratégia de marketing em português.

IMPORTANTE: Baseie suas recomendações nas funcionalidades REAIS encontradas no código.

${projectContext}

Crie um plano estruturado com:
1. **Posicionamento e Proposta de Valor** - Baseado nas features reais
2. **Estratégias de Marketing Digital** - Canais e táticas específicas
3. **Copy e Mensagens-Chave** - Textos prontos para usar
4. **Canais de Divulgação** - Onde promover
5. **Estratégia de Conteúdo** - Blog posts, tutoriais sugeridos
6. **Plano de Captação de Recursos** - Se aplicável
7. **Timeline e Marcos**
8. **KPIs e Métricas**

Use markdown e seja criativo e estratégico.`;

    const captacaoResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um estrategista de marketing. Crie estratégias baseadas nas funcionalidades reais do projeto." },
          { role: "user", content: captacaoPrompt }
        ],
      }),
    });

    const captacaoData = await captacaoResponse.json();
    const captacaoContent = captacaoData.choices[0].message.content;
    console.log("✓ Plano de captação gerado");

    await supabase.from("analyses").insert({
      project_id: project.id,
      type: "captacao",
      content: captacaoContent,
    });

    // 3. Melhorias e Features
    console.log("\n=== Gerando sugestões de melhorias ===");
    const melhoriasPrompt = `Você é um arquiteto de software sênior. Analise PROFUNDAMENTE o código fonte do seguinte projeto GitHub e sugira melhorias técnicas ESPECÍFICAS e novas features em português.

IMPORTANTE: Analise o código fonte fornecido linha por linha. Identifique problemas reais, não genéricos.

${projectContext}

Crie um documento estruturado com:
1. **Análise da Arquitetura Atual** - Descreva a estrutura real encontrada
2. **Melhorias Técnicas Recomendadas** - Problemas específicos no código e como resolver
3. **Novas Features Sugeridas** - Baseadas no que já existe
4. **Refatorações Importantes** - Código que precisa ser melhorado
5. **Melhorias de Performance** - Otimizações específicas
6. **Segurança e Qualidade de Código** - Vulnerabilidades encontradas
7. **Roadmap Técnico** (curto, médio e longo prazo)
8. **Estimativas de Esforço**

SEJA ESPECÍFICO. Mencione arquivos e trechos de código quando relevante.
Use markdown e seja técnico mas compreensível.`;

    const melhoriasResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um arquiteto de software sênior. Analise código real e dê feedback específico, não genérico." },
          { role: "user", content: melhoriasPrompt }
        ],
      }),
    });

    const melhoriasData = await melhoriasResponse.json();
    const melhoriasContent = melhoriasData.choices[0].message.content;
    console.log("✓ Sugestões de melhorias geradas");

    await supabase.from("analyses").insert({
      project_id: project.id,
      type: "melhorias",
      content: melhoriasContent,
    });

    console.log("\n=== ANÁLISE CONCLUÍDA COM SUCESSO ===");

    return new Response(
      JSON.stringify({ 
        success: true, 
        projectId: project.id,
        message: "Análise concluída com sucesso",
        stats: {
          filesAnalyzed: allFiles.length,
          sourceCodeExtracted: importantFiles.length,
          contextSize: projectContext.length
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("=== ERRO NA ANÁLISE ===");
    console.error(error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido",
        details: String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
