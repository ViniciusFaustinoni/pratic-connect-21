-- Materialização automática de autovistoria a partir de cotacoes_vistoria_fotos
-- Resolve o caso "fotos existem em cotacoes_vistoria_fotos mas não em vistorias",
-- que faz drawer Cadastro/Veículos mostrar 'Nenhuma foto' enquanto Instalações exibe.

CREATE OR REPLACE FUNCTION public.fn_materializar_autovistoria_cotacao(p_cotacao_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vistoria_id uuid;
  v_contrato_id uuid;
  v_veiculo_id uuid;
  v_associado_id uuid;
  v_km integer;
  v_video text;
BEGIN
  IF p_cotacao_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_vistoria_id
  FROM vistorias
  WHERE cotacao_id = p_cotacao_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_vistoria_id IS NULL THEN
    SELECT c.id, c.veiculo_id, c.associado_id
    INTO v_contrato_id, v_veiculo_id, v_associado_id
    FROM contratos c
    WHERE c.cotacao_id = p_cotacao_id AND c.status <> 'cancelado'
    ORDER BY c.created_at DESC
    LIMIT 1;

    IF v_veiculo_id IS NULL THEN
      -- Sem veículo, não há como materializar; trigger 'vistoria nunca órfã' bloquearia.
      RETURN NULL;
    END IF;

    SELECT km_atual INTO v_km FROM cotacoes WHERE id = p_cotacao_id;

    SELECT arquivo_url INTO v_video
    FROM cotacoes_vistoria_fotos
    WHERE cotacao_id = p_cotacao_id AND tipo IN ('video_360','video')
    ORDER BY created_at DESC
    LIMIT 1;

    INSERT INTO vistorias (
      cotacao_id, contrato_id, veiculo_id, associado_id,
      tipo, status, modalidade, origem,
      km_atual, video_360_url, observacoes
    )
    VALUES (
      p_cotacao_id, v_contrato_id, v_veiculo_id, v_associado_id,
      'entrada', 'pendente', 'autovistoria', 'autovistoria_publica',
      v_km, v_video, 'Autovistoria materializada automaticamente a partir de cotacoes_vistoria_fotos.'
    )
    RETURNING id INTO v_vistoria_id;
  END IF;

  IF v_vistoria_id IS NOT NULL THEN
    INSERT INTO vistoria_fotos (vistoria_id, tipo, arquivo_url)
    SELECT v_vistoria_id, cvf.tipo, cvf.arquivo_url
    FROM cotacoes_vistoria_fotos cvf
    WHERE cvf.cotacao_id = p_cotacao_id
      AND cvf.arquivo_url IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM vistoria_fotos vf
        WHERE vf.vistoria_id = v_vistoria_id
          AND vf.arquivo_url = cvf.arquivo_url
      );
  END IF;

  RETURN v_vistoria_id;
END;
$$;

-- Trigger: cada foto inserida em cotacoes_vistoria_fotos materializa/atualiza
-- a vistoria canônica. Falhas não bloqueiam o upload da foto.
CREATE OR REPLACE FUNCTION public.trg_materializar_autovistoria_on_foto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.fn_materializar_autovistoria_cotacao(NEW.cotacao_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[trg_materializar_autovistoria_on_foto] cotacao=% erro=%', NEW.cotacao_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autovistoria_materializa ON public.cotacoes_vistoria_fotos;
CREATE TRIGGER trg_autovistoria_materializa
AFTER INSERT ON public.cotacoes_vistoria_fotos
FOR EACH ROW
EXECUTE FUNCTION public.trg_materializar_autovistoria_on_foto();

-- Backfill: materializa todas as cotações com fotos órfãs (sem vistoria).
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT DISTINCT cvf.cotacao_id
    FROM cotacoes_vistoria_fotos cvf
    WHERE NOT EXISTS (
      SELECT 1 FROM vistorias v WHERE v.cotacao_id = cvf.cotacao_id
    )
  LOOP
    PERFORM public.fn_materializar_autovistoria_cotacao(c.cotacao_id);
  END LOOP;
END $$;