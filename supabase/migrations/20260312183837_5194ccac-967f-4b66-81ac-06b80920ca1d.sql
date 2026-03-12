INSERT INTO whatsapp_meta_templates (
  nome, categoria, idioma, status, header_tipo,
  corpo, rodape, botoes, variaveis_exemplo
) VALUES (
  'boas_vindas_associado_v2',
  'UTILITY',
  'pt_BR',
  'DRAFT',
  'none',
  '🎉 Bem-vindo à PRATIC!

Parabéns {{1}}! Seu cadastro foi aprovado! 🚗

📋 Veículo Protegido:
{{2}}

🛡️ Cobertura Ativa: {{3}}

⏳ Próximo Passo: {{4}}

📱 Acesse o botão abaixo para criar sua conta no app PRATIC.

Após a instalação, sua Proteção 360º será ativada automaticamente!

Para qualquer dúvida sobre sua cobertura, você pode falar com nossa IA diretamente pelo app ou por aqui no WhatsApp! 🤖

Bem-vindo à família PRATIC! 💙',
  'PRATIC - Proteção Veicular',
  '[{"type":"URL","text":"📱 Criar Conta no App","url":"https://pratic-connect-21.lovable.app/primeiro-acesso?id={{1}}","example":"https://pratic-connect-21.lovable.app/primeiro-acesso?id=abc123"}]',
  '{"1":"João","2":"ABC-1234 - Fiat Uno","3":"Roubo e Furto","4":"Instalação do rastreador"}'
);