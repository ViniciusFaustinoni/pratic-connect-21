-- 1. Enum status
DO $$ BEGIN
  CREATE TYPE public.status_troca_titularidade AS ENUM (
    'cotacao_em_andamento',
    'aguardando_cadastro',
    'aguardando_monitoramento',
    'aguardando_vistoria',
    'liberada_para_assinatura',
    'efetivada',
    'reprovada_cadastro',
    'reprovada_monitoramento',
    'cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabela principal
CREATE TABLE IF NOT EXISTS public.solicitacoes_troca_titularidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  associado_antigo_id uuid NOT NULL REFERENCES public.associados(id) ON DELETE RESTRICT,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE RESTRICT,
  cotacao_id uuid REFERENCES public.cotacoes(id) ON DELETE SET NULL,
  novo_titular_dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  novo_associado_id uuid REFERENCES public.associados(id) ON DELETE SET NULL,
  status public.status_troca_titularidade NOT NULL DEFAULT 'cotacao_em_andamento',
  token_publico text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  termo_cancelamento_autentique_id text,
  termo_cancelamento_url text,
  termo_cancelamento_enviado_em timestamptz,
  termo_cancelamento_assinado_em timestamptz,
  aprovado_cadastro_por uuid REFERENCES public.profiles(id),
  aprovado_cadastro_em timestamptz,
  observacao_cadastro text,
  aprovado_monitoramento_por uuid REFERENCES public.profiles(id),
  aprovado_monitoramento_em timestamptz,
  observacao_monitoramento text,
  servico_vistoria_id uuid REFERENCES public.servicos(id) ON DELETE SET NULL,
  motivo_reprovacao text,
  reprovado_por uuid REFERENCES public.profiles(id),
  reprovado_em timestamptz,
  efetivada_em timestamptz,
  criado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_troca_status ON public.solicitacoes_troca_titularidade(status);
CREATE INDEX IF NOT EXISTS idx_troca_associado_antigo ON public.solicitacoes_troca_titularidade(associado_antigo_id);
CREATE INDEX IF NOT EXISTS idx_troca_veiculo ON public.solicitacoes_troca_titularidade(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_troca_cotacao ON public.solicitacoes_troca_titularidade(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_troca_token ON public.solicitacoes_troca_titularidade(token_publico);

-- 3. Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_troca_titularidade_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_troca_titularidade_updated_at ON public.solicitacoes_troca_titularidade;
CREATE TRIGGER trg_troca_titularidade_updated_at
BEFORE UPDATE ON public.solicitacoes_troca_titularidade
FOR EACH ROW EXECUTE FUNCTION public.tg_troca_titularidade_updated_at();

-- 4. RLS
ALTER TABLE public.solicitacoes_troca_titularidade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "troca_select_anon_token" ON public.solicitacoes_troca_titularidade;
CREATE POLICY "troca_select_anon_token"
ON public.solicitacoes_troca_titularidade
FOR SELECT TO anon
USING (true);

DROP POLICY IF EXISTS "troca_select_auth" ON public.solicitacoes_troca_titularidade;
CREATE POLICY "troca_select_auth"
ON public.solicitacoes_troca_titularidade
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "troca_insert_auth" ON public.solicitacoes_troca_titularidade;
CREATE POLICY "troca_insert_auth"
ON public.solicitacoes_troca_titularidade
FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "troca_update_auth" ON public.solicitacoes_troca_titularidade;
CREATE POLICY "troca_update_auth"
ON public.solicitacoes_troca_titularidade
FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "troca_delete_admin" ON public.solicitacoes_troca_titularidade;
CREATE POLICY "troca_delete_admin"
ON public.solicitacoes_troca_titularidade
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.tipo::text IN ('diretor','administrador','admin','super_admin')
  )
);

-- 5. Trigger: vistoria concluída -> libera assinatura
CREATE OR REPLACE FUNCTION public.tg_troca_vistoria_concluida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'concluido' AND (OLD.status IS DISTINCT FROM 'concluido') THEN
    UPDATE public.solicitacoes_troca_titularidade
       SET status = 'liberada_para_assinatura',
           updated_at = now()
     WHERE servico_vistoria_id = NEW.id
       AND status = 'aguardando_vistoria';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_troca_vistoria_concluida ON public.servicos;
CREATE TRIGGER trg_troca_vistoria_concluida
AFTER UPDATE OF status ON public.servicos
FOR EACH ROW EXECUTE FUNCTION public.tg_troca_vistoria_concluida();

-- 6. Realtime
ALTER TABLE public.solicitacoes_troca_titularidade REPLICA IDENTITY FULL;
DO $$ BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes_troca_titularidade';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;