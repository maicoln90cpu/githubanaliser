-- Insert README instruction prompt into analysis_prompts table
INSERT INTO public.analysis_prompts (
  analysis_type,
  name,
  description,
  system_prompt,
  user_prompt_template,
  variables_hint,
  is_active,
  version
) VALUES (
  'readme_instruction',
  'Instrução para Atualização de README',
  'Prompt exibido aos usuários para que atualizem o README antes de analisar o projeto',
  'Este prompt é exibido diretamente ao usuário para que ele copie e cole em sua plataforma de desenvolvimento.',
  'Analise meu projeto e atualize completamente o arquivo README.md seguindo esta estrutura:

## Estrutura Obrigatória:

1. **Título e Descrição**
   - Nome do projeto
   - Descrição clara do que faz (2-3 frases)
   - Badges relevantes (status, tecnologias)

2. **Features Principais**
   - Liste as 5-8 funcionalidades mais importantes
   - Use emojis para melhor visualização

3. **Tecnologias Utilizadas**
   - Stack completo (frontend, backend, banco)
   - Versões principais

4. **Como Executar**
   - Pré-requisitos
   - Instalação passo a passo
   - Variáveis de ambiente necessárias

5. **Arquitetura**
   - Estrutura de pastas principal
   - Padrões utilizados

6. **Roadmap** (se houver)
   - Próximas features planejadas

Gere um README profissional e completo baseado no código atual do projeto.',
  '[]'::jsonb,
  true,
  1
) ON CONFLICT (analysis_type) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  user_prompt_template = EXCLUDED.user_prompt_template,
  updated_at = now();