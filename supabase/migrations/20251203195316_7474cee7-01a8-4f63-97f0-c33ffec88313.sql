-- Adicionar configurações de profundidade de análise
INSERT INTO system_settings (key, value, description) VALUES 
  ('depth_critical_context', '8000', 'Limite de contexto para análise de pontos críticos'),
  ('depth_critical_model', 'google/gemini-2.5-flash-lite', 'Modelo para análise de pontos críticos'),
  ('depth_balanced_context', '20000', 'Limite de contexto para análise balanceada'),
  ('depth_balanced_model', 'google/gemini-2.5-flash-lite', 'Modelo para análise balanceada'),
  ('depth_complete_context', '40000', 'Limite de contexto para análise completa'),
  ('depth_complete_model', 'google/gemini-2.5-flash', 'Modelo para análise completa')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;