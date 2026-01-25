-- Inserir assinatura existente em vistoria_fotos para que o analista possa ver
INSERT INTO vistoria_fotos (vistoria_id, tipo, arquivo_url, visivel_cliente)
VALUES (
  'c70f19d4-7d37-4b85-8f53-67c102229690',
  'assinatura_cliente',
  'https://iyxdgmukrrdkffraptsx.supabase.co/storage/v1/object/public/assinaturas/b06fb658-0541-49ed-88a7-c4d6fef23f99/assinatura_1769347417698.png',
  true
)
ON CONFLICT DO NOTHING;