INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES ('prazo_confirmacao_agendamento_horas', '4', 'numero', 'operacional', 'Prazo em horas para o associado confirmar o agendamento via WhatsApp antes do cancelamento automático', true)
ON CONFLICT (chave) DO NOTHING;