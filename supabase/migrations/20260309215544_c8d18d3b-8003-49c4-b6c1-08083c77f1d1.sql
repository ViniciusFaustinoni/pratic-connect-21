INSERT INTO whatsapp_meta_templates (nome, categoria, corpo, header_tipo, header_texto, rodape, botoes, variaveis_exemplo, status)
VALUES (
  'comunicacao_sinistro',
  'UTILITY',
  E'✅ Sinistro Registrado\n\nOlá, {{1}}! Aqui é a Pratic Car.\n\nRecebemos a comunicação do seu sinistro de {{2}}.\n\n📋 Protocolo: {{3}}\n\n💰 Sobre a cota de coparticipação:\nSeu plano é {{4}}, com cota de {{5}}.\nValor FIPE do veículo: {{6}}\nSua cota de coparticipação: {{7}}\n\n📝 Próximos passos obrigatórios:\n1. Realizar auto vistoria (fotos do veículo)\n2. Enviar Boletim de Ocorrência\n3. Relato completo do ocorrido\n\n⏰ Prazo: você tem 30 dias a partir da data do evento para concluir o processo.\n\nJá é possível dar entrada no conserto do veículo.\n\nAcesse o link abaixo para completar as etapas:\n🔗 {{8}}\n\nO link é válido por 72 horas.\n\nEm caso de dúvidas, estamos à disposição!',
  'none',
  NULL,
  NULL,
  NULL,
  '{"1": "MARCUS VINICIUS", "2": "colisão", "3": "SIN-20260304-0016", "4": "SELECT ONE APLICATIVO (Passeio)", "5": "8% da FIPE", "6": "R$ 69.531,00", "7": "R$ 5.562,48", "8": "https://pratic-connect-21.lovable.app/evento/xxx"}',
  'DRAFT'
);