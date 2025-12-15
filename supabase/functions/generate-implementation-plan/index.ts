import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  projectId: string;
  analysisTypes: string[];
  title?: string;
}

interface ExtractedItem {
  category: 'critical' | 'implementation' | 'improvement';
  title: string;
  description: string;
  source_analysis: string;
}

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
  performance: 'Performance',
};

// Default prompts if not found in database
const DEFAULT_SYSTEM_PROMPT = `Você é um especialista em análise de projetos de software. Sua tarefa é extrair TODOS os itens ACIONÁVEIS das análises fornecidas e criar um checklist estruturado de implementação.

REGRAS CRÍTICAS:
1. Extraia APENAS itens que requerem AÇÃO CONCRETA (implementar, corrigir, adicionar, configurar, etc.)
2. NÃO inclua itens que são apenas métricas, estatísticas ou informações descritivas
3. Cada item deve ser uma tarefa clara e específica
4. Mantenha títulos concisos (máx 100 caracteres) e descrições detalhadas quando necessário

CATEGORIZAÇÃO AUTOMÁTICA:
- "critical": Itens urgentes, bugs graves, vulnerabilidades de segurança, problemas que bloqueiam funcionalidades
- "implementation": Novas funcionalidades, features a implementar, integrações necessárias
- "improvement": Otimizações, melhorias de código, refatorações, melhorias de UX/performance

Analise TODO o conteúdo e extraia TODOS os itens acionáveis, categorizando-os automaticamente.`;

const DEFAULT_USER_PROMPT = `Analise o seguinte conteúdo e extraia TODOS os itens acionáveis para criar um plano de implementação:

{{analysesContent}}

Retorne usando a função extract_implementation_items com os itens encontrados.`;

// Rate limit configuration
const RATE_LIMITS = {
  'generate-implementation-plan': { maxRequests: 10, windowMinutes: 60 },
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

    // ===== RATE LIMITING =====
    const rateLimit = RATE_LIMITS['generate-implementation-plan'];
    const { data: rateLimitResult, error: rateLimitError } = await supabase
      .rpc('check_rate_limit', {
        p_user_id: user.id,
        p_endpoint: 'generate-implementation-plan',
        p_max_requests: rateLimit.maxRequests,
        p_window_minutes: rateLimit.windowMinutes
      });

    if (rateLimitError) {
      console.error("[generate-implementation-plan] Rate limit check error:", rateLimitError);
    } else if (rateLimitResult && !rateLimitResult.allowed) {
      console.log(`[generate-implementation-plan] Rate limited user ${user.id}. Remaining: ${rateLimitResult.remaining}/${rateLimitResult.limit}`);
      return new Response(
        JSON.stringify({
          error: "Limite de requisições excedido",
          message: `Você atingiu o limite de ${rateLimit.maxRequests} planos de implementação por hora. Tente novamente em ${Math.ceil(rateLimitResult.retry_after_seconds / 60)} minutos.`,
          rateLimit: {
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            resetAt: rateLimitResult.reset_at,
            retryAfterSeconds: rateLimitResult.retry_after_seconds
          }
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-RateLimit-Limit": String(rateLimitResult.limit),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
            "X-RateLimit-Reset": rateLimitResult.reset_at,
            "Retry-After": String(rateLimitResult.retry_after_seconds)
          }
        }
      );
    } else if (rateLimitResult) {
      console.log(`[generate-implementation-plan] Rate limit OK for user ${user.id}. Remaining: ${rateLimitResult.remaining}/${rateLimitResult.limit}`);
    }
    // ===== END RATE LIMITING =====

    const { projectId, analysisTypes, title }: RequestBody = await req.json();

    console.log(`[generate-implementation-plan] Starting for project ${projectId}, types: ${analysisTypes.join(', ')}`);

    // Validate inputs
    if (!projectId || !analysisTypes || analysisTypes.length === 0) {
      return new Response(JSON.stringify({ error: 'projectId e analysisTypes são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load prompts from database
    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    let userPromptTemplate = DEFAULT_USER_PROMPT;

    try {
      const { data: promptData, error: promptError } = await supabase
        .from('analysis_prompts')
        .select('system_prompt, user_prompt_template')
        .eq('analysis_type', 'implementation_plan')
        .eq('is_active', true)
        .single();

      if (!promptError && promptData) {
        if (promptData.system_prompt) systemPrompt = promptData.system_prompt;
        if (promptData.user_prompt_template) userPromptTemplate = promptData.user_prompt_template;
        console.log('[generate-implementation-plan] Loaded prompts from database');
      } else {
        console.log('[generate-implementation-plan] Using default prompts (not found in DB)');
      }
    } catch (e) {
      console.log('[generate-implementation-plan] Error loading prompts, using defaults:', e);
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

    // Replace template variables in user prompt
    const userPrompt = userPromptTemplate.replace(/\{\{analysesContent\}\}/g, analysesContext);

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

    // Create implementation plan with auto-generated title
    const analysisLabels = analysisTypes.slice(0, 3).map(t => ANALYSIS_TYPE_LABELS[t] || t).join(', ');
    const planTitle = title || `Plano de Implementação - ${analysisLabels}${analysisTypes.length > 3 ? ` (+${analysisTypes.length - 3})` : ''}`;
    
    const { data: plan, error: planError } = await supabase
      .from('implementation_plans')
      .insert({
        user_id: user.id,
        project_id: projectId,
        title: planTitle,
        focus_type: 'complete', // Always complete now
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
