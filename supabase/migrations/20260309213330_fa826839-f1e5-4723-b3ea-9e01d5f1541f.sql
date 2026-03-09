INSERT INTO whatsapp_meta_templates (
  nome, categoria, corpo, header_tipo, rodape, status,
  variaveis_exemplo
) VALUES (
  'cadastro_aprovado',
  'UTILITY',
  '🎉 Bem-vindo à PRATIC!

Parabéns {{1}}! Seu cadastro foi aprovado! 🚗

📋 Veículo Protegido:
{{2}} - {{3}}

🛡️ Cobertura Ativa: {{4}}
⏳ Próximo Passo: {{5}}

📱 Acesse o link abaixo para criar sua conta no app PRATIC:
🔗 {{6}}

Após a instalação, sua Proteção 360º será ativada automaticamente!

Para qualquer dúvida, fale com nossa IA pelo app ou por aqui no WhatsApp! 🤖

Bem-vindo à família PRATIC! 💙',
  'none',
  NULL,
  'DRAFT',
  '{"1": "Marcus", "2": "LTB4J74", "3": "Toyota Corolla XEI", "4": "Roubo e Furto", "5": "Instalação do rastreador", "6": "https://pratic-connect-21.lovable.app/acompanhar/exemplo"}'::jsonb
);