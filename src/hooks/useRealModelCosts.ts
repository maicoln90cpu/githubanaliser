import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MODEL_COSTS, USD_TO_BRL, DEPTH_TOKEN_ESTIMATES } from '@/lib/modelCosts';

/**
 * Validates if cost data is realistic (not corrupted by old bug)
 * Returns false if cost per 1M tokens > $0.50 (unrealistic for any model)
 */
export function isValidCostData(cost: number | null, tokens: number | null): boolean {
  if (!cost || !tokens || tokens === 0) return false;
  const costPer1M = (cost / tokens) * 1_000_000;
  // Max realistic cost is ~$0.50/1M tokens (GPT-5 output is ~$0.015/1K = $15/1M)
  // But our corrupted data shows $18+/1M which is clearly wrong
  return costPer1M < 0.50;
}

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
  getRealCostPer1M: (modelId: string) => number;
  getEstimatedCost: (modelId: string, tokens?: number) => number;
  getEstimatedCostBRL: (modelId: string, tokens?: number) => string;
  getDepthCost: (depth: 'critical' | 'balanced' | 'complete', modelId: string) => number;
  getDepthCostBRL: (depth: 'critical' | 'balanced' | 'complete', modelId: string) => string;
  getRealDepthTokens: (depth: 'critical' | 'balanced' | 'complete') => number;
  
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch real model costs from analysis_usage data
 * Falls back to reference costs when no real data available
 * Filters out corrupted historical data automatically
 */
export function useRealModelCosts(): UseRealModelCostsResult {
  const [modelStats, setModelStats] = useState<RealModelStats[]>([]);
  const [depthStats, setDepthStats] = useState<RealDepthStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);

  const fetchRealCosts = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch model stats, excluding legacy corrupted data
      const { data: modelData } = await supabase
        .from('analysis_usage')
        .select('model_used, cost_estimated, tokens_estimated, is_legacy_cost')
        .or('is_legacy_cost.is.null,is_legacy_cost.eq.false');
      
      if (modelData && modelData.length > 0) {
        // Additional filter for any data not yet marked as legacy
        const validData = modelData.filter(row => 
          !row.is_legacy_cost && isValidCostData(row.cost_estimated, row.tokens_estimated)
        );
        
        if (validData.length > 0) {
          setHasRealData(true);
          
          // Aggregate by model
          const byModel: Record<string, { cost: number; tokens: number; count: number }> = {};
          validData.forEach(row => {
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
      }

      // Fetch depth stats, excluding legacy corrupted data
      const { data: depthData } = await supabase
        .from('analysis_usage')
        .select('depth_level, cost_estimated, tokens_estimated, is_legacy_cost')
        .or('is_legacy_cost.is.null,is_legacy_cost.eq.false');

      if (depthData && depthData.length > 0) {
        // Additional filter for any data not yet marked as legacy
        const validDepthData = depthData.filter(row => 
          !row.is_legacy_cost && isValidCostData(row.cost_estimated, row.tokens_estimated)
        );
        
        const byDepth: Record<string, { cost: number; tokens: number; count: number }> = {};
        validDepthData.forEach(row => {
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
    // Fallback to reference cost (inputPer1K + outputPer1K already in $/1K)
    const refModel = MODEL_COSTS.find(m => m.id === modelId);
    if (refModel) {
      return (refModel.inputPer1K + refModel.outputPer1K) / 2;
    }
    return 0.001; // Default fallback
  }, [modelStats]);

  // Get real cost per 1M tokens (standardized for display)
  const getRealCostPer1M = useCallback((modelId: string): number => {
    return getRealCostPer1K(modelId) * 1000;
  }, [getRealCostPer1K]);

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

  // Get real depth tokens from database, fallback to DEPTH_TOKEN_ESTIMATES
  const getRealDepthTokens = useCallback((depth: 'critical' | 'balanced' | 'complete'): number => {
    const realDepth = depthStats.find(d => d.depth === depth);
    if (realDepth && realDepth.avgTokens > 0) {
      return realDepth.avgTokens;
    }
    return DEPTH_TOKEN_ESTIMATES[depth];
  }, [depthStats]);

  // Get depth cost estimate for a model
  const getDepthCost = useCallback((
    depth: 'critical' | 'balanced' | 'complete', 
    modelId: string
  ): number => {
    const tokens = getRealDepthTokens(depth);
    return getEstimatedCost(modelId, tokens);
  }, [getRealDepthTokens, getEstimatedCost]);

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
    getRealCostPer1M,
    getEstimatedCost,
    getEstimatedCostBRL,
    getDepthCost,
    getDepthCostBRL,
    getRealDepthTokens,
    refresh: fetchRealCosts,
  };
}
