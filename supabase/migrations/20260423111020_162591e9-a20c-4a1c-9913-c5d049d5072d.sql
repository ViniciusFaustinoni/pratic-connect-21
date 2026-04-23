-- A. Tabela de histórico de pagamentos SGA
CREATE TABLE public.pagamentos_sga_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id uuid NOT NULL REFERENCES public.associados(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  nosso_numero text NOT NULL,
  status text NOT NULL,
  valor numeric NOT NULL,
  valor_pago numeric NULL,
  data_vencimento date NOT NULL,
  data_pagamento date NULL,
  forma_pagamento text NULL,
  tipo_boleto_hinova text NULL,
  mes_referencia text NULL,
  dados_brutos_sga jsonb NOT NULL,
  primeira_observacao_em timestamptz NOT NULL DEFAULT now(),
  ultima_observacao_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pagamentos_sga_historico_nosso_numero_key UNIQUE (nosso_numero)
);

CREATE INDEX idx_pag_sga_assoc ON public.pagamentos_sga_historico(associado_id, data_vencimento DESC);
CREATE INDEX idx_pag_sga_veic ON public.pagamentos_sga_historico(veiculo_id, data_vencimento DESC);
CREATE INDEX idx_pag_sga_status ON public.pagamentos_sga_historico(status);

ALTER TABLE public.pagamentos_sga_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read pagamentos_sga_historico"
  ON public.pagamentos_sga_historico FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage pagamentos_sga_historico"
  ON public.pagamentos_sga_historico FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- B. Trigger para espelhar cobranças SGA → histórico
CREATE OR REPLACE FUNCTION public.mirror_cobranca_sga_to_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.origem = 'sga_hinova' AND NEW.nosso_numero IS NOT NULL AND NEW.veiculo_id IS NOT NULL THEN
    INSERT INTO public.pagamentos_sga_historico (
      associado_id, veiculo_id, nosso_numero, status, valor, valor_pago,
      data_vencimento, data_pagamento, forma_pagamento, tipo_boleto_hinova,
      mes_referencia, dados_brutos_sga
    ) VALUES (
      NEW.associado_id, NEW.veiculo_id, NEW.nosso_numero, NEW.status, NEW.valor,
      NEW.valor_pago, NEW.data_vencimento, NEW.data_pagamento, NEW.forma_pagamento,
      NEW.tipo_boleto_hinova, NULLIF(split_part(COALESCE(NEW.descricao, ''), ' ', -1), ''),
      COALESCE(NEW.dados_brutos_sga, '{}'::jsonb)
    )
    ON CONFLICT (nosso_numero) DO UPDATE SET
      status = EXCLUDED.status,
      valor = EXCLUDED.valor,
      valor_pago = COALESCE(EXCLUDED.valor_pago, public.pagamentos_sga_historico.valor_pago),
      data_pagamento = COALESCE(EXCLUDED.data_pagamento, public.pagamentos_sga_historico.data_pagamento),
      forma_pagamento = COALESCE(EXCLUDED.forma_pagamento, public.pagamentos_sga_historico.forma_pagamento),
      tipo_boleto_hinova = COALESCE(EXCLUDED.tipo_boleto_hinova, public.pagamentos_sga_historico.tipo_boleto_hinova),
      dados_brutos_sga = EXCLUDED.dados_brutos_sga,
      ultima_observacao_em = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_cobranca_sga ON public.cobrancas;
CREATE TRIGGER trg_mirror_cobranca_sga
  AFTER INSERT OR UPDATE ON public.cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION public.mirror_cobranca_sga_to_historico();

-- C. Backfill inicial (deve retornar 0 hoje, garante consistência futura)
INSERT INTO public.pagamentos_sga_historico (
  associado_id, veiculo_id, nosso_numero, status, valor, valor_pago,
  data_vencimento, data_pagamento, forma_pagamento, tipo_boleto_hinova,
  dados_brutos_sga
)
SELECT 
  associado_id, veiculo_id, nosso_numero, status, valor, valor_pago,
  data_vencimento, data_pagamento, forma_pagamento, tipo_boleto_hinova,
  COALESCE(dados_brutos_sga, '{}'::jsonb)
FROM public.cobrancas
WHERE origem = 'sga_hinova' 
  AND nosso_numero IS NOT NULL
  AND veiculo_id IS NOT NULL
ON CONFLICT (nosso_numero) DO NOTHING;