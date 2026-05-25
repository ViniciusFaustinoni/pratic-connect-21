-- ⚠️ MIGRATION PENDENTE — NÃO APLICAR AINDA ⚠️
--
-- Camada 3 da prevenção de cotação duplicada em Troca de Titularidade:
-- UNIQUE index parcial como rede de segurança final, complementando o
-- trigger BEFORE INSERT (Camada 2) já aplicado.
--
-- Por que está pendente:
-- ----------------------
-- A query de dimensionamento detectou 1 caso legado de duplicado ativo
-- (solicitação 69498d3e-63ba-42d7-8b14-93ccebeae47a — Anderson / KPJ4994):
--
--   cotação A: f3229bbe-d57d-46e1-906d-9182decc59f3 (COT-20260525-162758561-177)
--              status='aceita', tem contrato CTR-20260525193834-SW22SG (assinado)
--   cotação B: 87947f87-2c9e-4393-af59-ef94b9a783dd (COT-20260525-162853543-609)
--              status='enviada', sem contrato (órfã)
--
-- Aplicar este índice ANTES de limpar o legado faria a migration falhar.
--
-- Quando aplicar:
-- ---------------
-- No deploy seguinte, depois que:
--   1) O caso do Anderson e qualquer outro encontrado pela query forem
--      tratados (cancelar a cotação órfã / consolidar manualmente).
--   2) A query abaixo retornar 0 linhas:
--
--      SELECT dados_extras->>'solicitacao_troca_id' AS solicitacao_id,
--             COUNT(*) AS qtd
--      FROM cotacoes
--      WHERE tipo_entrada='troca_titularidade'
--        AND status NOT IN ('cancelada','expirada')
--        AND dados_extras ? 'solicitacao_troca_id'
--      GROUP BY 1
--      HAVING COUNT(*) > 1;
--
-- O que o índice garante:
-- -----------------------
-- Se as Camadas 1 (debounce front) e 2 (trigger BEFORE INSERT) falharem
-- por qualquer motivo (bug em deploy parcial, RPC nova, insert por path
-- diferente), o banco recusa o segundo insert com SQLSTATE 23505.

CREATE UNIQUE INDEX ux_cotacoes_troca_ativa_por_solicitacao
ON public.cotacoes ((dados_extras->>'solicitacao_troca_id'))
WHERE tipo_entrada = 'troca_titularidade'
  AND status NOT IN ('cancelada','expirada')
  AND dados_extras ? 'solicitacao_troca_id';

COMMENT ON INDEX public.ux_cotacoes_troca_ativa_por_solicitacao IS
'Camada 3 (rede de segurança) da prevenção de cotação duplicada em Troca de Titularidade. Complementa o trigger trg_guard_cotacao_troca_idempotente.';
