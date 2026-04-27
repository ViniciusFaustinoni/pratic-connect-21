INSERT INTO public.configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES (
  'prazo_instalacao_autovistoria_horas',
  '72',
  'numero',
  'operacional',
  'Prazo máximo (horas) entre a assinatura do contrato com auto-vistoria e a instalação do rastreador. Vencido o prazo sem instalação, a cobertura do veículo é suspensa automaticamente até liberação manual do Coordenador de Monitoramento.',
  true
)
ON CONFLICT (chave) DO NOTHING;

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS liberado_reagendamento_em timestamptz,
  ADD COLUMN IF NOT EXISTS liberado_reagendamento_por uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS liberado_reagendamento_motivo text;

COMMENT ON COLUMN public.contratos.liberado_reagendamento_em IS 'Quando o Coordenador de Monitoramento liberou o associado (suspenso por auto-vistoria sem instalação) para reagendar a vistoria/instalação.';

CREATE OR REPLACE FUNCTION public.fn_reativar_cobertura_pos_instalacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'instalacao'
     AND NEW.status = 'concluida'
     AND COALESCE(OLD.status, '') <> 'concluida'
     AND NEW.veiculo_id IS NOT NULL THEN
    UPDATE public.veiculos
       SET cobertura_suspensa = false,
           cobertura_suspensa_motivo = NULL,
           cobertura_suspensa_em = NULL,
           cobertura_total = true,
           cobertura_roubo_furto = true
     WHERE id = NEW.veiculo_id
       AND cobertura_suspensa = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reativar_cobertura_pos_instalacao ON public.servicos;
CREATE TRIGGER trg_reativar_cobertura_pos_instalacao
AFTER UPDATE ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.fn_reativar_cobertura_pos_instalacao();

CREATE INDEX IF NOT EXISTS idx_veiculos_cobertura_suspensa
  ON public.veiculos (cobertura_suspensa)
  WHERE cobertura_suspensa = true;