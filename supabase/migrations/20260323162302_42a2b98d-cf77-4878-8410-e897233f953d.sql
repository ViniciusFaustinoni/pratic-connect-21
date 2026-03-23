UPDATE whatsapp_meta_templates
SET
  corpo = E'Olá {{1}}! Nova instalação atribuída pela Praticcar.\n\nAssociado: {{2}}\nMunicípio: {{3}}\nEndereço: {{4}}\nData prevista: {{5}}\n\nAcesse os detalhes e confirme pelo link:\n{{6}}\n\nEquipe Praticcar.',
  rodape = 'Pratic Car - Proteção Veicular',
  variaveis_exemplo = '{"1": "Auto Elétrica Silva", "2": "João Carlos", "3": "Araruama", "4": "Rua das Flores, nº 123, Centro, Araruama, RJ", "5": "25/03/2026", "6": "https://pratic-connect-21.lovable.app/prestador/instalacao/abc123token"}'::jsonb,
  status = 'DRAFT',
  updated_at = now()
WHERE id = '7fc610f7-f123-4502-9447-6551607d7d71';
