-- Ajuste 1: novo parâmetro configurável para prazo de antiguidade dos comprovantes
INSERT INTO comissoes_parametros (chave, valor, ativo)
VALUES ('migracao_prazo_max_comprovante_meses', '3', true)
ON CONFLICT (chave) DO NOTHING;

-- Ajuste 2: nova coluna para declaração de cancelamento na concorrente
ALTER TABLE solicitacoes_migracao
ADD COLUMN IF NOT EXISTS declaracao_cancelamento_concorrente boolean DEFAULT false;