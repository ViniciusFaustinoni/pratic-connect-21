
CREATE TABLE IF NOT EXISTS public.solicitacoes_substituicao_placa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_id uuid REFERENCES public.associados(id) ON DELETE SET NULL,
  sga_codigo_associado integer,
  sga_codigo_veiculo integer,
  veiculo_antigo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  veiculo_antigo_placa varchar(20) NOT NULL,
  veiculo_antigo_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  associado_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  cotacao_id uuid REFERENCES public.cotacoes(id) ON DELETE SET NULL,
  status varchar(40) NOT NULL DEFAULT 'aguardando_termo',
  termo_cancelamento_autentique_id varchar(120),
  termo_cancelamento_url text,
  termo_cancelamento_enviado_em timestamptz,
  termo_cancelamento_assinado_em timestamptz,
  termo_whatsapp_status varchar(20),
  termo_reenvios_count integer NOT NULL DEFAULT 0,
  termo_ultimo_reenvio_em timestamptz,
  consultor_id uuid,
  criado_por uuid,
  motivo_cancelamento text,
  cancelada_em timestamptz,
  efetivada_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT solic_subst_status_chk CHECK (status IN (
    'aguardando_termo','termo_enviado','termo_assinado','cotacao_criada','efetivada','cancelada'
  ))
);

CREATE INDEX IF NOT EXISTS idx_solic_subst_placa ON public.solicitacoes_substituicao_placa(veiculo_antigo_placa);
CREATE INDEX IF NOT EXISTS idx_solic_subst_associado ON public.solicitacoes_substituicao_placa(associado_id);
CREATE INDEX IF NOT EXISTS idx_solic_subst_status ON public.solicitacoes_substituicao_placa(status);
CREATE INDEX IF NOT EXISTS idx_solic_subst_cotacao ON public.solicitacoes_substituicao_placa(cotacao_id);

CREATE OR REPLACE FUNCTION public.tg_solic_subst_set_updated_at()
RETURNS TRIGGER AS $f$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$f$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_solic_subst_updated_at ON public.solicitacoes_substituicao_placa;
CREATE TRIGGER trg_solic_subst_updated_at
  BEFORE UPDATE ON public.solicitacoes_substituicao_placa
  FOR EACH ROW EXECUTE FUNCTION public.tg_solic_subst_set_updated_at();

ALTER TABLE public.solicitacoes_substituicao_placa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internos podem ler solicitações de substituição" ON public.solicitacoes_substituicao_placa;
CREATE POLICY "Internos podem ler solicitações de substituição"
  ON public.solicitacoes_substituicao_placa
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.tipo IS DISTINCT FROM 'associado'::tipo_usuario
    )
  );

DROP POLICY IF EXISTS "Internos podem gerenciar solicitações de substituição" ON public.solicitacoes_substituicao_placa;
CREATE POLICY "Internos podem gerenciar solicitações de substituição"
  ON public.solicitacoes_substituicao_placa
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.tipo IS DISTINCT FROM 'associado'::tipo_usuario
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.tipo IS DISTINCT FROM 'associado'::tipo_usuario
    )
  );

CREATE OR REPLACE FUNCTION public.fn_solic_subst_marcar_cotacao()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cotacao_id IS NOT NULL
     AND (OLD.cotacao_id IS DISTINCT FROM NEW.cotacao_id)
     AND NEW.status IN ('aguardando_termo','termo_enviado','termo_assinado') THEN
    NEW.status := 'cotacao_criada';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_solic_subst_cotacao ON public.solicitacoes_substituicao_placa;
CREATE TRIGGER trg_solic_subst_cotacao
  BEFORE UPDATE ON public.solicitacoes_substituicao_placa
  FOR EACH ROW EXECUTE FUNCTION public.fn_solic_subst_marcar_cotacao();
