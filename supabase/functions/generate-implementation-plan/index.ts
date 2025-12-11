import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  projectId: string;
  analysisTypes: string[];
  focusType: 'bugs' | 'features' | 'security' | 'complete';
  title?: string;
}

interface ExtractedItem {
  category: 'critical' | 'implementation' | 'improvement';
  title: string;
  description: string;
  source_analysis: string;
}

const FOCUS_TYPE_LABELS: Record<string, string> = {
  bugs: 'Correções e Bugs',
  features: 'Novas Funcionalidades',
  security: 'Segurança',
  complete: 'Plano Completo',
};

const ANALYSIS_TYPE_LABELS: Record<string, string> = {
  prd: 'PRD',
  divulgacao: 'Marketing & Lançamento',
  captacao: 'Pitch para Investidores',
  seguranca: 'Segurança',
  ui_theme: 'UI/Theme',
  ferramentas: 'Ferramentas',
  features: 'Novas Features',
  documentacao: 'Documentação',
  prompts: 'Prompts Otimizados',
  quality: 'Qualidade de Código',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[generate-implementation-plan] User auth error:', userError);
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { projectId, analysisTypes, focusType, title }: RequestBody = await req.json();

    console.log(`[generate-implementation-plan] Starting for project ${projectId}, focus: ${focusType}, types: ${analysisTypes.join(', ')}`);

    // Validate inputs
    if (!projectId || !analysisTypes || analysisTypes.length === 0) {
      return new Response(JSON.stringify({ error: 'projectId e analysisTypes são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error('[generate-implementation-plan] Project not found:', projectError);
      return new Response(JSON.stringify({ error: 'Projeto não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (project.user_id !== user.id) {
      // Check if admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Acesso negado' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fetch analyses content
    const { data: analyses, error: analysesError } = await supabase
      .from('analyses')
      .select('type, content, created_at')
      .eq('project_id', projectId)
      .in('type', analysisTypes)
      .order('created_at', { ascending: false });

    if (analysesError) {
      console.error('[generate-implementation-plan] Error fetching analyses:', analysesError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar análises' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!analyses || analyses.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma análise encontrada para os tipos selecionados' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get unique analyses (latest version of each type)
    const uniqueAnalyses = new Map<string, { type: string; content: string }>();
    for (const analysis of analyses) {
      if (!uniqueAnalyses.has(analysis.type)) {
        uniqueAnalyses.set(analysis.type, { type: analysis.type, content: analysis.content });
      }
    }

    console.log(`[generate-implementation-plan] Found ${uniqueAnalyses.size} unique analyses`);

    // Build context for AI
    const analysesContext = Array.from(uniqueAnalyses.values())
      .map(a => `### ${ANALYSIS_TYPE_LABELS[a.type] || a.type}\n${a.content.slice(0, 15000)}`)
      .join('\n\n---\n\n');

    // Build focus-specific instructions
    let focusInstructions = '';
    switch (focusType) {
      case 'bugs':
        focusInstructions = `
Foque EXCLUSIVAMENTE em:
- Correções de bugs identificados
- Problemas de código que precisam ser resolvidos
- Erros de lógica ou implementação
- Issues de performance que afetam funcionamento`;
        break;
      case 'features':
        focusInstructions = `
Foque EXCLUSIVAMENTE em:
- Novas funcionalidades sugeridas
- Melhorias de features existentes
- Expansões de capacidades do sistema`;
        break;
      case 'security':
        focusInstructions = `
Foque EXCLUSIVAMENTE em:
- Vulnerabilidades de segurança
- Melhorias de autenticação/autorização
- Proteção de dados sensíveis
- Boas práticas de segurança`;
        break;
      case 'complete':
      default:
        focusInstructions = `
Inclua TODOS os tipos de itens acionáveis:
- Correções críticas e bugs
- Novas implementações necessárias
- Melhorias e otimizações sugeridas`;
    }

    const systemPrompt = `Você é um especialista em análise de projetos de software. Sua tarefa é extrair itens ACIONÁVEIS das análises fornecidas e criar um checklist estruturado de implementação.

REGRAS CRÍTICAS:
1. Extraia APENAS itens que requerem AÇÃO CONCRETA (implementar, corrigir, adicionar, configurar, etc.)
2. NÃO inclua itens que são apenas métricas, estatísticas ou informações descritivas
3. Cada item deve ser uma tarefa clara e específica
4. Categorize cada item como: "critical" (urgente/bloqueador), "implementation" (nova funcionalidade), ou "improvement" (otimização/melhoria)
5. Mantenha títulos concisos (máx 100 caracteres) e descrições detalhadas quando necessário

${focusInstructions}`;

    const userPrompt = `Analise o seguinte conteúdo e extraia TODOS os itens acionáveis para criar um plano de implementação:

${analysesContext}

Retorne usando a função extract_implementation_items com os itens encontrados.`;

    console.log('[generate-implementation-plan] Calling Lovable AI...');

    // Call Lovable AI with tool calling for structured output
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_implementation_items',
              description: 'Extrai itens acionáveis das análises para criar um plano de implementação',
              parameters: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        category: {
                          type: 'string',
                          enum: ['critical', 'implementation', 'improvement'],
                          description: 'Categoria do item: critical (urgente), implementation (nova funcionalidade), improvement (melhoria)',
                        },
                        title: {
                          type: 'string',
                          description: 'Título conciso do item (máximo 100 caracteres)',
                        },
                        description: {
                          type: 'string',
                          description: 'Descrição detalhada do que precisa ser feito',
                        },
                        source_analysis: {
                          type: 'string',
                          description: 'Tipo de análise de onde o item foi extraído (prd, seguranca, etc)',
                        },
                      },
                      required: ['category', 'title', 'source_analysis'],
                    },
                  },
                },
                required: ['items'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'extract_implementation_items' } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[generate-implementation-plan] AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes. Adicione mais créditos ao workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'Erro ao processar com IA' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    console.log('[generate-implementation-plan] AI response received');

    // Extract items from tool call
    let extractedItems: ExtractedItem[] = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        extractedItems = args.items || [];
      } catch (e) {
        console.error('[generate-implementation-plan] Error parsing tool arguments:', e);
      }
    }

    console.log(`[generate-implementation-plan] Extracted ${extractedItems.length} items`);

    // Calculate tokens used (estimate)
    const tokensUsed = aiData.usage?.total_tokens || Math.ceil(analysesContext.length / 4);

    // Create implementation plan
    const planTitle = title || `${FOCUS_TYPE_LABELS[focusType]} - ${project.name}`;
    
    const { data: plan, error: planError } = await supabase
      .from('implementation_plans')
      .insert({
        user_id: user.id,
        project_id: projectId,
        title: planTitle,
        focus_type: focusType,
        analysis_types: analysisTypes,
        tokens_used: tokensUsed,
      })
      .select()
      .single();

    if (planError) {
      console.error('[generate-implementation-plan] Error creating plan:', planError);
      return new Response(JSON.stringify({ error: 'Erro ao criar plano de implementação' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[generate-implementation-plan] Created plan ${plan.id}`);

    // Insert items with sort order by category (critical first, then implementation, then improvement)
    const categoryOrder: Record<string, number> = { critical: 0, implementation: 1, improvement: 2 };
    const sortedItems = extractedItems.sort((a, b) => 
      (categoryOrder[a.category] || 2) - (categoryOrder[b.category] || 2)
    );

    const itemsToInsert = sortedItems.map((item, index) => ({
      plan_id: plan.id,
      category: item.category,
      title: item.title.slice(0, 255),
      description: item.description || null,
      source_analysis: item.source_analysis,
      sort_order: index,
    }));

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from('implementation_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('[generate-implementation-plan] Error inserting items:', itemsError);
        // Don't fail completely, plan was created
      }
    }

    // Track token usage
    await supabase.from('analysis_usage').insert({
      user_id: user.id,
      project_id: projectId,
      analysis_type: 'implementation_plan',
      tokens_estimated: tokensUsed,
      cost_estimated: tokensUsed * 0.000001,
      model_used: 'google/gemini-2.5-flash',
    });

    console.log(`[generate-implementation-plan] Completed successfully with ${itemsToInsert.length} items`);

    return new Response(JSON.stringify({
      success: true,
      plan: {
        id: plan.id,
        title: plan.title,
        focus_type: plan.focus_type,
        tokens_used: tokensUsed,
        items_count: itemsToInsert.length,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-implementation-plan] Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
