-- Aliases de tipo_foto para os tipos curtos usados em `documentos`
-- (chassi, motor, frente, traseira, lateral_*, odometro, painel)
-- Sem isso o getMapeamento retornava null e antes o código caía no fallback "1" (CNH)
INSERT INTO public.hinova_mapeamentos (tipo, codigo_local, codigo_hinova, descricao, ativo)
VALUES
  ('tipo_foto','chassi',9,'FOTO CHASSI',true),
  ('tipo_foto','motor',8,'FOTO MOTOR',true),
  ('tipo_foto','frente',4,'FOTO FRENTE',true),
  ('tipo_foto','frontal',4,'FOTO FRENTE',true),
  ('tipo_foto','traseira',5,'FOTO TRASEIRA',true),
  ('tipo_foto','odometro',10,'FOTO KM',true),
  ('tipo_foto','painel',10,'FOTO PAINEL',true)
ON CONFLICT DO NOTHING;