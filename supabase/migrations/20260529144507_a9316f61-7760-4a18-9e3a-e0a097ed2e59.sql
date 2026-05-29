
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS documentos_aprovados_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS documentos_aprovados_por uuid NULL;

COMMENT ON COLUMN public.contratos.documentos_aprovados_em IS
  'Sub-etapa 1 do Cadastro (aprovação dos documentos). Quando NOT NULL, libera sub-etapa 2 (vistoria enxuta). Zerado pelo devolver-ao-cadastro.';
COMMENT ON COLUMN public.contratos.documentos_aprovados_por IS
  'Usuário que concluiu a sub-etapa 1 do Cadastro.';

CREATE OR REPLACE FUNCTION public.fn_guard_cadastro_aprovado_exige_documentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cadastro_aprovado IS TRUE
     AND COALESCE(OLD.cadastro_aprovado, false) IS FALSE
     AND NEW.documentos_aprovados_em IS NULL
     AND NEW.origem_troca_titularidade_id IS NULL
     AND COALESCE(NEW.tipo_entrada, '') <> 'troca_titularidade' THEN
    RAISE EXCEPTION 'cadastro_aprovado=true exige documentos_aprovados_em NOT NULL (sub-etapa 1 do Cadastro). Aprove os documentos antes da vistoria enxuta.'
      USING ERRCODE = 'check_violation',
            HINT = 'Chame aprovar-documentos-cadastro primeiro, depois aprovar-proposta.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_cadastro_aprovado_exige_documentos ON public.contratos;
CREATE TRIGGER trg_guard_cadastro_aprovado_exige_documentos
BEFORE UPDATE ON public.contratos
FOR EACH ROW
WHEN (NEW.cadastro_aprovado IS DISTINCT FROM OLD.cadastro_aprovado)
EXECUTE FUNCTION public.fn_guard_cadastro_aprovado_exige_documentos();

-- SANEAMENTO Keven
UPDATE public.veiculos SET cobertura_roubo_furto = false, status = 'em_analise'
WHERE id = 'd5dc2baa-df1d-4b36-973e-04aaf737d210';

UPDATE public.associados SET status = 'em_analise'
WHERE id = '1aad3587-c40a-4039-8476-33a38e74bd61';

UPDATE public.servicos
SET status = 'cancelada',
    observacoes = COALESCE(observacoes,'') || E'\n[SANEAMENTO 29/05/26] Cancelado — aprovação consolidada revertida.'
WHERE id = '798d2e95-af0b-4408-b37e-a345ab70dda6';

UPDATE public.instalacoes SET status = 'cancelada'
WHERE id = '9a1b17bb-28fd-4e2a-900d-b3399dbf8330';

UPDATE public.servicos
SET status = 'em_analise',
    observacoes = COALESCE(observacoes,'') || E'\n[SANEAMENTO 29/05/26] Reaberto — sub-etapa 2 do Cadastro pendente.'
WHERE id = 'cc544b60-c379-42d0-a17d-229d77ad4a0e';

UPDATE public.vistorias SET status = 'em_analise'
WHERE id = 'd7061a3e-c256-4712-952f-e47f803abd33';

UPDATE public.cotacoes SET status_contratacao = 'aguardando_aprovacao_cadastro'
WHERE id = 'e8a95292-ebeb-457b-a3b3-b7e9d388d571';

UPDATE public.contratos
SET cadastro_aprovado = false, aprovado_em = NULL, aprovado_por = NULL,
    documentos_aprovados_em = NULL, documentos_aprovados_por = NULL
WHERE id = '1edec81e-4a65-4c01-b3f6-bd7cf8e3346a';

INSERT INTO public.logs_auditoria (acao, modulo, tabela, registro_id, descricao, usuario_id)
VALUES ('criar', 'cadastro', 'contratos', '1edec81e-4a65-4c01-b3f6-bd7cf8e3346a',
        '[SANEAMENTO CANONICO 29/05/26] Caso KEVEN DA SILVA SOUZA / COT-20260528-160310409-083 revertido para sub-etapa 1 do Cadastro. Vistoria d7061a3e e servico cc544b60 reabertos em em_analise; instalacao 9a1b17bb e servico 798d2e95 cancelados; SIO2D02 voltou a em_analise sem R/F; associado voltou a em_analise; cotacao voltou a aguardando_aprovacao_cadastro; contrato zerou cadastro_aprovado e documentos_aprovados_em.',
        NULL);
