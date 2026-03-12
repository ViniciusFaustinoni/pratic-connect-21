UPDATE whatsapp_meta_templates 
SET 
  corpo = '🎉 Bem-vindo à PRATIC!

Parabéns {{1}}! Seu cadastro foi aprovado! 🚗

📋 Veículo Protegido:
{{2}}

🛡️ Cobertura Ativa: {{3}}

⏳ Próximo Passo: {{4}}

🔗 Link direto de acesso: {{5}}

📱 Ou acesse pelo botão abaixo para criar sua conta no app PRATIC.

Após a instalação, sua Proteção 360º será ativada automaticamente!

Para qualquer dúvida sobre sua cobertura, você pode falar com nossa IA diretamente pelo app ou por aqui no WhatsApp! 🤖

Bem-vindo à família PRATIC! 💙',
  botoes = '[{"tipo":"url","texto":"📱 Criar Conta no App","url":"https://pratic-connect-21.lovable.app/primeiro-acesso?id={{1}}"}]'::jsonb,
  variaveis_exemplo = '{"1":"João","2":"ABC-1234 - Fiat Uno","3":"Roubo e Furto","4":"Instalação do rastreador","5":"https://pratic-connect-21.lovable.app/primeiro-acesso?id=abc123"}'::jsonb,
  updated_at = now()
WHERE nome = 'boas_vindas_associado_v2';