-- Corrigir sinistro com cota já paga no Asaas mas não atualizada
UPDATE sinistros
SET 
  cota_paga = true,
  cota_paga_em = NOW(),
  status = 'pecas_em_cotacao',
  updated_at = NOW()
WHERE id = 'a2b1e9b3-6ece-4384-92a1-c6c93eab0f4f'
  AND cota_paga = false;

INSERT INTO sinistro_historico (sinistro_id, status_anterior, status_novo, observacao)
VALUES (
  'a2b1e9b3-6ece-4384-92a1-c6c93eab0f4f',
  'aprovado',
  'pecas_em_cotacao',
  'Pagamento da cota de coparticipação confirmado retroativamente — cobrança RECEIVED no Asaas (pay_qrs9x09ngxnr2xlg)'
);