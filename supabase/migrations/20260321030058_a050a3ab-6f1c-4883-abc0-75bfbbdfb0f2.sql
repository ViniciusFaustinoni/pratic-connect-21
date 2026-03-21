
-- Template: notificação de serviço atribuído ao profissional
INSERT INTO whatsapp_meta_templates (nome, categoria, corpo, header_tipo, rodape, status, variaveis_exemplo)
VALUES (
  'servico_atribuido_v1',
  'UTILITY',
  'Olá {{1}}! Um novo serviço foi atribuído a você: {{2}}. Detalhes: {{3}}. Acesse o app para mais informações.',
  'none',
  'PRATIC Proteção Veicular',
  'DRAFT',
  '{"1": "Carlos", "2": "Instalação", "3": "Cliente João - Placa ABC1234"}'::jsonb
);

-- Template: confirmação de agendamento (matinal + 1h antes)
INSERT INTO whatsapp_meta_templates (nome, categoria, corpo, header_tipo, rodape, status, variaveis_exemplo)
VALUES (
  'confirmacao_agendamento_v1',
  'UTILITY',
  'Olá {{1}}! Seu(a) {{2}} está agendado(a) para hoje. {{3}}. Responda SIM para confirmar ou solicite reagendamento.',
  'none',
  'PRATIC Proteção Veicular',
  'DRAFT',
  '{"1": "João", "2": "instalação", "3": "Período da manhã"}'::jsonb
);

-- Template: notificação genérica (NÃO menciona sinistro)
INSERT INTO whatsapp_meta_templates (nome, categoria, corpo, header_tipo, rodape, status, variaveis_exemplo)
VALUES (
  'notificacao_geral_v1',
  'UTILITY',
  'Olá {{1}}! {{2}}: {{3}}. Acompanhe pelo app.',
  'none',
  'PRATIC Proteção Veicular',
  'DRAFT',
  '{"1": "Maria", "2": "Atualização", "3": "Seu cadastro foi atualizado"}'::jsonb
);

-- Templates fallback locais
INSERT INTO whatsapp_templates (codigo, nome, descricao, categoria, mensagem, variaveis, ativo)
VALUES (
  'servico_atribuido',
  'Serviço Atribuído',
  'Notificar profissional sobre novo serviço atribuído',
  'monitoramento',
  'Olá {{nome}}! Um novo serviço foi atribuído a você: {{tipo_servico}}. Detalhes: {{detalhes}}. Acesse o app.',
  ARRAY['nome', 'tipo_servico', 'detalhes'],
  true
);

INSERT INTO whatsapp_templates (codigo, nome, descricao, categoria, mensagem, variaveis, ativo)
VALUES (
  'confirmacao_agendamento',
  'Confirmação de Agendamento',
  'Confirmar presença do cliente para serviço agendado (matinal e 1h antes)',
  'monitoramento',
  'Olá {{nome}}! Seu(a) {{tipo_servico}} está agendado(a) para hoje. {{periodo}}. Responda SIM para confirmar.',
  ARRAY['nome', 'tipo_servico', 'periodo'],
  true
);

INSERT INTO whatsapp_templates (codigo, nome, descricao, categoria, mensagem, variaveis, ativo)
VALUES (
  'notificacao_geral',
  'Notificação Geral',
  'Template genérico para notificações que NÃO envolvem sinistro',
  'geral',
  'Olá {{nome}}! {{assunto}}: {{detalhes}}. Acompanhe pelo app.',
  ARRAY['nome', 'assunto', 'detalhes'],
  true
);
