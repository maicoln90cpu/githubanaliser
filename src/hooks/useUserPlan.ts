import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface PlanConfig {
  allowed_depths?: string[];
  allowed_analysis_types?: string[];
  allow_economic_mode?: boolean;
  can_export_pdf?: boolean;
  max_tokens_monthly?: number;
}

interface UserPlan {
  planId: string | null;
  planName: string;
  planSlug: string;
  monthlyLimit: number;
  dailyLimit: number;
  monthlyUsage: number;
  dailyUsage: number;
  canAnalyze: boolean;
  limitMessage: string | null;
  isAdmin: boolean;
  // Config fields
  allowedDepths: string[];
  allowedAnalysisTypes: string[];
  allowEconomicMode: boolean;
  canExportPDF: boolean;
  maxTokensMonthly: number | null;
}

// Default values for free plan
const FREE_PLAN_DEFAULTS: PlanConfig = {
  allowed_depths: ['critical'],
  allowed_analysis_types: ['prd', 'divulgacao', 'captacao'],
  allow_economic_mode: false,
  can_export_pdf: false,
  max_tokens_monthly: null,
};

// Default values for paid plans (if not configured)
const PAID_PLAN_DEFAULTS: PlanConfig = {
  allowed_depths: ['critical', 'balanced', 'complete'],
  allowed_analysis_types: ['prd', 'divulgacao', 'captacao', 'seguranca', 'ui_theme', 'ferramentas', 'features', 'documentacao'],
  allow_economic_mode: true,
  can_export_pdf: true,
  max_tokens_monthly: null,
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

        // Admin has unlimited access
        if (isAdmin) {
          // Get usage for display only
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
            canAnalyze: true,
            limitMessage: null,
            isAdmin: true,
            // Admin has all permissions
            allowedDepths: ['critical', 'balanced', 'complete'],
            allowedAnalysisTypes: ['prd', 'divulgacao', 'captacao', 'seguranca', 'ui_theme', 'ferramentas', 'features', 'documentacao'],
            allowEconomicMode: true,
            canExportPDF: true,
            maxTokensMonthly: null,
          });
          setIsLoading(false);
          return;
        }

        // Get user's plan with config
        const { data: planData } = await supabase
          .rpc('get_user_plan', { p_user_id: user.id });

        // Get monthly usage
        const { data: monthlyData } = await supabase
          .rpc('get_user_monthly_usage', { p_user_id: user.id });

        // Get daily usage
        const { data: dailyData } = await supabase
          .rpc('get_user_daily_usage', { p_user_id: user.id });

        const userPlan = planData?.[0];
        const monthlyUsage = monthlyData || 0;
        const dailyUsage = dailyData || 0;

        const monthlyLimit = userPlan?.monthly_analyses || 3;
        const dailyLimit = userPlan?.daily_analyses || 1;

        // Parse config from plan
        const planConfig = userPlan?.plan_config as PlanConfig || {};
        const isFree = userPlan?.plan_slug === 'free';
        const defaults = isFree ? FREE_PLAN_DEFAULTS : PAID_PLAN_DEFAULTS;

        // Check limits
        let canAnalyze = true;
        let limitMessage: string | null = null;

        if (dailyUsage >= dailyLimit) {
          canAnalyze = false;
          limitMessage = `Você atingiu o limite diário de ${dailyLimit} ${dailyLimit === 1 ? 'projeto' : 'projetos'}. Faça upgrade para continuar.`;
        } else if (monthlyUsage >= monthlyLimit) {
          canAnalyze = false;
          limitMessage = `Você atingiu o limite mensal de ${monthlyLimit} projetos. Faça upgrade para continuar.`;
        }

        setPlan({
          planId: userPlan?.plan_id || null,
          planName: userPlan?.plan_name || 'Free',
          planSlug: userPlan?.plan_slug || 'free',
          monthlyLimit,
          dailyLimit,
          monthlyUsage,
          dailyUsage,
          canAnalyze,
          limitMessage,
          isAdmin: false,
          // Config fields with defaults
          allowedDepths: planConfig.allowed_depths || defaults.allowed_depths || ['critical'],
          allowedAnalysisTypes: planConfig.allowed_analysis_types || defaults.allowed_analysis_types || ['prd', 'divulgacao', 'captacao'],
          allowEconomicMode: planConfig.allow_economic_mode ?? defaults.allow_economic_mode ?? false,
          canExportPDF: planConfig.can_export_pdf ?? defaults.can_export_pdf ?? false,
          maxTokensMonthly: planConfig.max_tokens_monthly ?? defaults.max_tokens_monthly ?? null,
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
          canAnalyze: true,
          limitMessage: null,
          isAdmin: false,
          allowedDepths: FREE_PLAN_DEFAULTS.allowed_depths || ['critical'],
          allowedAnalysisTypes: FREE_PLAN_DEFAULTS.allowed_analysis_types || ['prd', 'divulgacao', 'captacao'],
          allowEconomicMode: false,
          canExportPDF: false,
          maxTokensMonthly: null,
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
      const { data: monthlyData } = await supabase
        .rpc('get_user_monthly_usage', { p_user_id: user.id });
      const { data: dailyData } = await supabase
        .rpc('get_user_daily_usage', { p_user_id: user.id });
      
      if (plan) {
        const monthlyUsage = monthlyData || 0;
        const dailyUsage = dailyData || 0;
        
        // Admin always can analyze
        if (plan.isAdmin) {
          setPlan(prev => prev ? {
            ...prev,
            monthlyUsage,
            dailyUsage,
          } : null);
        } else {
          let canAnalyze = true;
          let limitMessage: string | null = null;

          if (dailyUsage >= plan.dailyLimit) {
            canAnalyze = false;
            limitMessage = `Você atingiu o limite diário de ${plan.dailyLimit} ${plan.dailyLimit === 1 ? 'projeto' : 'projetos'}.`;
          } else if (monthlyUsage >= plan.monthlyLimit) {
            canAnalyze = false;
            limitMessage = `Você atingiu o limite mensal de ${plan.monthlyLimit} projetos.`;
          }

          setPlan(prev => prev ? {
            ...prev,
            monthlyUsage,
            dailyUsage,
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
