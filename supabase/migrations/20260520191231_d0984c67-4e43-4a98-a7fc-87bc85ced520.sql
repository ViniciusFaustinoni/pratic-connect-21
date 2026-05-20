
-- 1) Mapeia todos os tipos da vistoria presencial completa que ainda não tinham
--    equivalente em hinova_mapeamentos. Vão para código 15 (FOTO ADICIONAL),
--    conforme regra mem://logic/integrations/sga-fotos-codigo-15-adicional.
INSERT INTO public.hinova_mapeamentos (tipo, codigo_local, codigo_hinova, descricao, ativo) VALUES
  ('tipo_foto','bateria',15,'FOTO ADICIONAL — bateria (sem equivalente oficial Hinova)',true),
  ('tipo_foto','capo_aberto_placa',15,'FOTO ADICIONAL — capô aberto com placa (sem equivalente oficial Hinova)',true),
  ('tipo_foto','chave',15,'FOTO ADICIONAL — chave (sem equivalente oficial Hinova)',true),
  ('tipo_foto','chave_roda_macaco',15,'FOTO ADICIONAL — chave de roda + macaco (sem equivalente oficial Hinova)',true),
  ('tipo_foto','estepe',15,'FOTO ADICIONAL — estepe (sem equivalente oficial Hinova)',true),
  ('tipo_foto','banco_motorista',15,'FOTO ADICIONAL — banco do motorista (sem equivalente oficial Hinova)',true),
  ('tipo_foto','banco_passageiro',15,'FOTO ADICIONAL — banco do passageiro (sem equivalente oficial Hinova)',true),
  ('tipo_foto','banco_traseiro',15,'FOTO ADICIONAL — banco traseiro (sem equivalente oficial Hinova)',true),
  ('tipo_foto','forracao_porta_dianteira_direita',15,'FOTO ADICIONAL — forração porta dianteira direita',true),
  ('tipo_foto','forracao_porta_dianteira_esquerda',15,'FOTO ADICIONAL — forração porta dianteira esquerda',true),
  ('tipo_foto','forracao_porta_traseira_direita',15,'FOTO ADICIONAL — forração porta traseira direita',true),
  ('tipo_foto','forracao_porta_traseira_esquerda',15,'FOTO ADICIONAL — forração porta traseira esquerda',true),
  ('tipo_foto','frente_lateral_direita',15,'FOTO ADICIONAL — frente lateral direita',true),
  ('tipo_foto','frente_lateral_esquerda',15,'FOTO ADICIONAL — frente lateral esquerda',true),
  ('tipo_foto','traseira_lateral_direita',15,'FOTO ADICIONAL — traseira lateral direita',true),
  ('tipo_foto','traseira_lateral_esquerda',15,'FOTO ADICIONAL — traseira lateral esquerda',true),
  ('tipo_foto','mala_aberta',15,'FOTO ADICIONAL — mala aberta',true),
  ('tipo_foto','parabrisa',15,'FOTO ADICIONAL — para-brisa',true),
  ('tipo_foto','pneu_dianteiro_direito',15,'FOTO ADICIONAL — pneu dianteiro direito',true),
  ('tipo_foto','pneu_dianteiro_esquerdo',15,'FOTO ADICIONAL — pneu dianteiro esquerdo',true),
  ('tipo_foto','pneu_traseiro_direito',15,'FOTO ADICIONAL — pneu traseiro direito',true),
  ('tipo_foto','pneu_traseiro_esquerdo',15,'FOTO ADICIONAL — pneu traseiro esquerdo',true),
  ('tipo_foto','vistoriador_selfie',15,'FOTO ADICIONAL — selfie do vistoriador no local',true),
  ('tipo_foto','odometro_painel',15,'FOTO ADICIONAL — odômetro junto ao painel',true)
ON CONFLICT DO NOTHING;

-- 2) Remove o efeito da migration 20260516133056_*.sql que carimbou como
--    "já enviadas" todas as fotos pré-existentes (codigo_tipo=0, hinova_response.backfill=true)
--    incluindo as que NUNCA tinham chegado ao Hinova. Sem isso, o dedupe da edge
--    sga-hinova-sync (chave veiculo_id+origem+origem_id) impediria o reenvio para
--    sempre — exatamente o sintoma do caso LTV3631 (19 fotos ausentes no SGA).
DELETE FROM public.sga_fotos_enviadas
WHERE codigo_tipo = 0
  AND hinova_response ? 'backfill'
  AND COALESCE((hinova_response->>'backfill')::boolean, false) = true;
