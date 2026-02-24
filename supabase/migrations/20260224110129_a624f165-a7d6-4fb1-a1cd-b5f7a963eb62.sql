
-- Inserir 5 templates Meta para o fluxo de despacho de reboque
INSERT INTO public.whatsapp_meta_templates (nome, categoria, corpo, header_tipo, rodape, status, idioma, variaveis_exemplo)
VALUES
  (
    'despacho_reboque_novo',
    'UTILITY',
    'Novo chamado de reboque — PraticCar. Veículo: {{1}} — {{2}}. Local: {{3}}. Aberto: {{4}}. Toque para ver detalhes e aceitar: {{5}}. Você tem 10 minutos para responder.',
    'none',
    'Pratic Car - Proteção Veicular',
    'DRAFT',
    'pt_BR',
    '{"1": "Fiat Uno 2020", "2": "ABC-1234", "3": "Rua das Flores, 100 - Centro", "4": "24/02/2026 15:30", "5": "https://pratic-connect-21.lovable.app/assistencia/chamado/abc123"}'::jsonb
  ),
  (
    'reboque_a_caminho',
    'UTILITY',
    'Reboque a caminho — Pratic Car. Seu reboque foi acionado e está a caminho! Prestador: {{1}}. Distância: {{2}}. Estimativa: {{3}}. Acompanhe em tempo real: {{4}}. Ligar para o reboquista: {{5}}. Este link é válido por 2 horas.',
    'none',
    'Pratic Car - Proteção Veicular',
    'DRAFT',
    'pt_BR',
    '{"1": "João Guincho", "2": "12 km", "3": "~36 min", "4": "https://pratic-connect-21.lovable.app/acompanhar/reboque/abc123", "5": "11999998888"}'::jsonb
  ),
  (
    'reboque_chegou_local',
    'UTILITY',
    'Reboquista chegou! — Pratic Car. O reboquista {{1}} chegou ao local do seu veículo. Acompanhe: {{2}}',
    'none',
    'Pratic Car - Proteção Veicular',
    'DRAFT',
    'pt_BR',
    '{"1": "João Guincho", "2": "https://pratic-connect-21.lovable.app/acompanhar/reboque/abc123"}'::jsonb
  ),
  (
    'reboque_veiculo_carregado',
    'UTILITY',
    'Veículo no guincho — Pratic Car. Seu veículo foi carregado e está sendo levado para: {{1}}. Acompanhe: {{2}}',
    'none',
    'Pratic Car - Proteção Veicular',
    'DRAFT',
    'pt_BR',
    '{"1": "Oficina Central - Av. Brasil, 500", "2": "https://pratic-connect-21.lovable.app/acompanhar/reboque/abc123"}'::jsonb
  ),
  (
    'reboque_entregue',
    'UTILITY',
    'Veículo entregue — Pratic Car. Seu veículo foi entregue em: {{1}}. Horário: {{2}}. Obrigado por usar a Pratic Car!',
    'none',
    'Pratic Car - Proteção Veicular',
    'DRAFT',
    'pt_BR',
    '{"1": "Oficina Central - Av. Brasil, 500", "2": "16:45"}'::jsonb
  );
