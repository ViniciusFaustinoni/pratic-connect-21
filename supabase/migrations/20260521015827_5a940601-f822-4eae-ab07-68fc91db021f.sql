-- 1) Drop trigger redundante (mantém função para rollback)
DROP TRIGGER IF EXISTS trg_materializar_servico_vistoria_sub_fipe ON public.vistorias;

COMMENT ON FUNCTION public.fn_materializar_servico_vistoria_sub_fipe()
IS 'DESATIVADA em PR-R1a (race condition com fn_materializar_autovistoria_cotacao). Materialização canônica agora é feita exclusivamente pela edge finalizar-autovistoria-cotacao via fn_materializar_autovistoria_cotacao. Mantida apenas para histórico/rollback.';

-- 2) Índices únicos parciais: 1 serviço vivo por origem
CREATE UNIQUE INDEX IF NOT EXISTS uq_servicos_vistoria_origem_vivo
  ON public.servicos (vistoria_origem_id)
  WHERE vistoria_origem_id IS NOT NULL
    AND dedup_substituido_por IS NULL
    AND status NOT IN ('cancelada','reprovada','aprovada','aprovada_ressalvas','concluida');

CREATE UNIQUE INDEX IF NOT EXISTS uq_servicos_instalacao_origem_vivo
  ON public.servicos (instalacao_origem_id)
  WHERE instalacao_origem_id IS NOT NULL
    AND dedup_substituido_por IS NULL
    AND status NOT IN ('cancelada','reprovada','aprovada','aprovada_ressalvas','concluida');