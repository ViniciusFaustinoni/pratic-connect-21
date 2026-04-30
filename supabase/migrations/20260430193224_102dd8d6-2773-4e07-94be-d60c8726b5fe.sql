-- Backfill: materializa vistoria + vistoria_fotos para o link do OQK9J14 (e quaisquer
-- outros links concluídos com fotos_vistoria mas sem vistoria canônica). A edge function
-- foi corrigida para incluir o campo obrigatório `tipo='entrada'`; este script recupera
-- o que falhou silenciosamente antes da correção.
WITH alvos AS (
  SELECT l.id AS link_id, l.instalacao_id, l.checklist_data, l.fotos_vistoria,
         l.assinatura_url, l.concluida_em,
         i.contrato_id, i.associado_id, i.veiculo_id, i.cotacao_id,
         i.cep, i.logradouro, i.numero, i.bairro, i.cidade, i.uf,
         i.endereco_latitude, i.endereco_longitude, i.imei_rastreador,
         i.quilometragem, i.created_at AS inst_created_at
  FROM instalacao_prestador_links l
  JOIN instalacoes i ON i.id = l.instalacao_id
  WHERE l.status='concluida'
    AND l.fotos_vistoria IS NOT NULL
    AND jsonb_typeof(l.fotos_vistoria)='object'
    AND i.contrato_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM vistorias v WHERE v.instalacao_id = l.instalacao_id)
), vistorias_inseridas AS (
  INSERT INTO vistorias (
    instalacao_id, contrato_id, associado_id, veiculo_id, cotacao_id,
    tipo, modalidade, origem, status, iniciada_em, concluida_em,
    endereco_cep, endereco_logradouro, endereco_numero, endereco_bairro,
    endereco_cidade, endereco_estado, endereco_latitude, endereco_longitude,
    imei_rastreador, km_atual, dados_parciais, assinatura_documento_url
  )
  SELECT instalacao_id, contrato_id, associado_id, veiculo_id, cotacao_id,
         'entrada'::tipo_vistoria, 'presencial', 'prestador', 'concluida',
         COALESCE(inst_created_at, concluida_em), concluida_em,
         cep, logradouro, numero, bairro, cidade, uf,
         endereco_latitude, endereco_longitude,
         imei_rastreador, quilometragem,
         jsonb_build_object('checklist_data', checklist_data, 'origem_link', link_id, 'backfill', true),
         assinatura_url
  FROM alvos
  RETURNING id, instalacao_id
)
INSERT INTO vistoria_fotos (vistoria_id, tipo, arquivo_url, visivel_cliente)
SELECT vi.id, kv.key, kv.value::text, true
FROM vistorias_inseridas vi
JOIN alvos a ON a.instalacao_id = vi.instalacao_id
CROSS JOIN LATERAL jsonb_each_text(a.fotos_vistoria) AS kv(key, value)
WHERE kv.value IS NOT NULL AND length(kv.value) > 0;