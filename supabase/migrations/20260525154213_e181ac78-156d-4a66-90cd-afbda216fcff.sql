-- Retificação de Termo de Filiação
CREATE TABLE IF NOT EXISTS public.contrato_retificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  associado_id uuid NOT NULL REFERENCES public.associados(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  motivo text NOT NULL CHECK (length(btrim(motivo)) >= 10),
  snapshot_anterior jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_novo jsonb NOT NULL DEFAULT '{}'::jsonb,
  campos_alterados jsonb NOT NULL DEFAULT '[]'::jsonb,
  autentique_documento_id text,
  autentique_signer_public_id text,
  autentique_short_link text,
  autentique_url text,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','enviado','visualizado','assinado','recusado','cancelado','erro')),
  pdf_assinado_url text,
  enviado_em timestamptz,
  visualizado_em timestamptz,
  assinado_em timestamptz,
  criado_por uuid REFERENCES public.profiles(id),
  erro_mensagem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contrato_retificacoes_unique_versao UNIQUE (contrato_id, versao)
);

CREATE INDEX IF NOT EXISTS idx_contrato_retificacoes_contrato_id
  ON public.contrato_retificacoes (contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_retificacoes_associado_id
  ON public.contrato_retificacoes (associado_id);
CREATE INDEX IF NOT EXISTS idx_contrato_retificacoes_autentique_doc
  ON public.contrato_retificacoes (autentique_documento_id)
  WHERE autentique_documento_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_contrato_retificacoes_set_versao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.versao IS NULL OR NEW.versao = 0 THEN
    SELECT COALESCE(MAX(versao), 0) + 1
      INTO NEW.versao
      FROM public.contrato_retificacoes
     WHERE contrato_id = NEW.contrato_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contrato_retificacoes_versao ON public.contrato_retificacoes;
CREATE TRIGGER trg_contrato_retificacoes_versao
  BEFORE INSERT ON public.contrato_retificacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_contrato_retificacoes_set_versao();

CREATE OR REPLACE FUNCTION public.fn_contrato_retificacoes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contrato_retificacoes_updated_at ON public.contrato_retificacoes;
CREATE TRIGGER trg_contrato_retificacoes_updated_at
  BEFORE UPDATE ON public.contrato_retificacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_contrato_retificacoes_updated_at();

ALTER TABLE public.contrato_retificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cadastro/Diretor podem ler retificacoes" ON public.contrato_retificacoes;
CREATE POLICY "Cadastro/Diretor podem ler retificacoes"
ON public.contrato_retificacoes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'admin_master'::app_role)
  OR public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR public.has_role(auth.uid(), 'analista_cadastro'::app_role)
);

DROP POLICY IF EXISTS "Cadastro/Diretor podem criar retificacoes" ON public.contrato_retificacoes;
CREATE POLICY "Cadastro/Diretor podem criar retificacoes"
ON public.contrato_retificacoes
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'admin_master'::app_role)
  OR public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR public.has_role(auth.uid(), 'analista_cadastro'::app_role)
);

DROP POLICY IF EXISTS "Cadastro/Diretor podem atualizar retificacoes" ON public.contrato_retificacoes;
CREATE POLICY "Cadastro/Diretor podem atualizar retificacoes"
ON public.contrato_retificacoes
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'admin_master'::app_role)
  OR public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR public.has_role(auth.uid(), 'analista_cadastro'::app_role)
);

ALTER TABLE public.contratos_documentos
  DROP CONSTRAINT IF EXISTS contratos_documentos_tipo_check;
ALTER TABLE public.contratos_documentos
  ADD CONSTRAINT contratos_documentos_tipo_check
  CHECK (tipo::text = ANY (ARRAY[
    'crlv','cnh','rg','comprovante_residencia',
    'laudo_vistoria','nota_fiscal_veiculo',
    'retificacao_termo_filiacao',
    'outro'
  ]::text[]));

ALTER TABLE public.contrato_retificacoes REPLICA IDENTITY FULL;