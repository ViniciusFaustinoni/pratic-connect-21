-- Data fix: cotação COT-20260515-151921850-984 (Marcus Vinicius Faustinoni)
-- A autovistoria 09ba46f9 ficou sem contrato_id, o que impede a aparição na
-- fila "Aprovação de Associados" (gate cadastro_aprovado precisa do contrato).
-- Vinculamos ao contrato correto para destravar o fluxo.
UPDATE public.vistorias
   SET contrato_id = '04be8909-fd6c-44e6-bf4d-143bffca4f25',
       cotacao_id  = COALESCE(cotacao_id, '6ce7cf72-542d-4474-9328-c5a8c586f4d3'),
       updated_at  = now()
 WHERE id = '09ba46f9-908a-4d29-b54f-589639d9d6d7'
   AND contrato_id IS NULL;