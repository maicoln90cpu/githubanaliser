// Centralized economic model detection
// Models with "lite", "nano", "mini" patterns are considered economic

export const ECONOMIC_MODEL_PATTERNS = [
  'lite',
  'nano', 
  'mini',
  'flash-lite'
];

export const ECONOMIC_MODELS = [
  'google/gemini-2.5-flash-lite',
  'gemini-2.5-flash-lite',
  'gpt-5-nano',
  'gpt-5-mini',
  'gpt-4.1-nano', 
  'gpt-4.1-mini',
  'gpt-4o-mini',
  'o4-mini',
  'openai/gpt-5-nano',
  'openai/gpt-5-mini',
];

/**
 * Check if a model is considered "economic" (cheaper, faster)
 * Economic models include: Flash Lite, Nano, Mini variants
 */
export function isEconomicModel(modelName: string | null | undefined): boolean {
  if (!modelName) return false;
  
  const lowerModel = modelName.toLowerCase();
  
  // Check patterns
  if (ECONOMIC_MODEL_PATTERNS.some(pattern => lowerModel.includes(pattern))) {
    return true;
  }
  
  // Check explicit list
  return ECONOMIC_MODELS.some(model => 
    lowerModel === model.toLowerCase() || 
    lowerModel.includes(model.toLowerCase())
  );
}

/**
 * Get display mode based on model
 */
export function getModelMode(modelName: string | null | undefined): 'economic' | 'detailed' {
  return isEconomicModel(modelName) ? 'economic' : 'detailed';
}
