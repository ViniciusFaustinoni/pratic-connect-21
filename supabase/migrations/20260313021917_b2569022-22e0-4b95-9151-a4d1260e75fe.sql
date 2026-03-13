INSERT INTO public.whatsapp_meta_templates (
  nome,
  categoria,
  corpo,
  header_tipo,
  rodape,
  botoes,
  variaveis_exemplo,
  status
) VALUES (
  'reagendamento_servico',
  'UTILITY',
  E'Olá {{1}}, infelizmente seu(sua) {{2}} não pôde ser realizado(a) conforme agendado.\n\nClique no botão abaixo para escolher uma nova data, horário e endereço. É rápido e fácil!\n\nEquipe PRATIC 🚗',
  'none',
  NULL,
  '[{"tipo": "URL", "texto": "Reagendar agora", "url": "https://pratic-connect-21.lovable.app/reagendar/{{1}}"}]'::jsonb,
  '{"1": "João", "2": "instalação do rastreador"}'::jsonb,
  'DRAFT'
);