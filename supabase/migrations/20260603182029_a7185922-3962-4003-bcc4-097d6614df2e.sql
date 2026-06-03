-- ============================================================================
-- FIX: vistorias.video_360_url ficando NULL na materialização da autovistoria
-- ============================================================================
-- Causa raiz observada (caso DIOGO LUIS / COT-20260602-090235466-549):
--   - cotacoes_vistoria_fotos tem o vídeo (tipo='video_360')
--   - servicos.video_360_url está preenchido
--   - vistorias materializada via fn_materializar_autovistoria_cotacao
--     ficou com video_360_url = NULL → guard de aprovar-proposta cai em
--     vistoria_incompleta e bloqueia o Cadastro
--
-- Esta migração:
--   1. Faz BACKFILL idempotente em todas as vistorias materializadas como
--      autovistoria que estão sem vídeo mas têm vídeo disponível em
--      cotacoes_vistoria_fotos OU em servicos
--   2. Reforça o trigger AFTER INSERT em cotacoes_vistoria_fotos para
--      reexecutar a materialização sempre (idempotente, já roda hoje, mas
--      adiciona log explícito p/ vídeo) — sem mudar a função existente
--   3. Adiciona trigger novo em servicos: quando video_360_url passa a ser
--      preenchido, sincroniza para a vistoria materializada do contrato/cotação
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (1) BACKFILL — preenche vistorias.video_360_url a partir de:
--     a) cotacoes_vistoria_fotos (tipo video_360/video)
--     b) servicos.video_360_url (fallback quando o vídeo já está no serviço)
-- ---------------------------------------------------------------------------
UPDATE public.vistorias v
   SET video_360_url = src.video_url
  FROM (
    SELECT DISTINCT ON (vist.id)
           vist.id AS vistoria_id,
           COALESCE(
             (SELECT cvf.arquivo_url
                FROM public.cotacoes_vistoria_fotos cvf
               WHERE cvf.cotacao_id = vist.cotacao_id
                 AND cvf.tipo IN ('video_360','video')
                 AND cvf.arquivo_url IS NOT NULL
               ORDER BY cvf.created_at DESC
               LIMIT 1),
             (SELECT s.video_360_url
                FROM public.servicos s
               WHERE (s.contrato_id = vist.contrato_id
                      OR s.cotacao_id = vist.cotacao_id)
                 AND s.video_360_url IS NOT NULL
                 AND s.modalidade = 'autovistoria'
               ORDER BY s.created_at DESC
               LIMIT 1)
           ) AS video_url
      FROM public.vistorias vist
     WHERE vist.modalidade = 'autovistoria'
       AND vist.video_360_url IS NULL
  ) src
 WHERE v.id = src.vistoria_id
   AND src.video_url IS NOT NULL
   AND v.video_360_url IS NULL;

-- ---------------------------------------------------------------------------
-- (2) TRIGGER novo em servicos.video_360_url → vistorias
--     Quando o serviço da autovistoria recebe o vídeo (e a vistoria
--     materializada ainda está sem), reflete no registro canônico.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_video_360_servico_para_vistoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.video_360_url IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.video_360_url IS NOT DISTINCT FROM NEW.video_360_url THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.modalidade, '') <> 'autovistoria' THEN
    RETURN NEW;
  END IF;

  -- Sincroniza por contrato_id (mais específico) OU cotacao_id
  UPDATE public.vistorias v
     SET video_360_url = NEW.video_360_url
   WHERE (
           (NEW.contrato_id IS NOT NULL AND v.contrato_id = NEW.contrato_id)
        OR (NEW.cotacao_id IS NOT NULL AND v.cotacao_id = NEW.cotacao_id)
         )
     AND v.modalidade = 'autovistoria'
     AND v.video_360_url IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_video_360_servico_para_vistoria ON public.servicos;
CREATE TRIGGER trg_sync_video_360_servico_para_vistoria
AFTER INSERT OR UPDATE OF video_360_url ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_video_360_servico_para_vistoria();

COMMENT ON FUNCTION public.fn_sync_video_360_servico_para_vistoria() IS
  'Sincroniza servicos.video_360_url → vistorias.video_360_url para autovistoria. '
  'Defesa contra dessincronia que mantinha vistorias.video_360_url NULL mesmo '
  'com o vídeo presente em servicos/cotacoes_vistoria_fotos (caso DIOGO LUIS '
  'PEREIRA DE LIMA, COT-20260602-090235466-549, 03/06/2026).';