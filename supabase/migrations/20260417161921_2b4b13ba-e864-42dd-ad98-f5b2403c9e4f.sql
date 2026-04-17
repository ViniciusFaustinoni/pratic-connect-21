-- 1) Limpar duplicatas (mantém o mais recente por vistoria_id+tipo)
DELETE FROM public.vistoria_fotos a
USING public.vistoria_fotos b
WHERE a.vistoria_id = b.vistoria_id
  AND a.tipo = b.tipo
  AND a.created_at < b.created_at;

-- 2) Constraint única para permitir upsert atômico
CREATE UNIQUE INDEX IF NOT EXISTS vistoria_fotos_vistoria_tipo_uniq
  ON public.vistoria_fotos(vistoria_id, tipo);

-- 3) Limpar registros cujo storage tem 0 bytes
DELETE FROM public.vistoria_fotos vf
WHERE EXISTS (
  SELECT 1 FROM storage.objects so
  WHERE so.bucket_id = 'vistoria-fotos'
    AND vf.arquivo_url LIKE '%' || so.name
    AND COALESCE((so.metadata->>'size')::bigint, 0) = 0
);

-- 4) Zerar URL de vídeos quebrados (0 bytes)
UPDATE public.vistorias v
SET video_360_url = NULL
WHERE video_360_url IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM storage.objects so
    WHERE so.bucket_id = 'vistoria-videos'
      AND v.video_360_url LIKE '%' || so.name
      AND COALESCE((so.metadata->>'size')::bigint, 0) = 0
  );