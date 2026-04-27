
UPDATE public.error_reports
SET status = 'concluido',
    concluido_em = now(),
    observacao_diretor = COALESCE(observacao_diretor || E'\n', '') ||
      '[' || to_char(now(),'DD/MM/YYYY HH24:MI') || '] Card do técnico (TarefaAtualCard) ajustado: para tarefas com local_vistoria = ''base'', telefone do associado e botões de WhatsApp/Ligação ficam ocultos, e a obrigatoriedade de contato prévio antes de iniciar percurso já não se aplica (lógica isNaBase). Mensagem informativa "Atendimento na base — sem necessidade de contato prévio" exibida no lugar.'
WHERE id = '7e272308-ef7a-4907-964b-d40b83f71176';

UPDATE public.error_reports
SET observacao_diretor = COALESCE(observacao_diretor || E'\n', '') ||
  '[' || to_char(now(),'DD/MM/YYYY HH24:MI') || '] Aguardando caso reproduzível (associado/veículo específico) para diagnóstico do fluxo de criação de login/senha na Rede Veículos e sincronização Softruck. Sem ação automática possível neste ciclo.'
WHERE id = '5ab98352-6df4-4010-a68d-8229545c71b0';
