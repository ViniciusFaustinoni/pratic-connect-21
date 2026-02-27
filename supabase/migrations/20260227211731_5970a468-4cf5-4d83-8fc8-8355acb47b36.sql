UPDATE rastreadores 
SET local_instalacao = COALESCE(local_instalacao, 'A preencher'),
    descricao_instalacao = COALESCE(descricao_instalacao, 'A preencher'),
    updated_at = now()
WHERE status = 'instalado' 
  AND foto_local_instalacao_url IS NOT NULL 
  AND (local_instalacao IS NULL OR descricao_instalacao IS NULL);