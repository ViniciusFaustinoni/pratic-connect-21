-- #5 Kaike: Liberar serviço — corrigido
UPDATE public.error_reports
SET status = 'concluido',
    concluido_em = now(),
    observacao_diretor = 'Corrigido. A função "Liberar serviço" agora: (1) exibe mensagens de erro claras quando o serviço já está concluído/cancelado; (2) aceita mais status intermediários (pendente, reagendada, em_analise, etc.); (3) fecha automaticamente o agendamento vinculado, evitando que o card volte travado; (4) atualiza imediatamente o mapa de monitoramento e a lista de técnicos disponíveis. Para testar: tente liberar um serviço travado pelo botão "Liberar serviço" no detalhe — você deve ver uma mensagem específica e o card sumir da fila do técnico.'
WHERE id = 'a4ea4264-7e28-4201-aec3-ff12d8e44e19';

-- #3 Teste: Planilha SGA — duplicata
UPDATE public.error_reports
SET status = 'concluido',
    concluido_em = now(),
    observacao_diretor = 'Tratado em conjunto com o relato anterior (mesma raiz: erros de migração para o SGA). A planilha não foi anexada ao relato — caso queira reprocessamento individual de algum cadastro específico, abra um novo relato listando os IDs/placas.'
WHERE id = '43aaa131-8757-4134-8e68-4118e963fd4b';

-- #1 Kleytonn: histórico de aceites — precisa mais info
UPDATE public.error_reports
SET observacao_diretor = 'Investigado. Para corrigir com precisão precisamos saber: (1) Em qual tela exatamente o histórico não aparece? (Mapa de Monitoramento / Atribuição Manual / Aba Equipe / outra?). (2) Você está filtrando por data ou usuário? (3) Pode anexar print mostrando o card aceito que não voltou no histórico? Sem essa informação corremos o risco de mexer no filtro errado. Permanece em tratamento.'
WHERE id = 'b33d7038-caa1-4cae-8957-0859d6836b71';

-- #2 Kleytonn: veículo só no cadastro
UPDATE public.error_reports
SET observacao_diretor = 'Investigado. Existem várias razões possíveis para um veículo aprovado não aparecer para o monitoramento associar técnico (vistoria pendente, contrato sem assinatura, endereço sem coordenadas, rastreador não selecionado). Para identificar a raiz precisamos do número da cotação ou do CPF/placa do associado afetado. Anexe esse dado e reabra. Permanece em tratamento.'
WHERE id = '2127cad7-a0bb-4d0a-8eec-343b0bf5553b';

-- #4 Teste: mapeamento SGA
UPDATE public.error_reports
SET observacao_diretor = 'Investigado. A sincronização SGA já foi reforçada hoje (envio de fotos). Os campos cor, combustível, voluntário e plano usam o mapeamento direto dos códigos Hinova. Para corrigir cada divergência precisamos: (1) ID/CPF de pelo menos 2 cadastros com cor errada no SGA; (2) idem para combustível e voluntário; (3) confirmar se o plano enviado tem código Hinova cadastrado em /admin/planos. Documentos/proposta/vistoria: o upload via API Hinova ainda não está implementado e está na fila como melhoria — hoje é manual mesmo. Permanece em tratamento até você anexar exemplos para corrigirmos o mapeamento de campos.'
WHERE id = '0ab7e65c-317b-4987-8232-d03394f9d619';

-- #6 Leonardo: não gera contrato
UPDATE public.error_reports
SET observacao_diretor = 'Investigado. Não localizamos cotações criadas pelo Leonardo Lopes nas últimas 12h, então não conseguimos reproduzir o erro. Para corrigir precisamos: (1) número da cotação (COT-XXXX) onde o contrato não foi gerado; (2) print do erro mostrado em tela. Possíveis causas conhecidas: créditos Autentique esgotados, plano sem template vinculado, ou variável obrigatória do associado em branco (CPF/CEP/email). Permanece em tratamento.'
WHERE id = '7813b9df-aab3-489b-a4a6-6eafa3575700';