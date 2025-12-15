import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { 
  ANALYSIS_TYPE_SLUGS, 
  LEGACY_ANALYSIS_TYPES, 
  DEPTH_LEVELS,
  type AnalysisTypeSlug,
  type DepthLevel 
} from "@/lib/analysisTypes";

interface PlanConfig {
  allowed_depths?: string[];
  allowed_analysis_types?: string[];
  allow_economic_mode?: boolean;
  can_export_pdf?: boolean;
  max_tokens_monthly?: number;
  limitations?: string[];
}

export interface UserPlan {
  planId: string | null;
  planName: string;
  planSlug: string;
  // Legacy fields (kept for backward compatibility)
  monthlyLimit: number;
  dailyLimit: number;
  monthlyUsage: number;
  dailyUsage: number;
  // Token-based fields
  tokensUsed: number;
  maxTokensMonthly: number | null;
  tokensRemaining: number | null;
  tokensUsedPercent: number;
  // Computed
  canAnalyze: boolean;
  limitMessage: string | null;
  isAdmin: boolean;
  // Config fields
  allowedDepths: string[];
  allowedAnalysisTypes: string[];
  allowEconomicMode: boolean;
  canExportPDF: boolean;
  limitations: string[];
}

// Re-export from centralized definitions
export const ALL_ANALYSIS_TYPES = ANALYSIS_TYPE_SLUGS;
export const ALL_DEPTH_LEVELS = DEPTH_LEVELS;
export { LEGACY_ANALYSIS_TYPES };

// Token estimates per analysis based on depth (for 8 analysis types)
export const TOKEN_ESTIMATES = {
  critical: 2000,    // ~2K tokens per analysis
  balanced: 4000,    // ~4K tokens per analysis
  complete: 8000,    // ~8K tokens per analysis
};

// Estimate total tokens for a full project analysis
export function estimateTokensForAnalysis(
  depth: 'critical' | 'balanced' | 'complete',
  analysisCount: number = 8
): number {
  return TOKEN_ESTIMATES[depth] * analysisCount;
}

// Suggest depth based on remaining tokens
export function suggestDepthByTokens(
  tokensRemaining: number | null,
  analysisCount: number = 8
): 'critical' | 'balanced' | 'complete' {
  if (tokensRemaining === null) return 'complete'; // Unlimited
  
  const completeNeeded = estimateTokensForAnalysis('complete', analysisCount);
  const balancedNeeded = estimateTokensForAnalysis('balanced', analysisCount);
  const criticalNeeded = estimateTokensForAnalysis('critical', analysisCount);
  
  if (tokensRemaining >= completeNeeded) return 'complete';
  if (tokensRemaining >= balancedNeeded) return 'balanced';
  if (tokensRemaining >= criticalNeeded) return 'critical';
  
  return 'critical'; // Minimum
}

// Validate allowed depths against valid options
function validateAllowedDepths(depths: string[] | undefined): string[] {
  if (!depths || !Array.isArray(depths)) return ['critical'];
  return depths.filter(d => ALL_DEPTH_LEVELS.includes(d as any));
}

// Validate allowed analysis types against valid options
function validateAllowedAnalysisTypes(types: string[] | undefined): string[] {
  if (!types || !Array.isArray(types)) return ['prd', 'divulgacao', 'captacao'];
  return types.filter(t => ALL_ANALYSIS_TYPES.includes(t as any));
}

// Default values for free plan
const FREE_PLAN_DEFAULTS: PlanConfig = {
  allowed_depths: ['critical'],
  allowed_analysis_types: ['prd', 'divulgacao', 'captacao'],
  allow_economic_mode: false,
  can_export_pdf: false,
  max_tokens_monthly: 50000, // 50K tokens for free tier
  limitations: ['Apenas análises básicas', 'Profundidade crítica apenas'],
};

