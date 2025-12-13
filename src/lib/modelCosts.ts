/**
 * Centralized AI model costs configuration
 * All costs are per 1K tokens in USD
 * These are reference values - real costs are calculated from analysis_usage data
 */

export interface ModelCost {
  id: string;
  provider: 'Lovable AI' | 'OpenAI';
  name: string;
  inputPer1K: number;  // USD per 1K input tokens
  outputPer1K: number; // USD per 1K output tokens
  isEconomic?: boolean;
}

// Exchange rate (should ideally be fetched from API)
export const USD_TO_BRL = 5.5;

// Reference costs per model (per 1K tokens in USD)
// These are fallback values when no real data is available
export const MODEL_COSTS: ModelCost[] = [
  // Lovable AI (Gemini)
  { id: 'google/gemini-2.5-flash-lite', provider: 'Lovable AI', name: 'Gemini 2.5 Flash Lite', inputPer1K: 0.000075, outputPer1K: 0.0003, isEconomic: true },
  { id: 'google/gemini-2.5-flash', provider: 'Lovable AI', name: 'Gemini 2.5 Flash', inputPer1K: 0.00015, outputPer1K: 0.0006, isEconomic: false },
  { id: 'google/gemini-2.5-pro', provider: 'Lovable AI', name: 'Gemini 2.5 Pro', inputPer1K: 0.00125, outputPer1K: 0.01, isEconomic: false },
  { id: 'google/gemini-3-pro-preview', provider: 'Lovable AI', name: 'Gemini 3 Pro Preview', inputPer1K: 0.00125, outputPer1K: 0.01, isEconomic: false },
  
  // OpenAI
  { id: 'openai/gpt-5-nano', provider: 'OpenAI', name: 'GPT-5 Nano', inputPer1K: 0.00005, outputPer1K: 0.0004, isEconomic: true },
  { id: 'openai/gpt-4.1-nano', provider: 'OpenAI', name: 'GPT-4.1 Nano', inputPer1K: 0.0001, outputPer1K: 0.0004, isEconomic: true },
  { id: 'openai/gpt-4o-mini', provider: 'OpenAI', name: 'GPT-4o Mini', inputPer1K: 0.00015, outputPer1K: 0.0006, isEconomic: true },
  { id: 'openai/gpt-5-mini', provider: 'OpenAI', name: 'GPT-5 Mini', inputPer1K: 0.00025, outputPer1K: 0.002, isEconomic: false },
  { id: 'openai/gpt-4.1-mini', provider: 'OpenAI', name: 'GPT-4.1 Mini', inputPer1K: 0.0004, outputPer1K: 0.0016, isEconomic: false },
  { id: 'openai/o4-mini', provider: 'OpenAI', name: 'O4 Mini', inputPer1K: 0.0011, outputPer1K: 0.0044, isEconomic: false },
  { id: 'openai/o3', provider: 'OpenAI', name: 'O3', inputPer1K: 0.002, outputPer1K: 0.008, isEconomic: false },
  { id: 'openai/gpt-4.1', provider: 'OpenAI', name: 'GPT-4.1', inputPer1K: 0.002, outputPer1K: 0.008, isEconomic: false },
  { id: 'openai/gpt-5', provider: 'OpenAI', name: 'GPT-5', inputPer1K: 0.00125, outputPer1K: 0.01, isEconomic: false },
  { id: 'openai/gpt-4o', provider: 'OpenAI', name: 'GPT-4o', inputPer1K: 0.0025, outputPer1K: 0.01, isEconomic: false },
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
