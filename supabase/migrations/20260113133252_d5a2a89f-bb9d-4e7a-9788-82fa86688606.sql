-- Reset completo do módulo de vendas para novos testes

-- 1. Limpar históricos e tabelas dependentes primeiro
TRUNCATE TABLE leads_historico CASCADE;
TRUNCATE TABLE contratos_historico CASCADE;
TRUNCATE TABLE notificacoes_vendas CASCADE;
TRUNCATE TABLE distribuicao_historico CASCADE;

-- 2. Limpar contratos (depende de leads e cotações)
TRUNCATE TABLE contratos CASCADE;

-- 3. Limpar cotações (depende de leads)
TRUNCATE TABLE cotacoes CASCADE;

-- 4. Limpar leads (tabela principal)
TRUNCATE TABLE leads CASCADE;

-- 5. Resetar contadores de distribuição
UPDATE distribuicao_vendedores 
SET leads_hoje = 0, total_leads = 0;