-- Inserir template Meta para confirmação genérica de serviço
INSERT INTO whatsapp_meta_templates (nome, categoria, corpo, header_tipo, rodape, status, variaveis_exemplo)
VALUES (
  'confirmacao_servico_v1',
  'UTILITY',
  'Olá {{1}}! Seu(a) {{2}} está agendado(a) para HOJE ({{3}}). Responda SIM para confirmar ou solicite reagendamento.',
  'none',
  'PRATIC Proteção Veicular',
  'DRAFT',
  '{"1": "João", "2": "instalação", "3": "pela manhã"}'::jsonb
);

-- Inserir template fallback local
INSERT INTO whatsapp_templates (codigo, nome, descricao, categoria, mensagem, variaveis, ativo)
VALUES (
  'confirmacao_servico',
  'Confirmação de Serviço',
  'Template genérico para confirmação matinal de serviços (vistoria, instalação, manutenção, remoção)',
  'monitoramento',
  'Olá {{nome}}! Seu(a) {{tipo_servico}} está agendado(a) para HOJE ({{periodo}}). Responda SIM para confirmar ou solicite reagendamento.',
  ARRAY['nome', 'tipo_servico', 'periodo'],
  true
);