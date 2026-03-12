UPDATE public.whatsapp_meta_templates 
SET 
  corpo = E'🎉 Bem-vindo à PRATIC!\n\nParabéns {{1}}! Seu cadastro foi aprovado! 🚗\n\n📋 Veículo Protegido:\n{{2}}\n\n🛡️ Cobertura Ativa: {{3}}\n\n⏳ Próximo Passo: {{4}}\n\n📱 Acesse o botão abaixo para criar sua conta no app PRATIC.\n\nApós a instalação, sua Proteção 360º será ativada automaticamente!\n\nPara qualquer dúvida sobre sua cobertura, você pode falar com nossa IA diretamente pelo app ou por aqui no WhatsApp! 🤖\n\nBem-vindo à família PRATIC! 💙',
  botoes = '[{"type": "URL", "text": "Acessar App PRATIC", "url": "https://pratic-connect-21.lovable.app/acompanhar/{{1}}"}]'::jsonb,
  status = 'DRAFT',
  updated_at = now()
WHERE nome = 'boas_vindas_associado';