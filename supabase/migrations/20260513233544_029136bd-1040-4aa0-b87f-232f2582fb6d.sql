
-- 1) Estender a enum status_troca_titularidade com novos estados
ALTER TYPE status_troca_titularidade ADD VALUE IF NOT EXISTS 'expirada';
ALTER TYPE status_troca_titularidade ADD VALUE IF NOT EXISTS 'aguardando_manutencao';

-- 2) Novas colunas em solicitacoes_troca_titularidade
ALTER TABLE public.solicitacoes_troca_titularidade
  ADD COLUMN IF NOT EXISTS tipo_vistoria_troca text
    CHECK (tipo_vistoria_troca IS NULL OR tipo_vistoria_troca IN ('somente_fotos','fotos_com_rastreador','manutencao')),
  ADD COLUMN IF NOT EXISTS instalar_rastreador boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS servico_manutencao_id uuid REFERENCES public.servicos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expirada_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_troca_servico_manutencao ON public.solicitacoes_troca_titularidade(servico_manutencao_id);
CREATE INDEX IF NOT EXISTS idx_troca_expirada_em ON public.solicitacoes_troca_titularidade(expirada_em) WHERE expirada_em IS NOT NULL;

-- 3) Trigger: ao concluir/aprovar serviço de manutenção vinculado a uma troca,
--    devolver a solicitação para 'aguardando_monitoramento' (aprovação final).
CREATE OR REPLACE FUNCTION public.fn_troca_pos_servico_manutencao_concluido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('concluida','aprovada','aprovada_ressalvas')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.solicitacoes_troca_titularidade
       SET status = 'aguardando_monitoramento',
           updated_at = now()
     WHERE servico_manutencao_id = NEW.id
       AND status = 'aguardando_manutencao';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_troca_pos_servico_manutencao_concluido ON public.servicos;
CREATE TRIGGER trg_troca_pos_servico_manutencao_concluido
AFTER UPDATE OF status ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.fn_troca_pos_servico_manutencao_concluido();
