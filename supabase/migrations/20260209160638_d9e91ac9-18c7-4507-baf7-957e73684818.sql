-- Corrigir contratos inconsistentes: associado cancelado mas contrato ainda ativo
UPDATE contratos SET status = 'cancelado', data_cancelamento = NOW(), updated_at = NOW()
WHERE associado_id IN (SELECT id FROM associados WHERE status = 'cancelado')
AND status IN ('ativo', 'assinado', 'pendente', 'pendente_assinatura', 'enviado');

-- Corrigir cotações vinculadas a contratos cancelados
UPDATE cotacoes SET status_contratacao = 'cancelado', updated_at = NOW()
WHERE id IN (
  SELECT c.cotacao_id FROM contratos c
  JOIN associados a ON c.associado_id = a.id
  WHERE a.status = 'cancelado' AND c.cotacao_id IS NOT NULL
)
AND status_contratacao IS NOT NULL
AND status_contratacao != 'cancelado';