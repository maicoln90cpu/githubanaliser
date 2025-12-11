-- Adicionar colunas Stripe na tabela plans
ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_product_id text;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- Adicionar colunas Stripe na tabela user_subscriptions
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Atualizar planos existentes com os IDs do Stripe
UPDATE plans SET stripe_product_id = 'prod_Ta8AuHz89KtULl', stripe_price_id = 'price_1ScxuXAsBQPjlm1Hvw2RaHhA' WHERE slug = 'basic';
UPDATE plans SET stripe_product_id = 'prod_Ta8FWbMJDOx7Iz', stripe_price_id = 'price_1ScxyvAsBQPjlm1HZl6Y7y37' WHERE slug = 'pro';

-- Criar índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_plans_stripe_price ON plans(stripe_price_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_customer ON user_subscriptions(stripe_customer_id);