// Default values for paid plans (if not configured)
const PAID_PLAN_DEFAULTS: PlanConfig = {
  allowed_depths: ['critical', 'balanced', 'complete'],
  allowed_analysis_types: ALL_ANALYSIS_TYPES as unknown as string[],
  allow_economic_mode: true,
  can_export_pdf: true,
  max_tokens_monthly: null, // Unlimited for paid plans by default
  limitations: [],
};

export const useUserPlan = () => {
  const { user } = useAuth();
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPlan = async () => {
      if (!user) {
        setPlan(null);
        setIsLoading(false);
        return;
      }

      try {
        // Check if user is admin
        const { data: adminRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        const isAdmin = !!adminRole;

        // Get tokens used this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { data: tokensData } = await supabase
          .from("analysis_usage")
          .select("tokens_estimated")
          .eq("user_id", user.id)
          .gte("created_at", startOfMonth.toISOString());
        
        const tokensUsed = tokensData?.reduce((sum, item) => sum + (item.tokens_estimated || 0), 0) || 0;

        // Admin has unlimited access
        if (isAdmin) {
          // Get legacy usage for display
          const { data: monthlyData } = await supabase
            .rpc('get_user_monthly_usage', { p_user_id: user.id });
          const { data: dailyData } = await supabase
            .rpc('get_user_daily_usage', { p_user_id: user.id });

          setPlan({
            planId: null,
            planName: 'Admin',
            planSlug: 'admin',
            monthlyLimit: 999999,
            dailyLimit: 999999,
            monthlyUsage: monthlyData || 0,
            dailyUsage: dailyData || 0,
            tokensUsed,
            maxTokensMonthly: null, // Unlimited
            tokensRemaining: null, // Unlimited
            tokensUsedPercent: 0,
            canAnalyze: true,
            limitMessage: null,
            isAdmin: true,
            allowedDepths: ['critical', 'balanced', 'complete'],
            allowedAnalysisTypes: ALL_ANALYSIS_TYPES as unknown as string[],
            allowEconomicMode: true,
            canExportPDF: true,
            limitations: [],
          });
          setIsLoading(false);
          return;
        }

        // Get user's plan with config
        const { data: planData } = await supabase
          .rpc('get_user_plan', { p_user_id: user.id });

        // Get legacy usage
        const { data: monthlyData } = await supabase
          .rpc('get_user_monthly_usage', { p_user_id: user.id });
        const { data: dailyData } = await supabase
          .rpc('get_user_daily_usage', { p_user_id: user.id });

        const userPlan = planData?.[0];
        const monthlyUsage = monthlyData || 0;
        const dailyUsage = dailyData || 0;

        // Parse config from plan
        const planConfig = userPlan?.plan_config as PlanConfig || {};
        const isFree = userPlan?.plan_slug === 'free';
        const defaults = isFree ? FREE_PLAN_DEFAULTS : PAID_PLAN_DEFAULTS;

        // Get token limit
        const maxTokensMonthly = planConfig.max_tokens_monthly ?? defaults.max_tokens_monthly ?? null;
        const tokensRemaining = maxTokensMonthly !== null ? Math.max(0, maxTokensMonthly - tokensUsed) : null;
        const tokensUsedPercent = maxTokensMonthly !== null && maxTokensMonthly > 0 
          ? Math.min((tokensUsed / maxTokensMonthly) * 100, 100) 
          : 0;

        // Check token limits (primary check now)
        let canAnalyze = true;
        let limitMessage: string | null = null;

        if (maxTokensMonthly !== null && tokensUsed >= maxTokensMonthly) {
          canAnalyze = false;
          limitMessage = `Você atingiu o limite de ${(maxTokensMonthly / 1000).toFixed(0)}K tokens mensais. Faça upgrade para continuar.`;
        } else if (tokensRemaining !== null && tokensRemaining < estimateTokensForAnalysis('critical', 1)) {
          canAnalyze = false;
          limitMessage = `Tokens insuficientes para uma análise. Restam apenas ${tokensRemaining.toLocaleString()} tokens.`;
        }

        setPlan({
          planId: userPlan?.plan_id || null,
          planName: userPlan?.plan_name || 'Free',
          planSlug: userPlan?.plan_slug || 'free',
          monthlyLimit: userPlan?.monthly_analyses || 3,
          dailyLimit: userPlan?.daily_analyses || 1,
          monthlyUsage,
          dailyUsage,
          tokensUsed,
          maxTokensMonthly,
          tokensRemaining,
          tokensUsedPercent,
          canAnalyze,
          limitMessage,
          isAdmin: false,
          allowedDepths: validateAllowedDepths(planConfig.allowed_depths || defaults.allowed_depths),
          allowedAnalysisTypes: validateAllowedAnalysisTypes(planConfig.allowed_analysis_types || defaults.allowed_analysis_types),
          allowEconomicMode: planConfig.allow_economic_mode ?? defaults.allow_economic_mode ?? false,
          canExportPDF: planConfig.can_export_pdf ?? defaults.can_export_pdf ?? false,
          limitations: planConfig.limitations || defaults.limitations || [],
        });
      } catch (error) {
        console.error("Erro ao carregar plano:", error);
        // Default to free plan on error
        setPlan({
          planId: null,
          planName: 'Free',
          planSlug: 'free',
          monthlyLimit: 3,
          dailyLimit: 1,
          monthlyUsage: 0,
          dailyUsage: 0,
          tokensUsed: 0,
          maxTokensMonthly: FREE_PLAN_DEFAULTS.max_tokens_monthly || 50000,
          tokensRemaining: FREE_PLAN_DEFAULTS.max_tokens_monthly || 50000,
          tokensUsedPercent: 0,
          canAnalyze: true,
          limitMessage: null,
          isAdmin: false,
          allowedDepths: validateAllowedDepths(FREE_PLAN_DEFAULTS.allowed_depths),
          allowedAnalysisTypes: validateAllowedAnalysisTypes(FREE_PLAN_DEFAULTS.allowed_analysis_types),
          allowEconomicMode: false,
          canExportPDF: false,
          limitations: FREE_PLAN_DEFAULTS.limitations || [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadPlan();
  }, [user]);

  const refreshPlan = async () => {
    setIsLoading(true);
    if (user) {
      // Get tokens used this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { data: tokensData } = await supabase
        .from("analysis_usage")
        .select("tokens_estimated")
        .eq("user_id", user.id)
        .gte("created_at", startOfMonth.toISOString());
      
      const tokensUsed = tokensData?.reduce((sum, item) => sum + (item.tokens_estimated || 0), 0) || 0;
      
      if (plan) {
        const tokensRemaining = plan.maxTokensMonthly !== null 
          ? Math.max(0, plan.maxTokensMonthly - tokensUsed) 
          : null;
        const tokensUsedPercent = plan.maxTokensMonthly !== null && plan.maxTokensMonthly > 0 
          ? Math.min((tokensUsed / plan.maxTokensMonthly) * 100, 100) 
          : 0;

        // Admin always can analyze
        if (plan.isAdmin) {
          setPlan(prev => prev ? {
            ...prev,
            tokensUsed,
            tokensRemaining,
            tokensUsedPercent,
          } : null);
        } else {
          let canAnalyze = true;
          let limitMessage: string | null = null;

          if (plan.maxTokensMonthly !== null && tokensUsed >= plan.maxTokensMonthly) {
            canAnalyze = false;
            limitMessage = `Você atingiu o limite de ${(plan.maxTokensMonthly / 1000).toFixed(0)}K tokens mensais.`;
          } else if (tokensRemaining !== null && tokensRemaining < estimateTokensForAnalysis('critical', 1)) {
            canAnalyze = false;
            limitMessage = `Tokens insuficientes para uma análise.`;
          }

          setPlan(prev => prev ? {
            ...prev,
            tokensUsed,
            tokensRemaining,
            tokensUsedPercent,
            canAnalyze,
            limitMessage,
          } : null);
        }
      }
    }
    setIsLoading(false);
  };

  return { plan, isLoading, refreshPlan };
};
