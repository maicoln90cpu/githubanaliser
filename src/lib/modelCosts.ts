/**
 * Centralized AI model costs configuration
 * All costs are stored per 1K tokens in USD (for calculation precision)
 * Display should use per 1M tokens for consistency
 */

export interface ModelCost {
  id: string;
  provider: 'Lovable AI' | 'OpenAI';
  name: string;
  inputPer1K: number;  // USD per 1K input tokens
  outputPer1K: number; // USD per 1K output tokens
  inputPer1M: number;  // USD per 1M input tokens (derived)
  outputPer1M: number; // USD per 1M output tokens (derived)
  isEconomic?: boolean;
}

// Exchange rate (should ideally be fetched from API)
export const USD_TO_BRL = 5.5;

// Helper to create model with derived 1M values
function createModel(
  id: string, 
  provider: 'Lovable AI' | 'OpenAI', 
  name: string, 
  inputPer1K: number, 
  outputPer1K: number, 
  isEconomic?: boolean
): ModelCost {
  return {
    id,
    provider,
    name,
    inputPer1K,
    outputPer1K,
    inputPer1M: inputPer1K * 1000,
    outputPer1M: outputPer1K * 1000,
    isEconomic,
  };
}

// Reference costs per model (per 1K tokens in USD)
// These are fallback values when no real data is available
export const MODEL_COSTS: ModelCost[] = [
  // Lovable AI (Gemini)
  createModel('google/gemini-2.5-flash-lite', 'Lovable AI', 'Gemini 2.5 Flash Lite', 0.000075, 0.0003, true),
  createModel('google/gemini-2.5-flash', 'Lovable AI', 'Gemini 2.5 Flash', 0.00015, 0.0006, false),
  createModel('google/gemini-2.5-pro', 'Lovable AI', 'Gemini 2.5 Pro', 0.00125, 0.01, false),
  createModel('google/gemini-3-pro-preview', 'Lovable AI', 'Gemini 3 Pro Preview', 0.00125, 0.01, false),
  
  // OpenAI
  createModel('openai/gpt-5-nano', 'OpenAI', 'GPT-5 Nano', 0.00005, 0.0004, true),
  createModel('openai/gpt-4.1-nano', 'OpenAI', 'GPT-4.1 Nano', 0.0001, 0.0004, true),
  createModel('openai/gpt-4o-mini', 'OpenAI', 'GPT-4o Mini', 0.00015, 0.0006, true),
  createModel('openai/gpt-5-mini', 'OpenAI', 'GPT-5 Mini', 0.00025, 0.002, false),
  createModel('openai/gpt-4.1-mini', 'OpenAI', 'GPT-4.1 Mini', 0.0004, 0.0016, false),
  createModel('openai/o4-mini', 'OpenAI', 'O4 Mini', 0.0011, 0.0044, false),
  createModel('openai/o3', 'OpenAI', 'O3', 0.002, 0.008, false),
  createModel('openai/gpt-4.1', 'OpenAI', 'GPT-4.1', 0.002, 0.008, false),
  createModel('openai/gpt-5', 'OpenAI', 'GPT-5', 0.00125, 0.01, false),
  createModel('openai/gpt-4o', 'OpenAI', 'GPT-4o', 0.0025, 0.01, false),
];

// Model options grouped by provider (for Select components)
export const MODEL_OPTIONS = [
  { 
    group: 'Lovable AI', 
    badge: '🟢',
    options: MODEL_COSTS.filter(m => m.provider === 'Lovable AI').map(m => ({
      value: m.id,
      label: m.name,
    }))
  },
  { 
    group: 'OpenAI', 
    badge: '🔵',
    options: MODEL_COSTS.filter(m => m.provider === 'OpenAI').map(m => ({
      value: m.id,
      label: m.name,
    }))
  },
];

/**
 * Get model cost by ID
 */
export function getModelCost(modelId: string): ModelCost | undefined {
  return MODEL_COSTS.find(m => m.id === modelId);
}

/**
 * Calculate estimated cost per analysis for a model
 * @param modelId Model identifier
 * @param estimatedTokens Estimated total tokens (input + output)
 * @param inputOutputRatio Ratio of input to output tokens (default 0.5 = equal)
 * @returns Cost in USD
 */
export function estimateAnalysisCost(
  modelId: string, 
  estimatedTokens: number = 4000,
  inputOutputRatio: number = 0.5
): number {
  const model = getModelCost(modelId);
  if (!model) return 0;
  
  const inputTokens = estimatedTokens * inputOutputRatio;
  const outputTokens = estimatedTokens * (1 - inputOutputRatio);
  
  return ((inputTokens / 1000) * model.inputPer1K) + ((outputTokens / 1000) * model.outputPer1K);
}

/**
 * Format cost as currency string
 */
export function formatCostBRL(costUSD: number): string {
  const costBRL = costUSD * USD_TO_BRL;
  if (costBRL < 0.01) {
    return `R$ ${costBRL.toFixed(4)}`;
  }
  return `R$ ${costBRL.toFixed(2)}`;
}

export function formatCostUSD(costUSD: number): string {
  if (costUSD < 0.01) {
    return `$${costUSD.toFixed(4)}`;
  }
  return `$${costUSD.toFixed(2)}`;
}

/**
 * Format cost per 1M tokens for display (standardized)
 * @param costPer1K Cost per 1K tokens in USD
 * @returns Formatted string like "$0.75/1M" or "$10.00/1M"
 */
export function formatCostPer1M(costPer1K: number): string {
  const costPer1M = costPer1K * 1000;
  if (costPer1M < 0.01) {
    return `$${costPer1M.toFixed(4)}/1M`;
  }
  if (costPer1M < 1) {
    return `$${costPer1M.toFixed(2)}/1M`;
  }
  return `$${costPer1M.toFixed(2)}/1M`;
}

/**
 * Format cost per 1M tokens in BRL
 */
export function formatCostPer1MBRL(costPer1K: number): string {
  const costPer1M = costPer1K * 1000 * USD_TO_BRL;
  if (costPer1M < 0.01) {
    return `R$ ${costPer1M.toFixed(4)}/1M`;
  }
  if (costPer1M < 1) {
    return `R$ ${costPer1M.toFixed(2)}/1M`;
  }
  return `R$ ${costPer1M.toFixed(2)}/1M`;
}

/**
 * Get provider badge emoji
 */
export function getProviderBadge(modelId: string): string {
  const model = getModelCost(modelId);
  return model?.provider === 'OpenAI' ? '🔵' : '🟢';
}

/**
 * Token estimates per depth level (for a single analysis)
 * These should match real-world averages from analysis_usage data
 */
export const DEPTH_TOKEN_ESTIMATES = {
  critical: 8000,   // ~8K tokens per analysis
  balanced: 15000,  // ~15K tokens per analysis  
  complete: 25000,  // ~25K tokens per analysis
};

/**
 * Estimate cost for a depth level with a specific model
 */
export function estimateDepthCost(
  depth: 'critical' | 'balanced' | 'complete',
  modelId: string
): number {
  const tokens = DEPTH_TOKEN_ESTIMATES[depth];
  return estimateAnalysisCost(modelId, tokens);
}
