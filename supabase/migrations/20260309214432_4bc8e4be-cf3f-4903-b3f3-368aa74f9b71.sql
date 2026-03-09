INSERT INTO whatsapp_meta_templates (
  nome, categoria, corpo, header_tipo, rodape, status,
  variaveis_exemplo
) VALUES (
  'tecnico_a_caminho',
  'UTILITY',
  '🚗 Técnico a Caminho!

Olá {{1}}! Nosso técnico está a caminho do seu endereço para realizar a instalação do rastreador.

👤 Técnico: {{2}}
📞 Contato: {{3}}
💬 WhatsApp: {{4}}
📍 Endereço: {{5}}
⏰ Período: {{6}}

{{7}}',
  'none',
  NULL,
  'DRAFT',
  '{"1": "Marcus", "2": "Vistoriador", "3": "(21) 99259-3830", "4": "https://wa.me/5521992593830", "5": "EST CAFUNDA, 725, TANQUE, RIO DE JANEIRO", "6": "Manhã (08:00-12:00)", "7": "Você pode entrar em contato com o técnico se precisar de mais informações!"}'::jsonb
);