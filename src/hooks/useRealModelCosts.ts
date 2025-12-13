import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MODEL_COSTS, USD_TO_BRL, DEPTH_TOKEN_ESTIMATES } from '@/lib/modelCosts';

export interface RealModelStats {
  modelId: string;
  modelName: string;
  provider: 'Lovable AI' | 'OpenAI';
  avgCost: number;  // USD
  avgTokens: number;
  count: number;
  costPer1K: number; // USD per 1K tokens (calculated from real data)
}

export interface RealDepthStats {
  depth: string;
  avgCost: number;
  avgTokens: number;
  count: number;
}

export interface UseRealModelCostsResult {
  modelStats: RealModelStats[];
  depthStats: RealDepthStats[];
  loading: boolean;
  hasRealData: boolean;
  
  // Helper functions
  getRealCostPer1K: (modelId: string) => number;
  getEstimatedCost: (modelId: string, tokens?: number) => number;
  getEstimatedCostBRL: (modelId: string, tokens?: number) => string;
  getDepthCost: (depth: 'critical' | 'balanced' | 'complete', modelId: string) => number;
  getDepthCostBRL: (depth: 'critical' | 'balanced' | 'complete', modelId: string) => string;
  
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch real model costs from analysis_usage data
 * Falls back to reference costs when no real data available
 */
export function useRealModelCosts(): UseRealModelCostsResult {
  const [modelStats, setModelStats] = useState<RealModelStats[]>([]);
  const [depthStats, setDepthStats] = useState<RealDepthStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);

  const fetchRealCosts = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch model stats
      const { data: modelData } = await supabase
        .from('analysis_usage')
        .select('model_used, cost_estimated, tokens_estimated');
      
      if (modelData && modelData.length > 0) {
        setHasRealData(true);
        
        // Aggregate by model
        const byModel: Record<string, { cost: number; tokens: number; count: number }> = {};
        modelData.forEach(row => {
          const model = row.model_used || 'unknown';
          if (!byModel[model]) {
            byModel[model] = { cost: 0, tokens: 0, count: 0 };
          }
          byModel[model].cost += row.cost_estimated || 0;
          byModel[model].tokens += row.tokens_estimated || 0;
          byModel[model].count += 1;
        });

        const stats: RealModelStats[] = Object.entries(byModel).map(([modelId, data]) => {
          const refModel = MODEL_COSTS.find(m => m.id === modelId);
          const avgCost = data.count > 0 ? data.cost / data.count : 0;
          const avgTokens = data.count > 0 ? data.tokens / data.count : 0;
          const costPer1K = data.tokens > 0 ? (data.cost / data.tokens) * 1000 : 0;
          
          return {
            modelId,
            modelName: refModel?.name || modelId.split('/').pop() || modelId,
            provider: refModel?.provider || (modelId.includes('openai') ? 'OpenAI' : 'Lovable AI'),
            avgCost,
            avgTokens,
            count: data.count,
            costPer1K,
          };
        });

        setModelStats(stats.sort((a, b) => a.costPer1K - b.costPer1K));
      }

      // Fetch depth stats
      const { data: depthData } = await supabase
        .from('analysis_usage')
        .select('depth_level, cost_estimated, tokens_estimated');

      if (depthData && depthData.length > 0) {
        const byDepth: Record<string, { cost: number; tokens: number; count: number }> = {};
        depthData.forEach(row => {
          const depth = row.depth_level || 'balanced';
          if (!byDepth[depth]) {
            byDepth[depth] = { cost: 0, tokens: 0, count: 0 };
          }
          byDepth[depth].cost += row.cost_estimated || 0;
          byDepth[depth].tokens += row.tokens_estimated || 0;
          byDepth[depth].count += 1;
        });

        const dStats: RealDepthStats[] = Object.entries(byDepth).map(([depth, data]) => ({
          depth,
          avgCost: data.count > 0 ? data.cost / data.count : 0,
          avgTokens: data.count > 0 ? data.tokens / data.count : 0,
          count: data.count,
        }));

        setDepthStats(dStats);
      }
    } catch (error) {
      console.error('Error fetching real costs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRealCosts();
  }, [fetchRealCosts]);

  // Get real cost per 1K tokens for a model, falling back to reference
  const getRealCostPer1K = useCallback((modelId: string): number => {
    const realStats = modelStats.find(m => m.modelId === modelId);
    if (realStats && realStats.costPer1K > 0) {
      return realStats.costPer1K;
    }
    // Fallback to reference cost
    const refModel = MODEL_COSTS.find(m => m.id === modelId);
    if (refModel) {
      return (refModel.inputPer1K + refModel.outputPer1K) / 2 * 1000;
    }
    return 0.001; // Default fallback
  }, [modelStats]);

  // Estimate cost for given tokens
  const getEstimatedCost = useCallback((modelId: string, tokens: number = 4000): number => {
    const costPer1K = getRealCostPer1K(modelId);
    return (tokens / 1000) * costPer1K;
  }, [getRealCostPer1K]);

  // Get estimated cost formatted as BRL
  const getEstimatedCostBRL = useCallback((modelId: string, tokens: number = 4000): string => {
    const cost = getEstimatedCost(modelId, tokens);
    const costBRL = cost * USD_TO_BRL;
    if (costBRL < 0.01) {
      return `R$ ${costBRL.toFixed(4)}`;
    }
    return `R$ ${costBRL.toFixed(2)}`;
  }, [getEstimatedCost]);

  // Get depth cost estimate for a model
  const getDepthCost = useCallback((
    depth: 'critical' | 'balanced' | 'complete', 
    modelId: string
  ): number => {
    // First try to get real average tokens for this depth
    const realDepth = depthStats.find(d => d.depth === depth);
    const tokens = realDepth?.avgTokens || DEPTH_TOKEN_ESTIMATES[depth];
    return getEstimatedCost(modelId, tokens);
  }, [depthStats, getEstimatedCost]);

  // Get depth cost formatted as BRL
  const getDepthCostBRL = useCallback((
    depth: 'critical' | 'balanced' | 'complete', 
    modelId: string
  ): string => {
    const cost = getDepthCost(depth, modelId);
    const costBRL = cost * USD_TO_BRL;
    if (costBRL < 0.01) {
      return `R$ ${costBRL.toFixed(4)}`;
    }
    return `R$ ${costBRL.toFixed(2)}`;
  }, [getDepthCost]);

  return {
    modelStats,
    depthStats,
    loading,
    hasRealData,
    getRealCostPer1K,
    getEstimatedCost,
    getEstimatedCostBRL,
    getDepthCost,
    getDepthCostBRL,
    refresh: fetchRealCosts,
  };
}
