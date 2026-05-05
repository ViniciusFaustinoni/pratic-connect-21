
CREATE TABLE public.cobranca_csv_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo text NOT NULL,
  total_boletos integer NOT NULL DEFAULT 0,
  total_associados integer NOT NULL DEFAULT 0,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  total_enviados integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo',
  criado_por uuid,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cobranca_csv_boletos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.cobranca_csv_lotes(id) ON DELETE CASCADE,
  matricula text NOT NULL,
  nome text NOT NULL,
  placa text,
  vencimento text NOT NULL,
  linha_digitavel text NOT NULL,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente_envio',
  telefones jsonb,
  enviado_em timestamptz,
  recuperado_em timestamptz,
  recuperado_no_lote_id uuid REFERENCES public.cobranca_csv_lotes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_csv_boletos_lote ON public.cobranca_csv_boletos(lote_id);
CREATE INDEX idx_csv_boletos_matricula ON public.cobranca_csv_boletos(matricula);
CREATE INDEX idx_csv_boletos_linha ON public.cobranca_csv_boletos(linha_digitavel);
CREATE INDEX idx_csv_boletos_status ON public.cobranca_csv_boletos(status);
CREATE INDEX idx_csv_boletos_recuperado ON public.cobranca_csv_boletos(recuperado_em) WHERE status = 'recuperado';
CREATE INDEX idx_csv_lotes_status ON public.cobranca_csv_lotes(status, created_at DESC);

ALTER TABLE public.cobranca_csv_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_csv_boletos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_select_lotes" ON public.cobranca_csv_lotes
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'cobrancas.disparar_lote') OR public.has_permission(auth.uid(), 'cobrancas.ver'));

CREATE POLICY "fin_insert_lotes" ON public.cobranca_csv_lotes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'cobrancas.disparar_lote'));

CREATE POLICY "fin_update_lotes" ON public.cobranca_csv_lotes
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'cobrancas.disparar_lote'));

CREATE POLICY "fin_select_boletos" ON public.cobranca_csv_boletos
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'cobrancas.disparar_lote') OR public.has_permission(auth.uid(), 'cobrancas.ver'));

CREATE POLICY "fin_insert_boletos" ON public.cobranca_csv_boletos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'cobrancas.disparar_lote'));

CREATE POLICY "fin_update_boletos" ON public.cobranca_csv_boletos
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'cobrancas.disparar_lote'));

CREATE TRIGGER trg_csv_lotes_updated
  BEFORE UPDATE ON public.cobranca_csv_lotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
