CREATE OR REPLACE FUNCTION public.fn_materializar_autovistoria_cotacao(p_cotacao_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vistoria_id uuid;
  v_contrato_id uuid;
  v_veiculo_id uuid;
  v_associado_id uuid;
  v_km integer;
  v_video text;
BEGIN
  IF p_cotacao_id IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_vistoria_id FROM vistorias
   WHERE cotacao_id = p_cotacao_id ORDER BY created_at DESC LIMIT 1;

  SELECT arquivo_url INTO v_video FROM cotacoes_vistoria_fotos
   WHERE cotacao_id = p_cotacao_id AND tipo IN ('video_360','video')
   ORDER BY created_at DESC LIMIT 1;

  IF v_vistoria_id IS NULL THEN
    SELECT c.id, c.veiculo_id, c.associado_id
      INTO v_contrato_id, v_veiculo_id, v_associado_id
      FROM contratos c
     WHERE c.cotacao_id = p_cotacao_id AND c.status <> 'cancelado'
     ORDER BY c.created_at DESC LIMIT 1;
    IF v_veiculo_id IS NULL THEN RETURN NULL; END IF;
    SELECT km_atual INTO v_km FROM cotacoes WHERE id = p_cotacao_id;
    INSERT INTO vistorias (cotacao_id, contrato_id, veiculo_id, associado_id,
      tipo, status, modalidade, origem, km_atual, video_360_url, observacoes)
    VALUES (p_cotacao_id, v_contrato_id, v_veiculo_id, v_associado_id,
      'entrada', 'pendente', 'autovistoria', 'autovistoria_publica',
      v_km, v_video, 'Autovistoria materializada automaticamente a partir de cotacoes_vistoria_fotos.')
    RETURNING id INTO v_vistoria_id;
  ELSE
    -- Sincroniza video_360_url se o vídeo chegou depois das fotos (uploads separados).
    IF v_video IS NOT NULL THEN
      UPDATE vistorias SET video_360_url = v_video
       WHERE id = v_vistoria_id
         AND (video_360_url IS NULL OR video_360_url <> v_video);
    END IF;
  END IF;

  IF v_vistoria_id IS NOT NULL THEN
    INSERT INTO vistoria_fotos (vistoria_id, tipo, arquivo_url)
    SELECT v_vistoria_id, cvf.tipo, cvf.arquivo_url
      FROM cotacoes_vistoria_fotos cvf
     WHERE cvf.cotacao_id = p_cotacao_id AND cvf.arquivo_url IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM vistoria_fotos vf
          WHERE vf.vistoria_id = v_vistoria_id AND vf.arquivo_url = cvf.arquivo_url);
  END IF;

  RETURN v_vistoria_id;
END;
$function$;

-- Backfill
UPDATE vistorias v SET video_360_url = sub.arquivo_url
FROM (
  SELECT DISTINCT ON (vf.vistoria_id) vf.vistoria_id, vf.arquivo_url
    FROM vistoria_fotos vf
   WHERE vf.tipo IN ('video_360','video') AND vf.arquivo_url IS NOT NULL
   ORDER BY vf.vistoria_id, vf.created_at DESC
) sub
WHERE v.id = sub.vistoria_id
  AND v.modalidade = 'autovistoria'
  AND v.video_360_url IS NULL;

-- Saneamento manual Marllon
UPDATE vistorias
   SET status='aprovada',
       analisado_em=COALESCE(analisado_em, now()),
       analisado_por=COALESCE(analisado_por, 'cefd786a-73f9-4bf4-8bcc-ff7ba7cca4e8'::uuid)
 WHERE id='9cf4aafa-b870-4b01-99b7-4c1aaafe88b8' AND status='pendente';

UPDATE veiculos SET cobertura_roubo_furto=true
 WHERE id='7719dcaa-d842-483a-b8d4-b92e30880c70' AND cobertura_roubo_furto=false;

UPDATE servicos
   SET status='aprovada',
       analisado_em=COALESCE(analisado_em, now()),
       analisado_por=COALESCE(analisado_por, 'cefd786a-73f9-4bf4-8bcc-ff7ba7cca4e8'::uuid),
       observacoes_analise=COALESCE(observacoes_analise,'Autovistoria aprovada manualmente — Roubo/Furto liberado (correção do bug de sincronização de video_360_url). Aguardando vistoria/instalação presencial do técnico.')
 WHERE cotacao_id='b50180dc-e4f0-420f-8f08-a07175ef0212'
   AND tipo='vistoria_entrada' AND modalidade='autovistoria'
   AND status IN ('em_analise','concluida');