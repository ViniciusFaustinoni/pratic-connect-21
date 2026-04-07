-- Atualizar cron da manhã para 7h Brasília (10h UTC)
SELECT cron.alter_job(19, schedule := '0 10 * * 1-6');

-- Desativar modo manual de rotas
UPDATE configuracoes SET valor = 'false', updated_at = now() WHERE chave = 'atribuicao_manual_rotas';