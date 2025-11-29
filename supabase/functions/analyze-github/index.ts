import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { githubUrl } = await req.json();
    console.log("Analisando projeto:", githubUrl);

    if (!githubUrl) {
      throw new Error("URL do GitHub não fornecida");
    }

    // Extrair informações da URL
    const urlParts = githubUrl.replace(/\/$/, "").split("/");
    const owner = urlParts[urlParts.length - 2];
    const repo = urlParts[urlParts.length - 1];
    const projectName = repo;

    console.log(`Owner: ${owner}, Repo: ${repo}`);

    // Buscar informações do GitHub
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "GitAnalyzer",
      },
    });

    if (!repoResponse.ok) {
      throw new Error("Repositório não encontrado no GitHub");
    }

    const repoData = await repoResponse.json();

    // Buscar README
    let readmeContent = "";
    try {
      const readmeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "GitAnalyzer",
        },
      });
      if (readmeResponse.ok) {
        const readmeData = await readmeResponse.json();
        readmeContent = atob(readmeData.content);
      }
    } catch (e) {
      console.log("README não encontrado");
    }

    // Buscar estrutura de arquivos
    const contentsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "GitAnalyzer",
      },
    });

    let fileStructure = "";
    if (contentsResponse.ok) {
      const contents = await contentsResponse.json();
      fileStructure = contents.map((item: any) => `${item.type}: ${item.name}`).join("\n");
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

    console.log("Projeto salvo:", project.id);

    // Preparar contexto para IA
    const projectContext = `
Projeto: ${projectName}
Descrição: ${repoData.description || "Sem descrição"}
Linguagem principal: ${repoData.language || "Não especificada"}
Stars: ${repoData.stargazers_count}
Forks: ${repoData.forks_count}

README:
${readmeContent.substring(0, 3000)}

Estrutura de arquivos:
${fileStructure}
`;

    // Chamar Lovable AI para gerar as 3 análises
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // 1. Análise PRD
    console.log("Gerando análise PRD...");
    const prdPrompt = `Você é um analista de produtos técnico. Analise o seguinte projeto GitHub e crie um PRD (Product Requirements Document) completo e profissional em português.

${projectContext}

Crie um documento estruturado com:
1. Visão Geral do Produto
2. Objetivos e Metas
3. Público-Alvo
4. Arquitetura Técnica
5. Funcionalidades Principais
6. Requisitos Técnicos
7. Riscos e Mitigações
8. Métricas de Sucesso

Use markdown para formatação e seja detalhado e profissional.`;

    const prdResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um analista de produtos sênior especializado em documentação técnica." },
          { role: "user", content: prdPrompt }
        ],
      }),
    });

    if (!prdResponse.ok) {
      throw new Error(`Erro na API Lovable: ${prdResponse.status}`);
    }

    const prdData = await prdResponse.json();
    const prdContent = prdData.choices[0].message.content;

    // Salvar análise PRD
    await supabase.from("analyses").insert({
      project_id: project.id,
      type: "prd",
      content: prdContent,
    });

    // 2. Plano de Captação
    console.log("Gerando plano de captação...");
    const captacaoPrompt = `Você é um especialista em marketing e captação de recursos. Analise o seguinte projeto GitHub e crie um plano completo de captação e estratégia de marketing em português.

${projectContext}

Crie um plano estruturado com:
1. Posicionamento e Proposta de Valor
2. Estratégias de Marketing Digital
3. Copy e Mensagens-Chave
4. Canais de Divulgação
5. Estratégia de Conteúdo
6. Plano de Captação de Recursos
7. Timeline e Marcos
8. KPIs e Métricas

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
          { role: "system", content: "Você é um estrategista de marketing e especialista em captação." },
          { role: "user", content: captacaoPrompt }
        ],
      }),
    });

    const captacaoData = await captacaoResponse.json();
    const captacaoContent = captacaoData.choices[0].message.content;

    await supabase.from("analyses").insert({
      project_id: project.id,
      type: "captacao",
      content: captacaoContent,
    });

    // 3. Melhorias e Features
    console.log("Gerando sugestões de melhorias...");
    const melhoriasPrompt = `Você é um arquiteto de software sênior. Analise o seguinte projeto GitHub e sugira melhorias técnicas e novas features em português.

${projectContext}

Crie um documento estruturado com:
1. Análise da Arquitetura Atual
2. Melhorias Técnicas Recomendadas
3. Novas Features Sugeridas
4. Refatorações Importantes
5. Melhorias de Performance
6. Segurança e Qualidade de Código
7. Roadmap Técnico (curto, médio e longo prazo)
8. Estimativas de Esforço

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
          { role: "system", content: "Você é um arquiteto de software sênior especializado em melhoria de sistemas." },
          { role: "user", content: melhoriasPrompt }
        ],
      }),
    });

    const melhoriasData = await melhoriasResponse.json();
    const melhoriasContent = melhoriasData.choices[0].message.content;

    await supabase.from("analyses").insert({
      project_id: project.id,
      type: "melhorias",
      content: melhoriasContent,
    });

    console.log("Análises concluídas com sucesso!");

    return new Response(
      JSON.stringify({ 
        success: true, 
        projectId: project.id,
        message: "Análise concluída com sucesso"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro na análise:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido",
        details: error
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
