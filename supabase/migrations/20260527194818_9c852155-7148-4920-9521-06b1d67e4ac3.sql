-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.analise_relacionamento_tipo AS ENUM ('troca_titularidade', 'cancelamento_voluntario', 'substituicao', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.analise_relacionamento_status AS ENUM ('pendente', 'em_andamento', 'resolvido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Table
CREATE TABLE IF NOT EXISTS public.analises_relacionamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.analise_relacionamento_tipo NOT NULL,
  status public.analise_relacionamento_status NOT NULL DEFAULT 'pendente',
  associado_id uuid REFERENCES public.associados(id) ON DELETE SET NULL,
  veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  origem_tabela text NOT NULL,
  origem_id uuid NOT NULL,
  termo_url text,
  termo_assinado_em timestamptz,
  assumido_por uuid,
  assumido_em timestamptz,
  resolvido_por uuid,
  resolvido_em timestamptz,
  justificativa text,
  documento_comprobatorio_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analises_relacionamento_origem_uk UNIQUE (origem_tabela, origem_id)
);

CREATE INDEX IF NOT EXISTS idx_analises_relacionamento_status ON public.analises_relacionamento(status);
CREATE INDEX IF NOT EXISTS idx_analises_relacionamento_tipo ON public.analises_relacionamento(tipo);
CREATE INDEX IF NOT EXISTS idx_analises_relacionamento_associado ON public.analises_relacionamento(associado_id);
CREATE INDEX IF NOT EXISTS idx_analises_relacionamento_veiculo ON public.analises_relacionamento(veiculo_id);

-- 3. Grants
GRANT SELECT, INSERT, UPDATE ON public.analises_relacionamento TO authenticated;
GRANT ALL ON public.analises_relacionamento TO service_role;

-- 4. RLS
ALTER TABLE public.analises_relacionamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analises relacionamento - select autenticado"
  ON public.analises_relacionamento FOR SELECT TO authenticated USING (true);

CREATE POLICY "Analises relacionamento - insert bloqueado"
  ON public.analises_relacionamento FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "Analises relacionamento - update autenticado"
  ON public.analises_relacionamento FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 5. updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_analises_relacionamento_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_analises_relacionamento_updated_at ON public.analises_relacionamento;
CREATE TRIGGER trg_analises_relacionamento_updated_at
  BEFORE UPDATE ON public.analises_relacionamento
  FOR EACH ROW EXECUTE FUNCTION public.tg_analises_relacionamento_updated_at();

-- 6. Função canônica de criação
CREATE OR REPLACE FUNCTION public.fn_criar_analise_relacionamento(
  _tipo public.analise_relacionamento_tipo,
  _origem_tabela text,
  _origem_id uuid,
  _associado_id uuid,
  _veiculo_id uuid,
  _contrato_id uuid,
  _termo_url text,
  _termo_assinado_em timestamptz,
  _metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_meta jsonb := COALESCE(_metadata, '{}'::jsonb);
  v_assoc_nome text; v_assoc_cpf text; v_placa text;
BEGIN
  IF _associado_id IS NOT NULL THEN
    SELECT nome, cpf INTO v_assoc_nome, v_assoc_cpf FROM public.associados WHERE id = _associado_id;
    IF v_assoc_nome IS NOT NULL THEN
      v_meta := v_meta || jsonb_build_object('associado_nome', v_assoc_nome, 'associado_cpf', v_assoc_cpf);
    END IF;
  END IF;
  IF _veiculo_id IS NOT NULL THEN
    SELECT placa INTO v_placa FROM public.veiculos WHERE id = _veiculo_id;
    IF v_placa IS NOT NULL THEN
      v_meta := v_meta || jsonb_build_object('placa', v_placa);
    END IF;
  END IF;

  INSERT INTO public.analises_relacionamento (
    tipo, status, associado_id, veiculo_id, contrato_id,
    origem_tabela, origem_id, termo_url, termo_assinado_em, metadata
  ) VALUES (
    _tipo, 'pendente', _associado_id, _veiculo_id, _contrato_id,
    _origem_tabela, _origem_id, _termo_url, _termo_assinado_em, v_meta
  )
  ON CONFLICT (origem_tabela, origem_id) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 7. Trigger troca de titularidade
CREATE OR REPLACE FUNCTION public.tg_analise_relacionamento_troca()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_contrato_id uuid;
BEGIN
  IF NEW.termo_cancelamento_assinado_em IS NOT NULL AND OLD.termo_cancelamento_assinado_em IS NULL THEN
    SELECT id INTO v_contrato_id FROM public.contratos
     WHERE veiculo_id = NEW.veiculo_id AND associado_id = NEW.associado_antigo_id
     ORDER BY created_at DESC LIMIT 1;

    PERFORM public.fn_criar_analise_relacionamento(
      'troca_titularidade'::public.analise_relacionamento_tipo,
      'solicitacoes_troca_titularidade', NEW.id,
      NEW.associado_antigo_id, NEW.veiculo_id, v_contrato_id,
      NEW.termo_cancelamento_url, NEW.termo_cancelamento_assinado_em,
      jsonb_build_object('solicitacao_troca_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analise_relacionamento_troca ON public.solicitacoes_troca_titularidade;
CREATE TRIGGER trg_analise_relacionamento_troca
  AFTER UPDATE OF termo_cancelamento_assinado_em ON public.solicitacoes_troca_titularidade
  FOR EACH ROW EXECUTE FUNCTION public.tg_analise_relacionamento_troca();

-- 8. Trigger substituição de placa
CREATE OR REPLACE FUNCTION public.tg_analise_relacionamento_substituicao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_contrato_id uuid; v_associado_id uuid;
BEGIN
  IF NEW.termo_cancelamento_assinado_em IS NOT NULL AND OLD.termo_cancelamento_assinado_em IS NULL THEN
    v_associado_id := NEW.associado_id;
    SELECT id INTO v_contrato_id FROM public.contratos
     WHERE veiculo_id = NEW.veiculo_antigo_id
     ORDER BY created_at DESC LIMIT 1;

    IF v_associado_id IS NULL AND NEW.veiculo_antigo_id IS NOT NULL THEN
      SELECT associado_id INTO v_associado_id FROM public.veiculos WHERE id = NEW.veiculo_antigo_id;
    END IF;

    PERFORM public.fn_criar_analise_relacionamento(
      'substituicao'::public.analise_relacionamento_tipo,
      'solicitacoes_substituicao_placa', NEW.id,
      v_associado_id, NEW.veiculo_antigo_id, v_contrato_id,
      NEW.termo_cancelamento_url, NEW.termo_cancelamento_assinado_em,
      jsonb_build_object('solicitacao_substituicao_id', NEW.id, 'placa_antiga', NEW.veiculo_antigo_placa)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analise_relacionamento_substituicao ON public.solicitacoes_substituicao_placa;
CREATE TRIGGER trg_analise_relacionamento_substituicao
  AFTER UPDATE OF termo_cancelamento_assinado_em ON public.solicitacoes_substituicao_placa
  FOR EACH ROW EXECUTE FUNCTION public.tg_analise_relacionamento_substituicao();

-- 9. Trigger cancelamento voluntário em contratos
CREATE OR REPLACE FUNCTION public.tg_analise_relacionamento_cancelamento_voluntario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.autentique_cancelamento_assinado_em IS NOT NULL
     AND OLD.autentique_cancelamento_assinado_em IS NULL THEN
    PERFORM public.fn_criar_analise_relacionamento(
      'cancelamento_voluntario'::public.analise_relacionamento_tipo,
      'contratos', NEW.id,
      NEW.associado_id, NEW.veiculo_id, NEW.id,
      NULL, NEW.autentique_cancelamento_assinado_em,
      jsonb_build_object('contrato_numero', NEW.numero, 'autentique_cancelamento_id', NEW.autentique_cancelamento_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analise_relacionamento_cancelamento_voluntario ON public.contratos;
CREATE TRIGGER trg_analise_relacionamento_cancelamento_voluntario
  AFTER UPDATE OF autentique_cancelamento_assinado_em ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.tg_analise_relacionamento_cancelamento_voluntario();

-- 10. Backfill
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM public.solicitacoes_troca_titularidade WHERE termo_cancelamento_assinado_em IS NOT NULL LOOP
    PERFORM public.fn_criar_analise_relacionamento(
      'troca_titularidade'::public.analise_relacionamento_tipo,
      'solicitacoes_troca_titularidade', r.id,
      r.associado_antigo_id, r.veiculo_id,
      (SELECT id FROM public.contratos WHERE veiculo_id = r.veiculo_id AND associado_id = r.associado_antigo_id ORDER BY created_at DESC LIMIT 1),
      r.termo_cancelamento_url, r.termo_cancelamento_assinado_em,
      jsonb_build_object('solicitacao_troca_id', r.id, 'backfill', true)
    );
  END LOOP;

  FOR r IN SELECT * FROM public.solicitacoes_substituicao_placa WHERE termo_cancelamento_assinado_em IS NOT NULL LOOP
    PERFORM public.fn_criar_analise_relacionamento(
      'substituicao'::public.analise_relacionamento_tipo,
      'solicitacoes_substituicao_placa', r.id,
      COALESCE(r.associado_id, (SELECT associado_id FROM public.veiculos WHERE id = r.veiculo_antigo_id)),
      r.veiculo_antigo_id,
      (SELECT id FROM public.contratos WHERE veiculo_id = r.veiculo_antigo_id ORDER BY created_at DESC LIMIT 1),
      r.termo_cancelamento_url, r.termo_cancelamento_assinado_em,
      jsonb_build_object('solicitacao_substituicao_id', r.id, 'placa_antiga', r.veiculo_antigo_placa, 'backfill', true)
    );
  END LOOP;

  FOR r IN SELECT * FROM public.contratos WHERE autentique_cancelamento_assinado_em IS NOT NULL LOOP
    PERFORM public.fn_criar_analise_relacionamento(
      'cancelamento_voluntario'::public.analise_relacionamento_tipo,
      'contratos', r.id,
      r.associado_id, r.veiculo_id, r.id,
      NULL, r.autentique_cancelamento_assinado_em,
      jsonb_build_object('contrato_numero', r.numero, 'autentique_cancelamento_id', r.autentique_cancelamento_id, 'backfill', true)
    );
  END LOOP;
END $$;

-- 11. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('relacionamento-anexos', 'relacionamento-anexos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Relacionamento anexos - select autenticado" ON storage.objects;
CREATE POLICY "Relacionamento anexos - select autenticado"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'relacionamento-anexos');

DROP POLICY IF EXISTS "Relacionamento anexos - insert autenticado" ON storage.objects;
CREATE POLICY "Relacionamento anexos - insert autenticado"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'relacionamento-anexos');

DROP POLICY IF EXISTS "Relacionamento anexos - update autenticado" ON storage.objects;
CREATE POLICY "Relacionamento anexos - update autenticado"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'relacionamento-anexos');