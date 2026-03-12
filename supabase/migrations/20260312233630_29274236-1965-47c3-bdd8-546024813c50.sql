INSERT INTO whatsapp_meta_templates (
  nome,
  categoria,
  corpo,
  header_tipo,
  header_texto,
  rodape,
  botoes,
  variaveis_exemplo,
  status
) VALUES (
  'cobertura_total_ativada',
  'UTILITY',
  '🛡️ Cobertura Total Ativada!

Parabéns {{1}}! Seu veículo {{2}} ({{3}}) agora está com COBERTURA TOTAL ativa! ✅

O que está incluso na sua cobertura:

🔐 Roubo e Furto
💥 Colisão
🔥 Incêndio
🌧️ Fenômenos Naturais
🚗 Assistência 24h (guincho, pane seca, chaveiro e mais)
📍 Rastreamento em tempo real

Acesse o App PRATIC para acompanhar seu veículo e solicitar assistência quando precisar.

Bem-vindo à família PRATIC! 💙',
  'none',
  NULL,
  NULL,
  NULL,
  '{"1": "Marcus", "2": "LMS3B44", "3": "Fiat Uno"}'::jsonb,
  'DRAFT'
);