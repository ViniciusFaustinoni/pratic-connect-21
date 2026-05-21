
ALTER TYPE status_cotacao ADD VALUE IF NOT EXISTS 'cancelada';
ALTER TYPE status_cotacao ADD VALUE IF NOT EXISTS 'liberada';

ALTER TABLE public.cotacoes
  ADD COLUMN IF NOT EXISTS placa_reservada_ate timestamptz,
  ADD COLUMN IF NOT EXISTS cancelada_por uuid,
  ADD COLUMN IF NOT EXISTS categoria_cancelamento text,
  ADD COLUMN IF NOT EXISTS reativada_em timestamptz,
  ADD COLUMN IF NOT EXISTS reativada_por uuid;

UPDATE public.cotacoes SET placa_reservada_ate = created_at + interval '48 hours'
 WHERE placa_reservada_ate IS NULL AND status IN ('rascunho','enviada','aceita');
UPDATE public.cotacoes SET placa_reservada_ate = COALESCE(cancelada_em, updated_at, now())
 WHERE placa_reservada_ate IS NULL;

CREATE INDEX IF NOT EXISTS idx_cotacoes_placa_reserva
  ON public.cotacoes (veiculo_placa, placa_reservada_ate)
  WHERE status IN ('rascunho','enviada','aceita');

CREATE OR REPLACE FUNCTION public.get_config_int(_chave text, _default int)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    NULLIF(regexp_replace((SELECT valor FROM public.configuracoes WHERE chave = _chave LIMIT 1), '[^0-9-]', '', 'g'), '')::int,
    _default
  )
$$;

CREATE OR REPLACE FUNCTION public.fn_cotacoes_renovar_reserva()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_renovacao_h int; v_teto_h int; v_movimentou boolean := false;
BEGIN
  IF NEW.status NOT IN ('rascunho','enviada','aceita') THEN RETURN NEW; END IF;
  IF (NEW.plano_id IS DISTINCT FROM OLD.plano_id)
     OR (NEW.valor_total IS DISTINCT FROM OLD.valor_total)
     OR (NEW.observacoes IS DISTINCT FROM OLD.observacoes)
     OR (NEW.status IS DISTINCT FROM OLD.status)
     OR (NEW.cotacao_publica_token IS DISTINCT FROM OLD.cotacao_publica_token)
  THEN v_movimentou := true; END IF;
  IF NOT v_movimentou THEN RETURN NEW; END IF;
  v_renovacao_h := public.get_config_int('prazo_renovacao_movimentacao_horas', 24);
  v_teto_h := public.get_config_int('prazo_teto_placa_presa_horas', 120);
  NEW.placa_reservada_ate := LEAST(
    now() + make_interval(hours => v_renovacao_h),
    NEW.created_at + make_interval(hours => v_teto_h)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotacoes_renovar_reserva ON public.cotacoes;
CREATE TRIGGER trg_cotacoes_renovar_reserva BEFORE UPDATE ON public.cotacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_cotacoes_renovar_reserva();

CREATE OR REPLACE FUNCTION public.fn_cotacoes_set_terminal_meta()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('cancelada','liberada','expirada','recusada')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.cancelada_em IS NULL THEN NEW.cancelada_em := now(); END IF;
    IF NEW.cancelada_por IS NULL THEN NEW.cancelada_por := auth.uid(); END IF;
    NEW.placa_reservada_ate := now();
  END IF;
  IF OLD.status IN ('cancelada','liberada','expirada','recusada')
     AND NEW.status IN ('rascunho','enviada','aceita') THEN
    NEW.reativada_em := now();
    NEW.reativada_por := auth.uid();
    NEW.cancelada_em := NULL;
    NEW.cancelada_por := NULL;
    NEW.categoria_cancelamento := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotacoes_set_terminal_meta ON public.cotacoes;
CREATE TRIGGER trg_cotacoes_set_terminal_meta BEFORE UPDATE ON public.cotacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_cotacoes_set_terminal_meta();

INSERT INTO public.configuracoes (chave, valor, tipo, categoria, descricao, editavel) VALUES
  ('prazo_placa_presa_horas', '48', 'numero', 'regras_venda', 'Horas que a placa fica reservada ao consultor desde a criação da cotação', true),
  ('prazo_renovacao_movimentacao_horas', '24', 'numero', 'regras_venda', 'Horas de extensão da reserva a cada movimentação relevante do consultor', true),
  ('prazo_teto_placa_presa_horas', '120', 'numero', 'regras_venda', 'Teto máximo absoluto (em horas a partir do created_at) que uma placa pode ficar presa', true),
  ('prazo_alerta_placa_expirando_horas', '12', 'numero', 'regras_venda', 'Quando faltarem N horas para a reserva expirar, o card começa a pulsar', true),
  ('prazo_arquivar_cotacao_morta_dias', '30', 'numero', 'regras_venda', 'Cotações rascunho/enviada/liberada sem movimento por N dias são marcadas como expirada', true)
ON CONFLICT (chave) DO NOTHING;
