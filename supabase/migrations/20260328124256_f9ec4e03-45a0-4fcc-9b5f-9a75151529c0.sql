-- Limpar duplicatas: manter apenas o mais recente por servico_id com status ativo
DELETE FROM public.confirmacoes_agendamento 
WHERE id NOT IN (
  SELECT DISTINCT ON (servico_id) id 
  FROM public.confirmacoes_agendamento 
  WHERE status IN ('enviada', 'aguardando_confirmacao_encaixe', 'aguardando_confirmacao_vespera', 'aguardando_confirmacao_manha')
  ORDER BY servico_id, created_at DESC
)
AND status IN ('enviada', 'aguardando_confirmacao_encaixe', 'aguardando_confirmacao_vespera', 'aguardando_confirmacao_manha');

-- Criar índice único parcial para impedir futuras duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_confirmacoes_agendamento_servico_ativo 
ON public.confirmacoes_agendamento (servico_id) 
WHERE status IN ('enviada', 'aguardando_confirmacao_encaixe', 'aguardando_confirmacao_vespera', 'aguardando_confirmacao_manha');