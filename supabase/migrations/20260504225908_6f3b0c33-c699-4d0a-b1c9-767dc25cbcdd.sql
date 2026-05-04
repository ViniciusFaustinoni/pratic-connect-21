
CREATE OR REPLACE VIEW public.vw_cotacoes_em_limbo AS
SELECT
  c.id              AS cotacao_id,
  c.numero          AS cotacao_numero,
  c.tipo_entrada    AS cotacao_tipo_entrada,
  ct.associado_id,
  c.valor_adesao,
  c.vistoria_data_agendada,
  c.vistoria_periodo,
  c.vistoria_endereco_logradouro,
  c.vistoria_endereco_cidade,
  ct.id             AS contrato_id,
  ct.numero         AS contrato_numero,
  ct.data_assinatura,
  ct.adesao_paga,
  ct.aprovado_em,
  ct.status         AS contrato_status
FROM public.contratos ct
JOIN public.cotacoes  c ON c.id = ct.cotacao_id
WHERE ct.data_assinatura IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.instalacoes i WHERE i.cotacao_id = c.id);

COMMENT ON VIEW public.vw_cotacoes_em_limbo IS
  'Cotações com contrato assinado mas sem instalação criada — detecta fluxos de Inclusão/Adesão presos em limbo.';

CREATE OR REPLACE FUNCTION public.trg_inclusao_isenta_auto_instalacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cotacao record;
BEGIN
  IF NEW.data_assinatura IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.data_assinatura IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.cotacao_id IS NULL THEN RETURN NEW; END IF;

  SELECT id, tipo_entrada, vistoria_data_agendada, valor_adesao
    INTO v_cotacao
  FROM public.cotacoes WHERE id = NEW.cotacao_id;

  IF v_cotacao IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(v_cotacao.tipo_entrada, '') NOT IN ('inclusao','adesao','nova') THEN RETURN NEW; END IF;
  IF COALESCE(NEW.valor_adesao, v_cotacao.valor_adesao, 0) > 0 THEN RETURN NEW; END IF;
  IF v_cotacao.vistoria_data_agendada IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (SELECT 1 FROM public.instalacoes WHERE cotacao_id = v_cotacao.id) THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/criar-instalacao-pos-pagamento',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI'
    ),
    body := jsonb_build_object(
      'cotacaoId', v_cotacao.id,
      'skipPaymentCheck', true,
      'source', 'trg_inclusao_isenta_auto_instalacao'
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_inclusao_isenta_auto_instalacao falhou para contrato %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inclusao_isenta_auto_instalacao ON public.contratos;
CREATE TRIGGER trg_inclusao_isenta_auto_instalacao
AFTER INSERT OR UPDATE OF data_assinatura ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.trg_inclusao_isenta_auto_instalacao();
