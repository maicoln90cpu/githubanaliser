import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ProjectContext {
  name: string;
  github_url: string;
  readme?: string;
  structure?: string;
  dependencies?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, message, history, projectContext } = await req.json();

    if (!message || !projectContext) {
      return new Response(
        JSON.stringify({ error: "Message and project context are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context from project data
    const contextParts: string[] = [];
    
    contextParts.push(`## Projeto: ${projectContext.name}`);
    contextParts.push(`GitHub: ${projectContext.github_url}`);
    
    if (projectContext.readme) {
      contextParts.push(`\n## README do Projeto:\n${projectContext.readme}`);
    }
    
    if (projectContext.structure) {
      contextParts.push(`\n## Estrutura do Projeto:\n${projectContext.structure}`);
    }
    
    if (projectContext.dependencies) {
      contextParts.push(`\n## Dependências:\n${projectContext.dependencies}`);
    }

    const projectInfo = contextParts.join("\n");

    // Build messages array
    const messages = [
      {
        role: "system",
        content: `Você é um assistente AI especializado em análise de código e desenvolvimento de software. Você está ajudando um desenvolvedor com o projeto "${projectContext.name}".

Você tem acesso às seguintes informações do projeto:
${projectInfo}

Diretrizes:
- Responda sempre em português brasileiro
- Seja conciso mas completo
- Forneça exemplos de código quando relevante
- Se não tiver certeza sobre algo específico do projeto, diga claramente
- Sugira boas práticas e melhorias quando apropriado
- Use markdown para formatar suas respostas
- Seja amigável e prestativo`
      },
      ...((history || []) as Message[]).map((msg: Message) => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: "user",
        content: message
      }
    ];

    console.log(`[project-chat] Processing message for project ${projectId}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[project-chat] AI API error: ${response.status} ${errorText}`);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantResponse = data.choices?.[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.";

    console.log(`[project-chat] Response generated successfully`);

    return new Response(
      JSON.stringify({ response: assistantResponse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[project-chat] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
