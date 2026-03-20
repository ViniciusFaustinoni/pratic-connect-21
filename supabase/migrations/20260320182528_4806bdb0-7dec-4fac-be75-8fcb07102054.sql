
ALTER TABLE configuracoes DROP CONSTRAINT IF EXISTS configuracoes_categoria_check;
ALTER TABLE configuracoes ADD CONSTRAINT configuracoes_categoria_check CHECK (categoria IN ('atuarial', 'documentos', 'empresa', 'financeiro', 'indicacao', 'notificacoes', 'operacional', 'rateio', 'regras_venda', 'monitoramento'));

INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao)
VALUES 
  ('instalacao_max_por_dia', '6', 'numero', 'monitoramento', 'Máximo de instalações por instalador por dia'),
  ('instalacao_horario_inicio', '08:30', 'texto', 'monitoramento', 'Horário de início das rotas de instalação'),
  ('instalacao_tempo_medio_minutos', '90', 'numero', 'monitoramento', 'Tempo médio estimado por instalação em minutos'),
  ('instalacao_custo_fora_horario', '50', 'numero', 'monitoramento', 'Valor do repasse para instalação fora do horário comercial'),
  ('instalacao_prazos_por_estado', '[{"estado":"RJ","prazo_horas":48},{"estado":"SP","prazo_horas":72}]', 'json', 'monitoramento', 'Prazos máximos de instalação por estado em horas úteis'),
  ('instalacao_regioes_rotas', '[{"value":"sp_centro","label":"São Paulo - Centro","ativa":true},{"value":"sp_zona_sul","label":"São Paulo - Zona Sul","ativa":true},{"value":"sp_zona_norte","label":"São Paulo - Zona Norte","ativa":true},{"value":"sp_zona_oeste","label":"São Paulo - Zona Oeste","ativa":true},{"value":"campinas","label":"Campinas","ativa":true},{"value":"abc","label":"ABC Paulista","ativa":true},{"value":"interior","label":"Interior","ativa":true},{"value":"litoral","label":"Litoral","ativa":true}]', 'json', 'monitoramento', 'Regiões de atendimento disponíveis para rotas de instalação')
ON CONFLICT (chave) DO NOTHING;
